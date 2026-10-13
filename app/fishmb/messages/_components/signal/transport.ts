// HTTP transport for the Signal device/prekey/backup APIs.
//
// This module is the home of the SigTransport interface: client.ts codes
// against the interface, tests substitute an in-memory fake server, and
// fishTransport() is the real implementation over fishFetch (which adds
// the FishMB session token).
//
// Wire format is snake_case (device_id, identity_key, ...); this module
// maps to/from the camelCase shapes in types.ts.

import { fishFetch } from "../../../_components/fishFetch";
import type { DeviceInfo, PreKeyBundle } from "./types";

// ------------------------------------------------------------ wire payloads

export interface SignedPreKeyWire {
  key_id: number;
  key: string; // base64 X25519 pub
  signature: string; // base64 Ed25519 signature over the pub
}

export interface OneTimePreKeyWire {
  key_id: number;
  key: string; // base64 X25519 pub
}

/** Body of POST /api/fishmb/sig/devices. */
export interface RegisterDevicePayload {
  device_id: number;
  identity_key: string; // base64 Ed25519 pub
  registration_id: number;
  signed_prekey: SignedPreKeyWire;
  one_time_prekeys: OneTimePreKeyWire[];
}

/** Body of POST /api/fishmb/sig/prekeys (device_id added by transport). */
export interface PostPrekeysPayload {
  one_time_prekeys?: OneTimePreKeyWire[];
  signed_prekey?: SignedPreKeyWire;
}

/** Body of PUT /api/fishmb/sig/backup. */
export interface UploadBackupPayload {
  device_id: number;
  ciphertext: string;
  salt: string;
  kdf: string;
  signature: string;
}

export interface BackupMeta {
  exists: boolean;
  updatedAt: string | null;
  deviceId: number;
}

export interface BackupDownload {
  ciphertext: string;
  salt: string;
  kdf: string;
  deviceId: number;
}

// ------------------------------------------------------------ interface

export interface SigTransport {
  registerDevice(payload: RegisterDevicePayload): Promise<void>;
  fetchBundle(userId: string, deviceId: number): Promise<PreKeyBundle>;
  listDevices(userId: string): Promise<DeviceInfo[]>;
  prekeyCount(deviceId: number): Promise<number>;
  postPrekeys(
    deviceId: number,
    payload: PostPrekeysPayload
  ): Promise<{ remaining: number }>;
  backupMeta(deviceId: number): Promise<BackupMeta>;
  uploadBackup(payload: UploadBackupPayload): Promise<void>;
  /** Null when the server has no backup for this device. */
  downloadBackup(deviceId: number): Promise<BackupDownload | null>;
}

// ------------------------------------------------------------ mapping helpers

/* eslint-disable @typescript-eslint/no-explicit-any */

function normalizeDevice(raw: any): DeviceInfo {
  return {
    deviceId: Number(raw.deviceId ?? raw.device_id),
    identityKey: raw.identityKey ?? raw.identity_key,
    registrationId: Number(raw.registrationId ?? raw.registration_id),
  };
}

function normalizeBundle(raw: any): PreKeyBundle {
  const spk = raw.signedPreKey ?? raw.signed_prekey ?? {};
  const opk = raw.oneTimePreKey ?? raw.one_time_prekey ?? null;
  return {
    userId: raw.userId ?? raw.user_id,
    deviceId: Number(raw.deviceId ?? raw.device_id),
    registrationId: Number(raw.registrationId ?? raw.registration_id),
    identityKey: raw.identityKey ?? raw.identity_key,
    signedPreKey: {
      keyId: Number(spk.keyId ?? spk.key_id),
      key: spk.key,
      signature: spk.signature,
    },
    oneTimePreKey: opk
      ? { keyId: Number(opk.keyId ?? opk.key_id), key: opk.key }
      : null,
  };
}

// ------------------------------------------------------------ real transport

export function fishTransport(): SigTransport {
  const jsonInit = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return {
    async registerDevice(payload) {
      await fishFetch("/api/fishmb/sig/devices", jsonInit("POST", payload));
    },

    async fetchBundle(userId, deviceId) {
      const data = await fishFetch(
        `/api/fishmb/sig/bundle?user_id=${encodeURIComponent(userId)}&device_id=${deviceId}`
      );
      return normalizeBundle(data);
    },

    async listDevices(userId) {
      const data = (await fishFetch(
        `/api/fishmb/sig/devices?user_id=${encodeURIComponent(userId)}`
      )) as { devices?: any[] };
      return (data.devices ?? []).map(normalizeDevice);
    },

    async prekeyCount(deviceId) {
      const data = (await fishFetch(
        `/api/fishmb/sig/prekeys?device_id=${deviceId}`
      )) as { remaining?: number };
      return Number(data.remaining ?? 0);
    },

    async postPrekeys(deviceId, payload) {
      const data = (await fishFetch(
        "/api/fishmb/sig/prekeys",
        jsonInit("POST", { device_id: deviceId, ...payload })
      )) as { remaining?: number };
      return { remaining: Number(data.remaining ?? 0) };
    },

    async backupMeta(deviceId) {
      const data = (await fishFetch(
        `/api/fishmb/sig/backup?device_id=${deviceId}`
      )) as any;
      return {
        exists: !!data.exists,
        updatedAt: data.updated_at ?? data.updatedAt ?? null,
        deviceId: Number(data.device_id ?? data.deviceId ?? deviceId),
      };
    },

    async uploadBackup(payload) {
      await fishFetch("/api/fishmb/sig/backup", jsonInit("PUT", payload));
    },

    async downloadBackup(deviceId) {
      const data = (await fishFetch(
        `/api/fishmb/sig/backup?device_id=${deviceId}&download=1`
      )) as any;
      if (!data || data.exists === false || !data.ciphertext) return null;
      return {
        ciphertext: data.ciphertext,
        salt: data.salt,
        kdf: data.kdf,
        deviceId: Number(data.device_id ?? data.deviceId ?? deviceId),
      };
    },
  };
}
