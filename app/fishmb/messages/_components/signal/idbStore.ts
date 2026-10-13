// IndexedDB-backed SignalStore for the browser.
//
// Hand-rolled minimal wrapper (no new dependencies). Binary fields are
// stored as base64 strings using the Ser* shapes from types.ts, so the
// IDB record format is exactly the backup dump format and dump/restore
// stay symmetric. Sessions, sentLog and meta are already JSON-safe.
//
// Layout (db "fishmb-signal", version 1), all stores use out-of-line keys:
//   identity       key "me"                    -> SerIdentity
//   signedPreKeys  key keyId (number)          -> SerSignedPreKey
//   oneTimePreKeys key keyId (number)          -> SerOneTimePreKey
//   sessions       key address ("userId:dev")  -> SessionRecord
//   sentLog        key conversationId          -> SentLogEntry[]
//   meta           key string                  -> string
//
// If IndexedDB is unavailable the constructor throws a clear error; the
// singleton catches that and falls back to InMemoryStore.

import { b64, unb64 } from "./bytes";
import type {
  Address,
  IdentityRecord,
  OneTimePreKeyRecord,
  SentLogEntry,
  SerIdentity,
  SerOneTimePreKey,
  SerSignedPreKey,
  SessionRecord,
  SignalStore,
  SignedPreKeyRecord,
  StoreDump,
} from "./types";

type StoreName =
  | "identity"
  | "signedPreKeys"
  | "oneTimePreKeys"
  | "sessions"
  | "sentLog"
  | "meta";

const STORE_NAMES: StoreName[] = [
  "identity",
  "signedPreKeys",
  "oneTimePreKeys",
  "sessions",
  "sentLog",
  "meta",
];

const IDENTITY_KEY = "me";

// ------------------------------------------------------------ serialization

function serIdentity(i: IdentityRecord): SerIdentity {
  return {
    userId: i.userId,
    deviceId: i.deviceId,
    registrationId: i.registrationId,
    identityPub: b64(i.identityPub),
    identityPriv: b64(i.identityPriv),
    createdAt: i.createdAt,
  };
}

function deserIdentity(s: SerIdentity): IdentityRecord {
  return {
    userId: s.userId,
    deviceId: s.deviceId,
    registrationId: s.registrationId,
    identityPub: unb64(s.identityPub),
    identityPriv: unb64(s.identityPriv),
    createdAt: s.createdAt,
  };
}

function serSpk(r: SignedPreKeyRecord): SerSignedPreKey {
  return {
    keyId: r.keyId,
    pub: b64(r.pub),
    priv: b64(r.priv),
    signature: b64(r.signature),
    createdAt: r.createdAt,
  };
}

function deserSpk(s: SerSignedPreKey): SignedPreKeyRecord {
  return {
    keyId: s.keyId,
    pub: unb64(s.pub),
    priv: unb64(s.priv),
    signature: unb64(s.signature),
    createdAt: s.createdAt,
  };
}

function serOtp(r: OneTimePreKeyRecord): SerOneTimePreKey {
  return { keyId: r.keyId, pub: b64(r.pub), priv: b64(r.priv) };
}

function deserOtp(s: SerOneTimePreKey): OneTimePreKeyRecord {
  return { keyId: s.keyId, pub: unb64(s.pub), priv: unb64(s.priv) };
}

// ------------------------------------------------------------ IDB plumbing

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () =>
      reject(r.error ?? new Error("IndexedDB request failed"));
  });
}

export class IdbStore implements SignalStore {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private readonly dbName: string;

  constructor(dbName = "fishmb-signal") {
    if (typeof indexedDB === "undefined") {
      throw new Error(
        "IdbStore: IndexedDB is not available in this environment."
      );
    }
    this.dbName = dbName;
  }

