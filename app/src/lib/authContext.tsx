import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { getSession, onAuthStateChange } from "./auth";
import { getMyIdentity } from "./api/identity";
import type { Session, User } from "@supabase/supabase-js";

type AuthState = {
  session: Session | null;
  user: User | null;
  roles: Array<string>;
  loading: boolean;
  rolesLoading: boolean;
};

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  roles: [],
  loading: true,
  rolesLoading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<Array<string>>([]);
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Roles need their own fetch because they aren't included in JWT.
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) {
      setRoles([]);
      setRolesLoading(loading);
      return;
    }

    const controller = new AbortController();
    setRolesLoading(true);

    getMyIdentity({ signal: controller.signal })
      .then((data) => setRoles(data.roles))
      .catch(() => setRoles([]))
      .finally(() => {
        if (!controller.signal.aborted) setRolesLoading(false);
      });

    return () => controller.abort();
  }, [userId, loading]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        roles,
        loading,
        rolesLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useRequireRole(role: string) {
  const { session, roles, loading, rolesLoading } = useAuth();
  const navigate = useNavigate();
  const resolving = loading || rolesLoading;

  useEffect(() => {
    if (!resolving && !session) navigate({ to: "/login" });
  }, [resolving, session, navigate]);

  if (resolving || !session) return "pending" as const;
  return roles.includes(role) ? ("allowed" as const) : ("not-found" as const);
}

// Redirect already-authed users away from auth-only pages (login, register).
export function useRedirectIfAuthed(to = "/") {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate({ to });
  }, [loading, session, navigate, to]);
}
