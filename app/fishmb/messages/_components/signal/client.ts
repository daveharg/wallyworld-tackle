// SignalClient: the facade the UI talks to. One client per (user,
// device store). init() runs the full device lifecycle:
//
//   fresh identity in store -> register with the server, done.
//   existing identity       -> confirm the server knows this device:
//       no server row            -> register (server state was reset).
//       row under OTHER identity -> deviceId collision: wipe the store,
//                                   mint a brand-new device, register it.
//       row matches              -> top up one-time prekeys if the server
//                                   pool is low; rotate the signed prekey
//                                   if stale and upload the new one.
//   wiped store (marker only) -> new device was already minted by
//       device.ts; after registering it, init reports whether the OLD
//       device has a server backup the user can restore from.
//
// Encryption itself lives in SessionManager (session.ts); this class
// owns identity, server sync, backups and the local sent log.

import { b64, str, utf8 } from "./bytes";
import { edSign, sha256Hash } from "./crypto";
import { encodeEnvelope } from "./envelope";
import {
  generateOneTimePreKeys,
  loadOrCreateDevice,
  markOneTimePreKeysUploaded,
  pendingOneTimePreKeys,
  readDeviceMarker,
  registrationPayload,
  rotateSignedPreKeyIfStale,
  createFreshDevice,
  syncMarker,
} from "./device";
import { backupUploadMessage, decryptBackup, encryptBackup } from "./backup";
import { SessionManager } from "./session";
import {
  addressOf,
  parseAddress,
  type IdentityRecord,
  type SentLogEntry,
  type SigEnvelope,
  type SignalStore,
} from "./types";
import type { SigTransport } from "./transport";

/** Server one-time-prekey pool is topped up when it drops below this. */
const PREKEY_LOW_WATERMARK = 25;
/** One-time prekeys generated per top-up batch. */
const PREKEY_TOPUP_BATCH = 50;
/** Meta key holding the decrypted-plaintext cache (JSON {order, map}). */
const PT_CACHE_META_KEY = "ptcache:v1";
/** Cap on cached plaintexts; the oldest are evicted first. */
const PT_CACHE_MAX = 500;

export type InitStatus =
  | "fresh"
  | "ok"
  | "wiped-backup-available"
  | "wiped-no-backup";

export interface InitResult {
  client: SignalClient;
  status: InitStatus;
  /** Set on the wiped statuses: the deviceId that was lost. */
  oldDeviceId?: number;
}

export class SignalClient {
  readonly userId: string;
  private readonly store: SignalStore;
  private readonly transport: SigTransport;
  private readonly manager: SessionManager;
  private identity: IdentityRecord;

  private constructor(
    userId: string,
    store: SignalStore,
    transport: SigTransport,
    identity: IdentityRecord
  ) {
    this.userId = userId;
    this.store = store;
    this.transport = transport;
    this.identity = identity;
    this.manager = new SessionManager(store);
  }

  // ------------------------------------------------------------ init / lifecycle

  static async init(
    userId: string,
    store: SignalStore,
    transport: SigTransport
  ): Promise<InitResult> {
    // Capture the pre-lifecycle marker: loadOrCreateDevice overwrites
    // it when the store was wiped, and the OLD deviceId is where any
    // restorable backup lives.
    const markerBefore = readDeviceMarker(userId);
    const lifecycle = await loadOrCreateDevice(store, userId);
    const client = new SignalClient(
      userId,
      store,
      transport,
      lifecycle.identity
    );

    if (lifecycle.isNewIdentity) {
      await client.registerWithServer();
      if (lifecycle.status === "wiped") {
        const oldDeviceId =
          markerBefore?.deviceId ?? lifecycle.oldDeviceId;
        if (oldDeviceId != null && oldDeviceId !== client.deviceId) {
          const hasBackup = await client
            .backupExistsFor(oldDeviceId)
            .catch(() => false);
          return {
            client,
            status: hasBackup
              ? "wiped-backup-available"
              : "wiped-no-backup",
            oldDeviceId,
          };
        }
        return { client, status: "wiped-no-backup" };
      }
      return { client, status: "fresh" };
    }

    // Existing identity: make sure the server knows this device.
    const devices = await transport.listDevices(userId);
    const mine = devices.find((d) => d.deviceId === client.deviceId);

    if (!mine) {
      // Server has no row for us (fresh server state) — register.
      await client.registerWithServer();
      return { client, status: "ok" };
    }

    if (mine.identityKey !== client.identityPubB64) {
      // This deviceId is registered under a DIFFERENT identity: our
      // store was wiped AND localStorage was cleared, then a random
      // deviceId collided (or a stale marker was restored). Our local
      // identity can never match that server row — abandon it, wipe,
      // and start over with a brand-new device.
      const oldDeviceId = client.deviceId;
      await store.wipe();
      const identity = await createFreshDevice(store, userId, oldDeviceId);
      client.identity = identity;
      await client.registerWithServer();
      const hasBackup = await client
        .backupExistsFor(oldDeviceId)
        .catch(() => false);
      return {
        client,
        status: hasBackup ? "wiped-backup-available" : "wiped-no-backup",
        oldDeviceId,
      };
    }

    // Server row matches our identity: maintenance only.
    await client.topUpPreKeys();
    await client.rotateSignedPreKeyIfNeeded();
    return { client, status: "ok" };
  }

