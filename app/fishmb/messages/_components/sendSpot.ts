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
  sharedSecret,
  encryptText,
} from "./msgCrypto";

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
    };
    if (d.public_key !== myPub) {
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
  if (!friend?.public_key) {
    throw new Error(
      "That friend hasn't opened FishMB yet, so there's no way to deliver the spot. Once they've opened the app, you can send it."
    );
  }

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

  const parts: { recipient_id: string; nonce: string; ciphertext: string }[] = [];
  for (const m of members) {
    if (!m.public_key) continue;
    const sec = sharedSecret(m.public_key, kp.secretKey);
    const { nonce, ciphertext } = encryptText(payload, sec);
    parts.push({ recipient_id: m.user_id, nonce, ciphertext });
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
