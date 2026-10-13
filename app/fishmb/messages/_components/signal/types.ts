// Shared contracts for the Signal protocol layer. Every other signal/*
// module (engine, stores, client, UI glue) codes against these types.
//
// Storage model in one paragraph: a FishMB user has one or more DEVICES
// (browser contexts). Each device owns exactly ONE long-term Ed25519
// identity keypair, generated once and never silently regenerated, plus
// a signed X25519 prekey (rotated, old ones kept) and a pool of one-time
// X25519 prekeys. Sessions are pairwise between two DEVICES (addressed
// "userId:deviceId") and run the Double Ratchet. All private material
// lives only in the device store (IndexedDB in the browser).

// ------------------------------------------------------------ addresses

/** Session address: one specific device of one specific user. */
export type Address = string;

export function addressOf(userId: string, deviceId: number): Address {
  return `${userId}:${deviceId}`;
}

export function parseAddress(a: Address): { userId: string; deviceId: number } {
  const i = a.lastIndexOf(":");
  return { userId: a.slice(0, i), deviceId: Number(a.slice(i + 1)) };
}

// ------------------------------------------------------------ records (runtime form, binary fields)

export interface IdentityRecord {
  userId: string;
  deviceId: number;
  /** 14-bit registration id, as in Signal. */
  registrationId: number;
  /** Ed25519 identity public key (32 bytes). This is THE public identity
   *  key registered with the server in sig_devices. */
  identityPub: Uint8Array;
  /** Ed25519 secret seed (32 bytes). Never leaves the device store. */
  identityPriv: Uint8Array;
  createdAt: number;
}

export interface SignedPreKeyRecord {
  keyId: number;
  pub: Uint8Array;
  priv: Uint8Array;
  /** Ed25519 signature over `pub` by the identity key. */
  signature: Uint8Array;
  createdAt: number;
}

export interface OneTimePreKeyRecord {
  keyId: number;
  pub: Uint8Array;
  priv: Uint8Array;
}

/** A ratchet session with one remote device, plus bookkeeping the
 *  recovery UX needs. `state` is ratchet.ts's serialized state. */
export interface SessionRecord {
  state: string;
  /** Set while this session was started by us (X3DH initiator) and no
   *  message has been sent on it yet: the first encrypt must produce a
   *  PreKeyMessage carrying this data. Cleared after the first encrypt. */
  pendingPreKey: {
    ephemeralPub: string; // base64 X25519 pub
    signedPreKeyId: number;
    oneTimePreKeyId: number | null;
  } | null;
  /** Consecutive decrypt failures on this session (reset on success). */
  failCount: number;
  lastErrorAt: number | null;
  lastErrorKind: string | null;
  /** Timestamp when a PreKeyMessage replaced an already-live session
   *  (the peer reset their session). Consumed by the UI to show the
   *  "re-secured" system line exactly once. */
  peerResetAt: number | null;
}

/** One entry of the device-local log of messages THIS device sent. The
 *  sending device keeps its own sent history locally (Signal does the
 *  same with its local database); other devices get real synced copies
 *  through their own sessions. */
export interface SentLogEntry {
  conversationId: string;
  /** Logical-message key shared with the server copies: the sender is
   *  always this device's user; created_at is the server timestamp of
   *  the send, so UI merges can dedupe. */
  created_at: string;
  text: string;
}

// ------------------------------------------------------------ serialized dump (backup / persistence)

export interface SerIdentity {
  userId: string;
  deviceId: number;
  registrationId: number;
  identityPub: string;
  identityPriv: string;
  createdAt: number;
}
export interface SerSignedPreKey {
  keyId: number;
  pub: string;
  priv: string;
  signature: string;
  createdAt: number;
}
export interface SerOneTimePreKey {
  keyId: number;
  pub: string;
  priv: string;
}

export interface StoreDump {
  version: 1;
  identity: SerIdentity | null;
  signedPreKeys: SerSignedPreKey[];
  oneTimePreKeys: SerOneTimePreKey[];
  sessions: Record<Address, SessionRecord>;
  sentLog: SentLogEntry[];
  meta: Record<string, string>;
}

// ------------------------------------------------------------ store interface

