import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { User, Session } from "@supabase/supabase-js";
import { useGetMe, getGetMeQueryKey, type User as ApiUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: ApiUser | null;
  isLoading: boolean;
  signIn: (email: string, password?: string) => Promise<void>;
  signUp: (email: string, password?: string, inviteCode?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoadingSession(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const { data: profile, isLoading: isLoadingProfile } = useGetMe({
    query: {
      enabled: !!session,
      queryKey: getGetMeQueryKey(),
      retry: false,
    }
  });

  const signIn = async (email: string, password?: string) => {
    if (password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } else {
      // Magic link or similar could go here if needed
    }
  };

  const signUp = async (email: string, password?: string, inviteCode?: string) => {
    if (!password) throw new Error("Password required");
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: inviteCode ? { invite_code: inviteCode } : undefined
      }
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    queryClient.clear();
  };

  const isLoading = isLoadingSession || (!!session && isLoadingProfile);

  return (
    <AuthContext.Provider value={{ session, user, profile: profile ?? null, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
