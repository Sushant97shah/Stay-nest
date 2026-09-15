"use client";

import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export interface UserSession {
  name: string;
  email?: string;
  phone?: string;
  role: "tenant" | "owner";
  accessToken?: string;
}

interface AuthContextValue {
  session: UserSession | null;
  supabase: SupabaseClient | null;
  userId: string | null;
  configured: boolean;
  loading: boolean;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const isConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState<SupabaseClient | null>(() => (isConfigured ? createClient() : null));
  const [session, setSession] = useState<UserSession | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(isConfigured);

  const applyUser = useCallback(
    (user: User | null | undefined, accessToken?: string) => {
      if (!user) {
        setSession(null);
        setUserId(null);
        return;
      }
      const metaRole = user.user_metadata?.role as "tenant" | "owner" | undefined;
      const role: "tenant" | "owner" = metaRole || (user.email && !user.phone ? "owner" : "tenant");
      const name = user.user_metadata?.full_name || user.email || "Resident";
      setUserId(user.id);
      setSession({
        name,
        email: user.email ?? undefined,
        phone: user.phone ?? undefined,
        role,
        accessToken,
      });
      if (role === "tenant" && supabase) {
        supabase
          .from("profiles")
          .upsert({
            id: user.id,
            full_name: name,
            role: "tenant",
            ...(user.phone ? { phone: user.phone } : {}),
            ...(user.email ? { email: user.email } : {}),
            updated_at: new Date().toISOString(),
          })
          .then(
            () => {},
            () => {}
          );
      }
    },
    [supabase]
  );

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      applyUser(data.session?.user, data.session?.access_token);
      setLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, changedSession) => {
      applyUser(changedSession?.user, changedSession?.access_token);
    });
    return () => subscription.subscription.unsubscribe();
  }, [supabase, applyUser]);

  const refreshSession = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    applyUser(data.session?.user, data.session?.access_token);
  }, [supabase, applyUser]);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut().catch(() => {});
    setSession(null);
    setUserId(null);
  }, [supabase]);

  return (
    <AuthContext.Provider
      value={{ session, supabase, userId, configured: isConfigured, loading, refreshSession, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