/**
 * Persistence for everything the protocol needs. Implementations:
 * InMemoryStore (tests) and IdbStore (browser). All methods async so the
 * IndexedDB implementation fits without adapters.
 *
 * Invariant: saveSession is called after EVERY encrypt/decrypt operation
 * (crash safety) — implementations should make single-record writes
 * cheap and atomic.
 */
export interface SignalStore {
  getIdentity(): Promise<IdentityRecord | null>;
  saveIdentity(i: IdentityRecord): Promise<void>;

  getSignedPreKey(keyId: number): Promise<SignedPreKeyRecord | null>;
  /** The signed prekey with the highest keyId (the "current" one). */
  getCurrentSignedPreKey(): Promise<SignedPreKeyRecord | null>;
  listSignedPreKeys(): Promise<SignedPreKeyRecord[]>;
  saveSignedPreKey(r: SignedPreKeyRecord): Promise<void>;

  getOneTimePreKey(keyId: number): Promise<OneTimePreKeyRecord | null>;
  countOneTimePreKeys(): Promise<number>;
  saveOneTimePreKeys(rs: OneTimePreKeyRecord[]): Promise<void>;
  removeOneTimePreKey(keyId: number): Promise<void>;

  getSession(addr: Address): Promise<SessionRecord | null>;
  saveSession(addr: Address, s: SessionRecord): Promise<void>;
  deleteSession(addr: Address): Promise<void>;
  listSessions(): Promise<Address[]>;

  appendSentLog(e: SentLogEntry): Promise<void>;
  getSentLog(conversationId: string): Promise<SentLogEntry[]>;

  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;

  dump(): Promise<StoreDump>;
  restore(dump: StoreDump): Promise<void>;
  wipe(): Promise<void>;
}

// ------------------------------------------------------------ wire types

/** A device's public bundle as served by GET /api/fishmb/sig/bundle.
 *  All keys base64. `identityKey` is the Ed25519 identity public key. */
export interface PreKeyBundle {
  userId: string;
  deviceId: number;
  registrationId: number;
  identityKey: string;
  signedPreKey: { keyId: number; key: string; signature: string };
  oneTimePreKey: { keyId: number; key: string } | null;
}

/** One device in GET /api/fishmb/sig/devices listings. */
export interface DeviceInfo {
  deviceId: number;
  identityKey: string; // base64 Ed25519 pub
  registrationId: number;
}

export interface RatchetHeader {
  /** Sender's current ratchet public key (base64 X25519). */
  dh: string;
  /** Length of the sender's previous sending chain. */
  pn: number;
  /** Message number in the current sending chain. */
  n: number;
}

/**
 * The sig1 message envelope — stored as JSON in fm_messages.ciphertext
 * with fm_messages.nonce = "sig1", fm_messages.proto = "sig1", and
 * fm_messages.recipient_key = the RECIPIENT device's identity key
 * (base64), so a device picks exactly the copies addressed to it.
 * `fd` (fromDevice) makes every envelope self-describing: the receiver
 * always knows which session to run, even for normal messages.
 */
export type SigEnvelope =
  | {
      v: 1;
      t: "pk";
      fd: number;
      /** Sender's Ed25519 identity public key (base64). */
      ik: string;
      /** X3DH ephemeral public key (base64 X25519). */
      ek: string;
      /** Which of the receiver's signed prekeys was used. */
      spk: number;
      /** Which of the receiver's one-time prekeys was used, if any. */
      opk: number | null;
      h: RatchetHeader;
      /** ciphertext || HMAC tag, base64. */
      b: string;
    }
  | {
      v: 1;
      t: "msg";
      fd: number;
      h: RatchetHeader;
      b: string;
    };

/** Typed decrypt failure classes — every one maps to a human sentence in
 *  the UI; nothing fails silently. */
export type DecryptErrorKind =
  | "no-session" // no session for this sender device (and not a pk msg)
  | "bad-mac" // authentication failed (tamper / wrong keys / desync)
  | "desync" // ratchet state too far gone (skip limit, stale header)
  | "bad-envelope" // malformed envelope / bad version
  | "no-prekey" // pk msg references a prekey we no longer hold
  | "bad-signature" // signed prekey signature verification failed
  | "identity-mismatch"; // envelope identity != known identity for that device

export class DecryptFailure extends Error {
  kind: DecryptErrorKind;
  constructor(kind: DecryptErrorKind, message?: string) {
    super(message ?? kind);
    this.kind = kind;
    this.name = "DecryptFailure";
  }
}
