"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";

const WISHLIST_KEY = "staynest-wishlist";

function getLocalWishlist(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(WISHLIST_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

const setLocalWishlist = (set: Set<string>) =>
  localStorage.setItem(WISHLIST_KEY, JSON.stringify([...set]));

export function useWishlist() {
  const { supabase, userId } = useAuth();
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (supabase && userId) {
      try {
        const { data, error } = await supabase.from("wishlists").select("stay_id").eq("user_id", userId);
        if (!error) {
          setWishlist(new Set((data || []).map((row) => row.stay_id as string)));
          return;
        }
      } catch {
        // fall through to local
      }
    }
    setWishlist(getLocalWishlist());
  }, [supabase, userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount
    load();
  }, [load]);

  const toggle = useCallback(
    async (stayId: string) => {
      const id = String(stayId);
      const wasSaved = wishlist.has(id);
      const optimistic = new Set(wishlist);
      if (wasSaved) {
        optimistic.delete(id);
      } else {
        optimistic.add(id);
      }
      setWishlist(optimistic);
      if (!(supabase && userId)) {
        setLocalWishlist(optimistic);
        return;
      }
      try {
        if (wasSaved) {
          await supabase.from("wishlists").delete().eq("user_id", userId).eq("stay_id", id);
        } else {
          await supabase.from("wishlists").insert({ user_id: userId, stay_id: id });
        }
      } catch {
        setWishlist(wishlist);
      }
    },
    [supabase, userId, wishlist]
  );

  return { wishlist, toggle, reload: load };
}