  private open(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const openReq = indexedDB.open(this.dbName, 1);
        openReq.onupgradeneeded = () => {
          const db = openReq.result;
          for (const name of STORE_NAMES) {
            if (!db.objectStoreNames.contains(name)) {
              db.createObjectStore(name);
            }
          }
        };
        openReq.onsuccess = () => resolve(openReq.result);
        openReq.onerror = () =>
          reject(openReq.error ?? new Error("Failed to open IndexedDB"));
        openReq.onblocked = () =>
          reject(new Error("IndexedDB open was blocked"));
      });
    }
    return this.dbPromise;
  }

  /** Run `work` inside one transaction and resolve with its result once
   *  the transaction has committed. */
  private async tx<T>(
    names: StoreName[],
    mode: IDBTransactionMode,
    work: (tx: IDBTransaction) => Promise<T>
  ): Promise<T> {
    const db = await this.open();
    const transaction = db.transaction(names, mode);
    const done = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("IndexedDB transaction failed"));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    });
    try {
      const result = await work(transaction);
      await done;
      return result;
    } catch (e) {
      void done.catch(() => {});
      try {
        transaction.abort();
      } catch {
        // Already finished/aborted — nothing to do.
      }
      throw e;
    }
  }

  private async getRaw<T>(name: StoreName, key: IDBValidKey): Promise<T | null> {
    return this.tx([name], "readonly", async (tx) => {
      const v = await req(tx.objectStore(name).get(key));
      return (v as T | undefined) ?? null;
    });
  }

  private async putRaw(
    name: StoreName,
    key: IDBValidKey,
    value: unknown
  ): Promise<void> {
    await this.tx([name], "readwrite", async (tx) => {
      await req(tx.objectStore(name).put(value, key));
    });
  }

  private async deleteRaw(name: StoreName, key: IDBValidKey): Promise<void> {
    await this.tx([name], "readwrite", async (tx) => {
      await req(tx.objectStore(name).delete(key));
    });
  }

  private async allEntries<T>(
    name: StoreName
  ): Promise<{ key: string; value: T }[]> {
    return this.tx([name], "readonly", async (tx) => {
      const store = tx.objectStore(name);
      const keys = await req(store.getAllKeys());
      const values = await req(store.getAll());
      return keys.map((k, i) => ({
        key: String(k),
        value: values[i] as T,
      }));
    });
  }

  // ------------------------------------------------------------ identity

  async getIdentity(): Promise<IdentityRecord | null> {
    const raw = await this.getRaw<SerIdentity>("identity", IDENTITY_KEY);
    return raw ? deserIdentity(raw) : null;
  }

  async saveIdentity(i: IdentityRecord): Promise<void> {
    await this.putRaw("identity", IDENTITY_KEY, serIdentity(i));
  }

  // ------------------------------------------------------------ signed prekeys

  async getSignedPreKey(keyId: number): Promise<SignedPreKeyRecord | null> {
    const raw = await this.getRaw<SerSignedPreKey>("signedPreKeys", keyId);
    return raw ? deserSpk(raw) : null;
  }

  async getCurrentSignedPreKey(): Promise<SignedPreKeyRecord | null> {
    const all = await this.listSignedPreKeys();
    return all.length > 0 ? all[all.length - 1] : null;
  }

  async listSignedPreKeys(): Promise<SignedPreKeyRecord[]> {
    const entries = await this.allEntries<SerSignedPreKey>("signedPreKeys");
    return entries
      .map((e) => deserSpk(e.value))
      .sort((a, b) => a.keyId - b.keyId);
  }

  async saveSignedPreKey(r: SignedPreKeyRecord): Promise<void> {
    await this.putRaw("signedPreKeys", r.keyId, serSpk(r));
  }

  // ------------------------------------------------------------ one-time prekeys

  async getOneTimePreKey(keyId: number): Promise<OneTimePreKeyRecord | null> {
    const raw = await this.getRaw<SerOneTimePreKey>("oneTimePreKeys", keyId);
    return raw ? deserOtp(raw) : null;
  }

  async countOneTimePreKeys(): Promise<number> {
    return this.tx(["oneTimePreKeys"], "readonly", async (tx) => {
      return req(tx.objectStore("oneTimePreKeys").count());
    });
  }

  async saveOneTimePreKeys(rs: OneTimePreKeyRecord[]): Promise<void> {
    if (rs.length === 0) return;
    await this.tx(["oneTimePreKeys"], "readwrite", async (tx) => {
      const store = tx.objectStore("oneTimePreKeys");
      for (const r of rs) await req(store.put(serOtp(r), r.keyId));
    });
  }

  async removeOneTimePreKey(keyId: number): Promise<void> {
    await this.deleteRaw("oneTimePreKeys", keyId);
  }

  // ------------------------------------------------------------ sessions

  async getSession(addr: Address): Promise<SessionRecord | null> {
    return this.getRaw<SessionRecord>("sessions", addr);
  }

  async saveSession(addr: Address, s: SessionRecord): Promise<void> {
    await this.putRaw("sessions", addr, s);
  }

  async deleteSession(addr: Address): Promise<void> {
    await this.deleteRaw("sessions", addr);
  }

  async listSessions(): Promise<Address[]> {
    const entries = await this.allEntries<SessionRecord>("sessions");
    return entries.map((e) => e.key);
  }

  // ------------------------------------------------------------ sent log

  async appendSentLog(e: SentLogEntry): Promise<void> {
    await this.tx(["sentLog"], "readwrite", async (tx) => {
      const store = tx.objectStore("sentLog");
      const current =
        ((await req(store.get(e.conversationId))) as
          | SentLogEntry[]
          | undefined) ?? [];
      await req(store.put([...current, e], e.conversationId));
    });
  }

  async getSentLog(conversationId: string): Promise<SentLogEntry[]> {
    const raw = await this.getRaw<SentLogEntry[]>("sentLog", conversationId);
    return raw ?? [];
  }

  // ------------------------------------------------------------ meta

  async getMeta(key: string): Promise<string | null> {
    return this.getRaw<string>("meta", key);
  }

  async setMeta(key: string, value: string): Promise<void> {
    await this.putRaw("meta", key, value);
  }

  // ------------------------------------------------------------ dump / restore / wipe

  async dump(): Promise<StoreDump> {
    const identity = await this.getIdentity();
    const signed = await this.listSignedPreKeys();
    const otpEntries = await this.allEntries<SerOneTimePreKey>(
      "oneTimePreKeys"
    );
    const sessionEntries = await this.allEntries<SessionRecord>("sessions");
    const sentEntries = await this.allEntries<SentLogEntry[]>("sentLog");
    const metaEntries = await this.allEntries<string>("meta");

    const sessions: Record<Address, SessionRecord> = {};
    for (const e of sessionEntries) sessions[e.key] = e.value;
    const meta: Record<string, string> = {};
    for (const e of metaEntries) meta[e.key] = e.value;

    return {
      version: 1,
      identity: identity ? serIdentity(identity) : null,
      signedPreKeys: signed.map(serSpk),
      oneTimePreKeys: otpEntries
        .map((e) => e.value)
        .sort((a, b) => a.keyId - b.keyId),
      sessions,
      sentLog: sentEntries.flatMap((e) => e.value),
      meta,
    };
  }

  async restore(dump: StoreDump): Promise<void> {
    const byConversation = new Map<string, SentLogEntry[]>();
    for (const entry of dump.sentLog) {
      const arr = byConversation.get(entry.conversationId) ?? [];
      arr.push(entry);
      byConversation.set(entry.conversationId, arr);
    }
    await this.tx(STORE_NAMES, "readwrite", async (tx) => {
      for (const name of STORE_NAMES) {
        await req(tx.objectStore(name).clear());
      }
      if (dump.identity) {
        await req(
          tx.objectStore("identity").put(dump.identity, IDENTITY_KEY)
        );
      }
      const spkStore = tx.objectStore("signedPreKeys");
      for (const r of dump.signedPreKeys) await req(spkStore.put(r, r.keyId));
      const otpStore = tx.objectStore("oneTimePreKeys");
      for (const r of dump.oneTimePreKeys) await req(otpStore.put(r, r.keyId));
      const sessionStore = tx.objectStore("sessions");
      for (const [addr, record] of Object.entries(dump.sessions)) {
        await req(sessionStore.put(record, addr));
      }
      const sentStore = tx.objectStore("sentLog");
      for (const [conversationId, entries] of Array.from(
        byConversation.entries()
      )) {
        await req(sentStore.put(entries, conversationId));
      }
      const metaStore = tx.objectStore("meta");
      for (const [key, value] of Object.entries(dump.meta)) {
        await req(metaStore.put(value, key));
      }
    });
  }

  async wipe(): Promise<void> {
    await this.tx(STORE_NAMES, "readwrite", async (tx) => {
      for (const name of STORE_NAMES) {
        await req(tx.objectStore(name).clear());
      }
    });
  }
}
