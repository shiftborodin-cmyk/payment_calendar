import type { Session, User } from "@supabase/supabase-js";
import { Platform } from "react-native";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { getSupabaseClient, supabaseConfigError } from "@/shared/api/supabase";

import { mapAuthError } from "./mapAuthError";

type AuthResult = {
  error: string | null;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const webLocalUser = {
  id: "local-web-user",
  email: "друг"
} as User;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (Platform.OS === "web") {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const supabase = supabaseConfigError ? null : getSupabaseClient();

    if (!supabase) {
      setIsLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (isMounted) {
        setSession(currentSession);
        setIsLoading(false);
      }
    }).catch(() => {
      if (isMounted) {
        setSession(null);
        setIsLoading(false);
      }
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: Platform.OS === "web" ? webLocalUser : session?.user ?? null,
      isAuthenticated: Platform.OS === "web" || Boolean(session),
      isLoading,
      async signIn(email, password) {
        if (supabaseConfigError) {
          return { error: supabaseConfigError };
        }

        const supabase = getSupabaseClient();
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        return {
          error: error ? mapAuthError(error.message) : null
        };
      },
      async signUp(email, password) {
        if (supabaseConfigError) {
          return { error: supabaseConfigError };
        }

        const supabase = getSupabaseClient();
        const { error } = await supabase.auth.signUp({ email, password });

        return {
          error: error ? mapAuthError(error.message) : null
        };
      },
      async signOut() {
        if (Platform.OS === "web") {
          return;
        }

        if (supabaseConfigError) {
          setSession(null);
          return;
        }

        const supabase = getSupabaseClient();
        await supabase.auth.signOut();
      }
    }),
    [session, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