  /** POST the registration payload and advance the OTP watermark. */
  private async registerWithServer(): Promise<void> {
    const payload = await registrationPayload(this.store, this.identity);
    await this.transport.registerDevice(payload);
    if (payload.one_time_prekeys.length > 0) {
      const through = Math.max(
        ...payload.one_time_prekeys.map((r) => r.key_id)
      );
      await markOneTimePreKeysUploaded(this.store, through);
    }
  }

  /** If the server's one-time-prekey pool for this device is running
   *  low, generate a fresh batch and upload everything pending. */
  private async topUpPreKeys(): Promise<void> {
    const remaining = await this.transport.prekeyCount(this.deviceId);
    if (remaining >= PREKEY_LOW_WATERMARK) return;
    await generateOneTimePreKeys(this.store, PREKEY_TOPUP_BATCH);
    const pending = await pendingOneTimePreKeys(this.store);
    if (pending.length === 0) return;
    await this.transport.postPrekeys(this.deviceId, {
      one_time_prekeys: pending.map((r) => ({
        key_id: r.keyId,
        key: b64(r.pub),
      })),
    });
    await markOneTimePreKeysUploaded(
      this.store,
      Math.max(...pending.map((r) => r.keyId))
    );
  }

  /** Rotate the signed prekey if stale; upload the new one if rotated. */
  private async rotateSignedPreKeyIfNeeded(): Promise<void> {
    const before = await this.store.getCurrentSignedPreKey();
    const current = await rotateSignedPreKeyIfStale(
      this.store,
      this.identity
    );
    if (before && current.keyId !== before.keyId) {
      await this.transport.postPrekeys(this.deviceId, {
        signed_prekey: {
          key_id: current.keyId,
          key: b64(current.pub),
          signature: b64(current.signature),
        },
      });
    }
  }

  // ------------------------------------------------------------ identity getters

  get deviceId(): number {
    return this.identity.deviceId;
  }

  get registrationId(): number {
    return this.identity.registrationId;
  }

  get identityPubB64(): string {
    return b64(this.identity.identityPub);
  }

  // ------------------------------------------------------------ devices & sessions

  devicesOf(userId: string) {
    return this.transport.listDevices(userId);
  }

  /** Encrypt a text message for one specific device of a user,
   *  establishing a session from the server bundle if needed. */
  async encryptToDevice(
    toUserId: string,
    toDeviceId: number,
    plaintext: string
  ): Promise<SigEnvelope> {
    const addr = addressOf(toUserId, toDeviceId);
    if (!(await this.manager.hasSession(addr))) {
      const bundle = await this.transport.fetchBundle(toUserId, toDeviceId);
      await this.manager.startSession(this.identity, bundle);
    }
    return this.manager.encrypt(this.identity, addr, utf8(plaintext));
  }

  /** Decrypt one envelope copy addressed to this device. DecryptFailure
   *  propagates to the caller (the UI renders it as a typed notice).
   *
   *  Successful plaintexts are cached by envelope hash first: a Double
   *  Ratchet message key exists exactly once, so the same copy can
   *  never be ratchet-decrypted twice — yet the UI legitimately reads
   *  copies more than once (the conversation list's preview decrypts
   *  the last message, then the thread decrypts it again on open, and
   *  again on every reload). Cache hits return the plaintext without
   *  touching the ratchet, so repeat reads can never fail, burn a
   *  message key, or inflate the session's fail counter. */
  async decryptCopy(fromUserId: string, env: SigEnvelope): Promise<string> {
    const cacheId = b64(sha256Hash(utf8(encodeEnvelope(env))));
    const cached = await this.readPlaintextCache(cacheId);
    if (cached !== null) return cached;
    const addr = addressOf(fromUserId, env.fd);
    const bytes = await this.manager.decrypt(this.identity, addr, env);
    const text = str(bytes);
    await this.writePlaintextCache(cacheId, text);
    return text;
  }

  private async readPlaintextCache(
    cacheId: string
  ): Promise<string | null> {
    try {
      const raw = await this.store.getMeta(PT_CACHE_META_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        map?: Record<string, string>;
      };
      const v = parsed.map?.[cacheId];
      return typeof v === "string" ? v : null;
    } catch {
      return null;
    }
  }

