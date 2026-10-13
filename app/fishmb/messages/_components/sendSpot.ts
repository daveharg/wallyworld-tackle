// Send one of my fishing spots to a friend inside Messages.
//
// Messages are end-to-end encrypted, so a spot share is just another
// encrypted payload: { t: "spot", spot: {...}, origin: {id, name} }.
// The origin is the angler who ORIGINALLY shared the spot — when you
// re-share a spot you received, the original sharer's name travels with
// it. The recipient accepts from the chat card, which saves their own
// editable copy stamped with that origin.

import { fishFetch } from "../../_components/fishFetch";
import {
  getOrCreateKeypair,
  publicKeyB64,
  encryptForPublicKey,
} from "./msgCrypto";
import { peekSignalClient } from "./signal/singleton";
import { encodeEnvelope } from "./signal/envelope";

export interface SpotShareData {
  name: string;
  lat: number;
  lng: number;
  notes: string | null;
  icon: string;
  lake_id: string | null;
  origin_user_id: string | null;
  origin_name: string | null;
}

interface Member {
  user_id: string;
  name: string;
  public_key: string | null;
  public_keys?: string[];
}

/** All registered keys for a member (falls back to the newest key). */
function keysOf(m: Member): string[] {
  if (m.public_keys && m.public_keys.length > 0) return m.public_keys;
  return m.public_key ? [m.public_key] : [];
}

export async function sendSpotToFriend(
  myId: string,
  myName: string,
  friendId: string,
  spot: SpotShareData
): Promise<string> {
  // Messaging keys — same automatic setup the Messages page performs.
  const kp = getOrCreateKeypair(myId);
  const myPub = publicKeyB64(kp);
  try {
    const d = (await fishFetch("/api/fishmb/msg/keys")) as {
      public_key: string | null;
      public_keys?: string[];
    };
    const registered = d.public_keys ?? (d.public_key ? [d.public_key] : []);
    if (!registered.includes(myPub)) {
      await fishFetch("/api/fishmb/msg/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_key: myPub }),
      });
    }
  } catch {
    // The conversation POST below reports any real failure.
  }

  // Find-or-create the 1:1 conversation.
  const c = (await fishFetch("/api/fishmb/msg/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ other_user_id: friendId }),
  })) as { id: string };
  const convoId = c.id;

  // Members with their public keys (from the conversation list).
  const list = (await fishFetch("/api/fishmb/msg/conversations")) as {
    conversations: { id: string; members: Member[] }[];
  };
  const convo = (list.conversations ?? []).find((x) => x.id === convoId);
  const members = convo?.members ?? [];
  const friend = members.find((m) => m.user_id === friendId);

  const origin =
    spot.origin_user_id && spot.origin_name
      ? { id: spot.origin_user_id, name: spot.origin_name }
      : { id: myId, name: myName };

  const payload = JSON.stringify({
    t: "spot",
    v: 1,
    spot: {
      name: spot.name,
      lat: spot.lat,
      lng: spot.lng,
      notes: spot.notes,
      icon: spot.icon,
      lake_id: spot.lake_id,
    },
    origin,
  });

  // Signal path: if this device has a Signal client and the friend has
  // Signal devices, send one sig1 copy per device (friend's devices +
  // my other devices; the sending device keeps no server copy and logs
  // the send locally instead).
  const client = peekSignalClient(myId);
  const friendDevices = client ? await client.devicesOf(friendId) : [];
  if (client && friendDevices.length > 0) {
    const parts: {
      recipient_id: string;
      recipient_key: string;
      nonce: string;
      ciphertext: string;
      proto: string;
    }[] = [];
    for (const device of friendDevices) {
      const env = await client.encryptToDevice(friendId, device.deviceId, payload);
      parts.push({
        recipient_id: friendId,
        recipient_key: device.identityKey,
        nonce: "sig1",
        ciphertext: encodeEnvelope(env),
        proto: "sig1",
      });
    }
    const myDevices = await client.devicesOf(myId);
    for (const device of myDevices) {
      if (device.deviceId === client.deviceId) continue;
      const env = await client.encryptToDevice(myId, device.deviceId, payload);
      parts.push({
        recipient_id: myId,
        recipient_key: device.identityKey,
        nonce: "sig1",
        ciphertext: encodeEnvelope(env),
        proto: "sig1",
      });
    }
    const res = (await fishFetch(`/api/fishmb/msg/conversations/${convoId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parts }),
    })) as { messages?: { created_at: string }[] };
    const created_at = res.messages?.[0]?.created_at;
    if (created_at) {
      try {
        await client.logSent(convoId, payload, created_at);
      } catch {
        // Delivered either way; the local log is best-effort.
      }
    }
    try {
      window.dispatchEvent(new Event("fishmb-unread-changed"));
    } catch {}
    return convoId;
  }

  // v2 path: the friend needs at least legacy keys. The "hasn't opened
  // FishMB yet" error only applies when they have NEITHER Signal
  // devices (checked above) NOR legacy keys.
  if (!friend || keysOf(friend).length === 0) {
    throw new Error(
      "That friend hasn't opened FishMB yet, so there's no way to deliver the spot. Once they've opened the app, you can send it."
    );
  }

  // One self-contained v2 copy per (member, registered key) — including
  // my own keys, so the share shows in my history on every device.
  const parts: {
    recipient_id: string;
    recipient_key: string;
    nonce: string;
    ciphertext: string;
  }[] = [];
  for (const m of members) {
    for (const pk of keysOf(m)) {
      const { nonce, ciphertext } = encryptForPublicKey(payload, pk);
      parts.push({ recipient_id: m.user_id, recipient_key: pk, nonce, ciphertext });
    }
  }

  await fishFetch(`/api/fishmb/msg/conversations/${convoId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parts }),
  });
  try {
    window.dispatchEvent(new Event("fishmb-unread-changed"));
  } catch {}
  return convoId;
}
