"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import type { ShopifyPrice } from "../lib/shopify";

export interface CartItem {
  variantId: string;
  productHandle: string;
  productTitle: string;
  variantLabel: string;
  imageUrl: string | null;
  price: ShopifyPrice;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotal: number;
  currencyCode: string;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (variantId: string) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  clear: () => void;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "wallyworld-cart-v1";

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mergeCarts(a: CartItem[], b: CartItem[]): CartItem[] {
  const map = new Map<string, CartItem>();
  for (const item of [...a, ...b]) {
    if (!item || typeof item.variantId !== "string") continue;
    const existing = map.get(item.variantId);
    if (existing) {
      existing.quantity = Math.min(99, existing.quantity + (item.quantity || 1));
    } else {
      map.set(item.variantId, { ...item, quantity: Math.max(1, item.quantity || 1) });
    }
  }
  return Array.from(map.values());
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [serverSynced, setServerSynced] = useState(false);
  const syncingRef = useRef(false);

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  // Load local cart on mount.
  useEffect(() => {
    setItems(loadCart());
  }, []);

  // Persist to localStorage on every change.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // storage unavailable — cart still works in memory
    }
  }, [items]);

  // When the user signs in: merge the server-saved cart with the local cart.
  useEffect(() => {
    if (status !== "authenticated" || serverSynced || syncingRef.current) return;
    syncingRef.current = true;
    (async () => {
      try {
        const res = await fetch("/api/cart");
        if (res.ok) {
          const data = await res.json();
          const serverItems: CartItem[] = Array.isArray(data.items) ? data.items : [];
          const merged = mergeCarts(serverItems, loadCart());
          setItems(merged);
          // Push the merged cart back so other devices see it.
          await fetch("/api/cart", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: merged }),
          });
        }
      } catch {
        // offline or DB unavailable — local cart still works
      } finally {
        setServerSynced(true);
        syncingRef.current = false;
      }
    })();
  }, [status, serverSynced]);

  // Reset the sync flag on sign-out so the next login re-merges.
  useEffect(() => {
    if (status === "unauthenticated") setServerSynced(false);
  }, [status]);

  // Push cart changes to the server (debounced) while signed in.
  useEffect(() => {
    if (status !== "authenticated" || !serverSynced) return;
    const t = setTimeout(() => {
      fetch("/api/cart", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [items, status, serverSynced]);

  const addItem = useCallback((item: Omit<CartItem, "quantity">, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.variantId === item.variantId);
      if (existing) {
        return prev.map((i) =>
          i.variantId === item.variantId ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...prev, { ...item, quantity }];
    });
  }, []);

  const removeItem = useCallback((variantId: string) => {
    setItems((prev) => prev.filter((i) => i.variantId !== variantId));
  }, []);

  const setQuantity = useCallback((variantId: string, quantity: number) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.variantId !== variantId)
        : prev.map((i) => (i.variantId === variantId ? { ...i, quantity } : i))
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((n, i) => n + i.quantity, 0);
    const subtotal = items.reduce((n, i) => n + parseFloat(i.price.amount) * i.quantity, 0);
    const currencyCode = items[0]?.price.currencyCode ?? "CAD";
    return {
      items,
      count,
      subtotal,
      currencyCode,
      addItem,
      removeItem,
      setQuantity,
      clear,
      isDrawerOpen,
      openDrawer,
      closeDrawer,
    };
  }, [items, addItem, removeItem, setQuantity, clear, isDrawerOpen, openDrawer, closeDrawer]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
