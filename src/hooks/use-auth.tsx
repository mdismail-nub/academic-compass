import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery, rolesQuery } from "@/lib/api";
import type { AppRole, Profile } from "@/lib/types";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  isAdmin: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initialising, setInitialising] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        queryClient.invalidateQueries({ queryKey: ["profile"] });
        queryClient.invalidateQueries({ queryKey: ["roles"] });
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitialising(false);
    });

    return () => subscription.subscription.unsubscribe();
  }, [queryClient]);

  const userId = session?.user.id ?? null;
  const { data: profile, isLoading: profileLoading } = useQuery(profileQuery(userId));
  const { data: roleRows, isLoading: rolesLoading } = useQuery(rolesQuery(userId));

  const value = useMemo<AuthContextValue>(() => {
    const roles = (roleRows ?? []).map((row) => row.role);
    return {
      session,
      user: session?.user ?? null,
      profile: profile ?? null,
      roles,
      isAdmin: roles.includes("admin"),
      isLoading: initialising || (Boolean(userId) && (profileLoading || rolesLoading)),
      signOut: async () => {
        await queryClient.cancelQueries();
        queryClient.clear();
        await supabase.auth.signOut();
      },
    };
  }, [session, profile, roleRows, initialising, profileLoading, rolesLoading, userId, queryClient]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
