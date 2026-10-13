// InMemoryStore — SignalStore backed by Maps. Used by the node test
// harness (the real code paths, no IndexedDB) and anywhere a throwaway
// store is handy. dump()/restore() round-trip through the serialized
// Ser* shapes from types.ts (binary fields as base64), which is also
// how tests simulate a full app restart: dump -> new store -> restore.

import { b64, unb64 } from "./bytes";
import type {
  Address,
  IdentityRecord,
  OneTimePreKeyRecord,
  SentLogEntry,
  SessionRecord,
  SignalStore,
  SignedPreKeyRecord,
  StoreDump,
} from "./types";

function cloneSession(s: SessionRecord): SessionRecord {
  // SessionRecord is plain JSON data (state is a string) — a JSON
  // round-trip is an exact, alias-free copy.
  return JSON.parse(JSON.stringify(s)) as SessionRecord;
}

function cloneIdentity(i: IdentityRecord): IdentityRecord {
  return {
    ...i,
    identityPub: new Uint8Array(i.identityPub),
    identityPriv: new Uint8Array(i.identityPriv),
  };
}

function cloneSpk(r: SignedPreKeyRecord): SignedPreKeyRecord {
  return {
    ...r,
    pub: new Uint8Array(r.pub),
    priv: new Uint8Array(r.priv),
    signature: new Uint8Array(r.signature),
  };
}

function cloneOpk(r: OneTimePreKeyRecord): OneTimePreKeyRecord {
  return { ...r, pub: new Uint8Array(r.pub), priv: new Uint8Array(r.priv) };
}

export class InMemoryStore implements SignalStore {
  private identity: IdentityRecord | null = null;
  private signedPreKeys = new Map<number, SignedPreKeyRecord>();
  private oneTimePreKeys = new Map<number, OneTimePreKeyRecord>();
  private sessions = new Map<Address, SessionRecord>();
  private sentLog: SentLogEntry[] = [];
  private meta = new Map<string, string>();

  // ------------------------------------------------------------ identity

  async getIdentity(): Promise<IdentityRecord | null> {
    return this.identity ? cloneIdentity(this.identity) : null;
  }

  async saveIdentity(i: IdentityRecord): Promise<void> {
    this.identity = cloneIdentity(i);
  }

  // ------------------------------------------------------------ signed prekeys

  async getSignedPreKey(keyId: number): Promise<SignedPreKeyRecord | null> {
    const r = this.signedPreKeys.get(keyId);
    return r ? cloneSpk(r) : null;
  }

  async getCurrentSignedPreKey(): Promise<SignedPreKeyRecord | null> {
    let best: SignedPreKeyRecord | null = null;
    Array.from(this.signedPreKeys.values()).forEach((r) => {
      if (!best || r.keyId > best.keyId) best = r;
    });
    return best ? cloneSpk(best) : null;
  }

  async listSignedPreKeys(): Promise<SignedPreKeyRecord[]> {
    return Array.from(this.signedPreKeys.values())
      .sort((a, b) => a.keyId - b.keyId)
      .map(cloneSpk);
  }

  async saveSignedPreKey(r: SignedPreKeyRecord): Promise<void> {
    this.signedPreKeys.set(r.keyId, cloneSpk(r));
  }

  // ------------------------------------------------------------ one-time prekeys

  async getOneTimePreKey(keyId: number): Promise<OneTimePreKeyRecord | null> {
    const r = this.oneTimePreKeys.get(keyId);
    return r ? cloneOpk(r) : null;
  }

  async countOneTimePreKeys(): Promise<number> {
    return this.oneTimePreKeys.size;
  }

  async saveOneTimePreKeys(rs: OneTimePreKeyRecord[]): Promise<void> {
    for (const r of rs) this.oneTimePreKeys.set(r.keyId, cloneOpk(r));
  }

  async removeOneTimePreKey(keyId: number): Promise<void> {
    this.oneTimePreKeys.delete(keyId);
  }

  // ------------------------------------------------------------ sessions

