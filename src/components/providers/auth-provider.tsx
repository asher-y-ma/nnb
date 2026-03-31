"use client";

import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface AuthUserSummary {
  id: string;
  email: string | null;
  isAnonymous: boolean;
}

interface AuthContextValue {
  client: SupabaseClient | null;
  isConfigured: boolean;
  isLoading: boolean;
  session: Session | null;
  user: AuthUserSummary | null;
}

const AuthContext = createContext<AuthContextValue>({
  client: null,
  isConfigured: false,
  isLoading: false,
  session: null,
  user: null,
});

function toUserSummary(user: User | null): AuthUserSummary | null {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? null,
    isAnonymous: user.is_anonymous ?? false,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => createSupabaseBrowserClient());
  const [isLoading, setIsLoading] = useState(Boolean(client));
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!client) {
      return;
    }

    let isActive = true;

    client.auth.getSession().then(({ data }) => {
      if (!isActive) {
        return;
      }

      setSession(data.session ?? null);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!isActive) {
        return;
      }

      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [client]);

  const value = useMemo<AuthContextValue>(
    () => ({
      client,
      isConfigured: Boolean(client),
      isLoading,
      session,
      user: toUserSummary(session?.user ?? null),
    }),
    [client, isLoading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSupabaseAuth() {
  return useContext(AuthContext);
}