  private async writePlaintextCache(
    cacheId: string,
    text: string
  ): Promise<void> {
    try {
      let order: string[] = [];
      let map: Record<string, string> = {};
      const raw = await this.store.getMeta(PT_CACHE_META_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          order?: string[];
          map?: Record<string, string>;
        };
        if (Array.isArray(parsed.order)) order = parsed.order;
        if (parsed.map && typeof parsed.map === "object") {
          map = parsed.map;
        }
      }
      if (!(cacheId in map)) order.push(cacheId);
      map[cacheId] = text;
      while (order.length > PT_CACHE_MAX) {
        const old = order.shift();
        if (old) delete map[old];
      }
      await this.store.setMeta(
        PT_CACHE_META_KEY,
        JSON.stringify({ order, map })
      );
    } catch {
      // The cache is an optimization — never fail a decrypt over it.
    }
  }

  /** If the peer reset this session (a PreKeyMessage replaced a live
   *  session), consume the flag so the UI shows its notice once. */
  async consumePeerReset(userId: string, deviceId: number): Promise<boolean> {
    const addr = addressOf(userId, deviceId);
    const record = await this.manager.getRecord(addr);
    if (!record || !record.peerResetAt) return false;
    record.peerResetAt = null;
    await this.store.saveSession(addr, record);
    return true;
  }

  async sessionFailCount(userId: string, deviceId: number): Promise<number> {
    const record = await this.manager.getRecord(
      addressOf(userId, deviceId)
    );
    return record?.failCount ?? 0;
  }

  /** Delete every session with any device of this user. */
  async resetSessionsWith(userId: string): Promise<void> {
    const addrs = await this.store.listSessions();
    for (const addr of addrs) {
      if (parseAddress(addr).userId === userId) {
        await this.manager.deleteSession(addr);
      }
    }
  }

  /** Ensure a session exists with every device of this user (used
   *  after a reset so the next send doesn't start from a bundle fetch
   *  mid-flow). Devices whose bundle fetch fails are skipped. */
  async startFreshSessions(userId: string) {
    const devices = await this.devicesOf(userId);
    for (const device of devices) {
      if (userId === this.userId && device.deviceId === this.deviceId) {
        continue; // never session with ourselves
      }
      const addr = addressOf(userId, device.deviceId);
      if (await this.manager.hasSession(addr)) continue;
      try {
        const bundle = await this.transport.fetchBundle(
          userId,
          device.deviceId
        );
        await this.manager.startSession(this.identity, bundle);
      } catch {
        // Device unreachable / bundle gone — encryptToDevice will retry
        // (and surface the error) when an actual send is attempted.
      }
    }
    return devices;
  }

  // ------------------------------------------------------------ backups

  async hasServerBackup(): Promise<boolean> {
    return this.backupExistsFor(this.deviceId);
  }

  async backupExistsFor(deviceId: number): Promise<boolean> {
    const meta = await this.transport.backupMeta(deviceId);
    return meta.exists;
  }

  /** Existence + last-updated timestamp for a device backup (this
   *  device by default) — drives the Settings status line. */
  async backupInfo(
    deviceId: number = this.deviceId
  ): Promise<{ exists: boolean; updated_at: string | null }> {
    const meta = await this.transport.backupMeta(deviceId);
    return { exists: meta.exists, updated_at: meta.updatedAt };
  }

  /** Encrypt the whole store under `passphrase` and upload it, signed
   *  with this device's identity key. */
  async createBackup(passphrase: string): Promise<void> {
    const dump = await this.store.dump();
    const blob = encryptBackup(dump, passphrase);
    const message = backupUploadMessage(
      this.userId,
      this.deviceId,
      blob.ciphertext
    );
    const signature = b64(edSign(this.identity.identityPriv, message));
    await this.transport.uploadBackup({
      device_id: this.deviceId,
      ciphertext: blob.ciphertext,
      salt: blob.salt,
      kdf: blob.kdf,
      signature,
    });
  }

  /** Download + decrypt a backup (default: this device's) and restore
   *  it into the store. The restored identity must belong to the
   *  requested device. On success this client's identity is swapped to
   *  the restored one and the restored identity is returned. */
  async restoreFromBackup(
    passphrase: string,
    deviceId: number = this.deviceId
  ): Promise<IdentityRecord> {
    const download = await this.transport.downloadBackup(deviceId);
    if (!download) throw new Error("No backup found.");
    let dump;
    try {
      dump = decryptBackup(download, passphrase);
    } catch {
      throw new Error("That passphrase didn't work.");
    }
    if (!dump.identity || dump.identity.deviceId !== deviceId) {
      throw new Error("That backup belongs to a different device.");
    }
    await this.store.restore(dump);
    await syncMarker(this.store, this.userId);
    // The SessionManager reads identity per call from what we pass in,
    // so swapping this field is enough — no manager rebuild needed.
    const restored = await this.store.getIdentity();
    if (!restored) {
      throw new Error("Backup restored but no identity was found in it.");
    }
    this.identity = restored;
    return restored;
  }

  // ------------------------------------------------------------ sent log

  async logSent(
    conversationId: string,
    text: string,
    created_at: string
  ): Promise<void> {
    const entry: SentLogEntry = { conversationId, created_at, text };
    await this.store.appendSentLog(entry);
  }

  async sentLog(conversationId: string): Promise<SentLogEntry[]> {
    return this.store.getSentLog(conversationId);
  }
}