  async getSession(addr: Address): Promise<SessionRecord | null> {
    const s = this.sessions.get(addr);
    return s ? cloneSession(s) : null;
  }

  async saveSession(addr: Address, s: SessionRecord): Promise<void> {
    this.sessions.set(addr, cloneSession(s));
  }

  async deleteSession(addr: Address): Promise<void> {
    this.sessions.delete(addr);
  }

  async listSessions(): Promise<Address[]> {
    return Array.from(this.sessions.keys());
  }

  // ------------------------------------------------------------ sent log

  async appendSentLog(e: SentLogEntry): Promise<void> {
    this.sentLog.push({ ...e });
  }

  async getSentLog(conversationId: string): Promise<SentLogEntry[]> {
    return this.sentLog
      .filter((e) => e.conversationId === conversationId)
      .map((e) => ({ ...e }));
  }

  // ------------------------------------------------------------ meta

  async getMeta(key: string): Promise<string | null> {
    return this.meta.get(key) ?? null;
  }

  async setMeta(key: string, value: string): Promise<void> {
    this.meta.set(key, value);
  }

  // ------------------------------------------------------------ dump / restore / wipe

  async dump(): Promise<StoreDump> {
    const sessions: Record<Address, SessionRecord> = {};
    this.sessions.forEach((s, addr) => {
      sessions[addr] = cloneSession(s);
    });
    return {
      version: 1,
      identity: this.identity
        ? {
            userId: this.identity.userId,
            deviceId: this.identity.deviceId,
            registrationId: this.identity.registrationId,
            identityPub: b64(this.identity.identityPub),
            identityPriv: b64(this.identity.identityPriv),
            createdAt: this.identity.createdAt,
          }
        : null,
      signedPreKeys: Array.from(this.signedPreKeys.values())
        .sort((a, b) => a.keyId - b.keyId)
        .map((r) => ({
          keyId: r.keyId,
          pub: b64(r.pub),
          priv: b64(r.priv),
          signature: b64(r.signature),
          createdAt: r.createdAt,
        })),
      oneTimePreKeys: Array.from(this.oneTimePreKeys.values())
        .sort((a, b) => a.keyId - b.keyId)
        .map((r) => ({ keyId: r.keyId, pub: b64(r.pub), priv: b64(r.priv) })),
      sessions,
      sentLog: this.sentLog.map((e) => ({ ...e })),
      meta: Object.fromEntries(this.meta),
    };
  }

  async restore(dump: StoreDump): Promise<void> {
    if (dump.version !== 1) {
      throw new Error(`unsupported store dump version: ${dump.version}`);
    }
    this.wipeSync();
    if (dump.identity) {
      this.identity = {
        userId: dump.identity.userId,
        deviceId: dump.identity.deviceId,
        registrationId: dump.identity.registrationId,
        identityPub: unb64(dump.identity.identityPub),
        identityPriv: unb64(dump.identity.identityPriv),
        createdAt: dump.identity.createdAt,
      };
    }
    for (const r of dump.signedPreKeys) {
      this.signedPreKeys.set(r.keyId, {
        keyId: r.keyId,
        pub: unb64(r.pub),
        priv: unb64(r.priv),
        signature: unb64(r.signature),
        createdAt: r.createdAt,
      });
    }
    for (const r of dump.oneTimePreKeys) {
      this.oneTimePreKeys.set(r.keyId, {
        keyId: r.keyId,
        pub: unb64(r.pub),
        priv: unb64(r.priv),
      });
    }
    for (const [addr, s] of Object.entries(dump.sessions)) {
      this.sessions.set(addr, cloneSession(s));
    }
    this.sentLog = dump.sentLog.map((e) => ({ ...e }));
    this.meta = new Map(Object.entries(dump.meta));
  }

  async wipe(): Promise<void> {
    this.wipeSync();
  }

  private wipeSync(): void {
    this.identity = null;
    this.signedPreKeys.clear();
    this.oneTimePreKeys.clear();
    this.sessions.clear();
    this.sentLog = [];
    this.meta.clear();
  }
}
