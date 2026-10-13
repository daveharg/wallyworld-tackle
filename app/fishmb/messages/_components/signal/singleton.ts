"use client";

// Per-user SignalClient singleton for the Messages UI.
//
// The init PROMISE is cached (keyed by userId) so concurrent mounts /
// hook calls share one device lifecycle run — registration must happen
// exactly once. Storage is IdbStore in the browser; if IndexedDB is
// unavailable (private mode quirks, very old webviews) we fall back to
// an in-memory store so messaging still works for the session (the
// next launch will look "wiped" and can offer backup restore).

import { useEffect, useState } from "react";
import { SignalClient, type InitResult } from "./client";
import { IdbStore } from "./idbStore";
import { InMemoryStore } from "./store-memory";
import { fishTransport } from "./transport";
import type { SignalStore } from "./types";

const initCache = new Map<string, Promise<InitResult>>();
const resolvedClients = new Map<string, SignalClient>();

function buildStore(): SignalStore {
  try {
    return new IdbStore();
  } catch {
    return new InMemoryStore();
  }
}

/** Get (or start) the shared SignalClient init for this user. */
export function getSignalClient(userId: string): Promise<InitResult> {
  const cached = initCache.get(userId);
  if (cached) return cached;
  const promise = SignalClient.init(userId, buildStore(), fishTransport());
  initCache.set(userId, promise);
  promise.then(
    (result) => {
      resolvedClients.set(userId, result.client);
    },
    () => {
      // Don't cache a failed init forever — the next call retries.
      if (initCache.get(userId) === promise) initCache.delete(userId);
    }
  );
  return promise;
}

/** The already-initialized client for this user, or null if init hasn't
 *  finished (or hasn't been started). For fire-and-forget callers like
 *  sendSpot that run outside the Messages page lifecycle. */
export function peekSignalClient(userId: string): SignalClient | null {
  return resolvedClients.get(userId) ?? null;
}

/** React hook: the InitResult once getSignalClient resolves, else null
 *  (including while userId is null/undefined — signed out). */
export function useSignalClient(
  userId: string | null | undefined
): InitResult | null {
  const [state, setState] = useState<{
    userId: string;
    result: InitResult;
  } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    getSignalClient(userId)
      .then((result) => {
        if (alive) setState({ userId, result });
      })
      .catch(() => {
        // Init failure surfaces through the page's own retry path;
        // the hook simply stays null.
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  if (!userId) return null;
  return state && state.userId === userId ? state.result : null;
}
