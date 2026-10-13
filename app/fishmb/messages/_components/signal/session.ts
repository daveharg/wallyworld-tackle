// SessionManager — ties X3DH + Double Ratchet + the device store
// together into the encrypt/decrypt API the messaging client uses.
//
// Persistence discipline (crash safety, forward secrecy):
// - The session record is saved after EVERY successful encrypt/decrypt,
//   because ratchet state is single-use: re-using a persisted old state
//   would re-derive an already-spent message key.
// - decrypt("msg") works on a deserialized COPY and only persists the
//   advanced state on success. On failure it persists the ORIGINAL
//   record with failCount/lastError updated — the ratchet itself is
//   left exactly as it was, so a tampered message in a backlog can't
//   wedge the session.
// - decrypt("pk") builds a brand-new Bob-side session; nothing is
//   persisted (and the one-time prekey is NOT consumed) until the first
//   message on it has authenticated and decrypted.

import { b64, unb64 } from "./bytes";
import {
  initAliceState,
  initBobState,
  ratchetEncrypt,
  ratchetDecrypt,
  serializeState,
  deserializeState,
} from "./ratchet";
import { initiateX3dh, respondX3dh } from "./x3dh";
import {
  DecryptFailure,
  addressOf,
  parseAddress,
  type Address,
  type IdentityRecord,
  type PreKeyBundle,
  type SessionRecord,
  type SigEnvelope,
  type SignalStore,
} from "./types";

export class SessionManager {
  constructor(private store: SignalStore) {}

  /**
   * Start a session with a remote device from its fetched prekey
   * bundle (we are the X3DH initiator / "Alice"). Overwrites any
   * existing session with that device. The pendingPreKey marker stays
   * on the record until the first encrypt, which emits it as a
   * PreKeyMessage envelope.
   */
  async startSession(
    myIdentity: IdentityRecord,
    bundle: PreKeyBundle,
  ): Promise<Address> {
    const { sk, ephemeral, ad } = initiateX3dh(myIdentity, bundle);
    const state = initAliceState(sk, unb64(bundle.signedPreKey.key), ad);
    const addr = addressOf(bundle.userId, bundle.deviceId);
    const record: SessionRecord = {
      state: serializeState(state),
      pendingPreKey: {
        ephemeralPub: b64(ephemeral.pub),
        signedPreKeyId: bundle.signedPreKey.keyId,
        oneTimePreKeyId: bundle.oneTimePreKey?.keyId ?? null,
      },
      failCount: 0,
      lastErrorAt: null,
      lastErrorKind: null,
      peerResetAt: null,
    };
    await this.store.saveSession(addr, record);
    return addr;
  }

  /** Encrypt one message for the device at `addr`. */
  async encrypt(
    myIdentity: IdentityRecord,
    addr: Address,
    plaintext: Uint8Array,
  ): Promise<SigEnvelope> {
    const record = await this.store.getSession(addr);
    if (!record) {
      throw new DecryptFailure("no-session", `no session for ${addr}`);
    }
    const st = deserializeState(record.state);
    const { header, body } = ratchetEncrypt(st, plaintext);

    const pending = record.pendingPreKey;
    let env: SigEnvelope;
    if (pending) {
      env = {
        v: 1,
        t: "pk",
        fd: myIdentity.deviceId,
        ik: b64(myIdentity.identityPub),
        ek: pending.ephemeralPub,
        spk: pending.signedPreKeyId,
        opk: pending.oneTimePreKeyId,
        h: header,
        b: b64(body),
      };
    } else {
      env = { v: 1, t: "msg", fd: myIdentity.deviceId, h: header, b: b64(body) };
    }

    await this.store.saveSession(addr, {
      ...record,
      state: serializeState(st),
      // The prekey material has now been sent exactly once.
      pendingPreKey: null,
    });
    return env;
  }

  /** Decrypt one envelope received from the device at `fromAddr`. */
  async decrypt(
    myIdentity: IdentityRecord,
    fromAddr: Address,
    env: SigEnvelope,
  ): Promise<Uint8Array> {
    if (env.t === "pk") {
      return this.decryptPreKeyMessage(myIdentity, fromAddr, env);
    }

    const record = await this.store.getSession(fromAddr);
    if (!record) {
      throw new DecryptFailure("no-session", `no session for ${fromAddr}`);
    }
    try {
      // Working copy: deserialize produces a fresh object; `record`
      // (and its state string) stay untouched until success below.
      const st = deserializeState(record.state);
      const plaintext = ratchetDecrypt(st, env.h, unb64(env.b));
      await this.store.saveSession(fromAddr, {
        ...record,
        state: serializeState(st),
        failCount: 0,
        lastErrorAt: null,
        lastErrorKind: null,
      });
      return plaintext;
    } catch (e) {
      if (e instanceof DecryptFailure) {
        // Bookkeeping only — persist the ORIGINAL state so the next
        // message in the backlog starts from the same ratchet position.
        await this.store.saveSession(fromAddr, {
          ...record,
          failCount: record.failCount + 1,
          lastErrorAt: Date.now(),
          lastErrorKind: e.kind,
        });
      }
      throw e;
    }
  }

  private async decryptPreKeyMessage(
    myIdentity: IdentityRecord,
    fromAddr: Address,
    env: Extract<SigEnvelope, { t: "pk" }>,
  ): Promise<Uint8Array> {
    // The address is the authoritative session key; parse it so a
    // malformed address fails here rather than deep in the store.
    parseAddress(fromAddr);
    const existing = await this.store.getSession(fromAddr);
    // A PreKeyMessage arriving over a live session means the peer
    // started over (new device state): flag it so the UI can show the
    // "conversation re-secured" line once.
    const peerResetAt = existing ? Date.now() : null;

    const spk = await this.store.getSignedPreKey(env.spk);
    if (!spk) {
      throw new DecryptFailure(
        "no-prekey",
        `signed prekey ${env.spk} not held`,
      );
    }
    let opkPriv: Uint8Array | null = null;
    if (env.opk !== null) {
      const opk = await this.store.getOneTimePreKey(env.opk);
      if (!opk) {
        throw new DecryptFailure(
          "no-prekey",
          `one-time prekey ${env.opk} not held`,
        );
      }
      opkPriv = opk.priv;
    }

    const { sk, ad } = respondX3dh(
      myIdentity,
      spk.priv,
      opkPriv,
      unb64(env.ik),
      unb64(env.ek),
    );
    const st = initBobState(sk, { pub: spk.pub, priv: spk.priv }, ad);

    // Throws (typed) on any authentication failure — in that case
    // nothing below runs: no session is saved, no prekey consumed.
    const plaintext = ratchetDecrypt(st, env.h, unb64(env.b));

    // Success: the one-time prekey is single-use, consume it now.
    if (env.opk !== null) {
      await this.store.removeOneTimePreKey(env.opk);
    }
    const record: SessionRecord = {
      state: serializeState(st),
      pendingPreKey: null,
      failCount: 0,
      lastErrorAt: null,
      lastErrorKind: null,
      peerResetAt,
    };
    await this.store.saveSession(fromAddr, record);
    return plaintext;
  }

  // ---------------------------------------------------------- passthroughs

  async hasSession(addr: Address): Promise<boolean> {
    return (await this.store.getSession(addr)) !== null;
  }

  async getRecord(addr: Address): Promise<SessionRecord | null> {
    return this.store.getSession(addr);
  }

  async deleteSession(addr: Address): Promise<void> {
    return this.store.deleteSession(addr);
  }

  async listSessionAddresses(): Promise<Address[]> {
    return this.store.listSessions();
  }
}
