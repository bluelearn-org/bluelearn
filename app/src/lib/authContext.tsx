import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "@tanstack/react-router";

import { getSession, onAuthStateChange } from "./auth";
import { getMyIdentity } from "./api/identity";
import type { Session, User } from "@supabase/supabase-js";

type CurrentProfile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  is_suspended: boolean;
};

export type SuspensionStatus =
  | "pending"
  | "suspended"
  | "active"
  | "unavailable";

type AuthState = {
  session: Session | null;
  user: User | null;
  roles: Array<string>;
  currentProfile: CurrentProfile | null;
  loading: boolean;
  rolesLoading: boolean;
  identityError: boolean;
  refreshIdentity: () => void;
};

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  roles: [],
  currentProfile: null,
  loading: true,
  rolesLoading: true,
  identityError: false,
  refreshIdentity: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<Array<string>>([]);
  const [currentProfile, setCurrentProfile] = useState<CurrentProfile | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [identityError, setIdentityError] = useState(false);
  const [identityVersion, setIdentityVersion] = useState(0);
  const identityUserRef = useRef<string | null>(null);
  const refreshIdentity = useCallback(() => {
    setIdentityVersion((version) => version + 1);
  }, []);

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

  // Roles and profile details need their own fetch because they aren't included in JWT.
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) {
      setRoles([]);
      setCurrentProfile(null);
      identityUserRef.current = null;
      setRolesLoading(loading);
      setIdentityError(false);
      return;
    }

    const controller = new AbortController();
    const isInitialIdentityLoad = identityUserRef.current !== userId;
    setRolesLoading(isInitialIdentityLoad);
    setIdentityError(false);

    getMyIdentity({ signal: controller.signal })
      .then((data) => {
        setRoles(data.roles);
        setCurrentProfile(data.profile);
        identityUserRef.current = userId;
        setIdentityError(false);
      })
      .catch(() => {
        if (controller.signal.aborted || !isInitialIdentityLoad) return;

        setRoles([]);
        setCurrentProfile(null);
        setIdentityError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setRolesLoading(false);
      });

    return () => controller.abort();
  }, [userId, loading, identityVersion]);

  useEffect(() => {
    if (!userId) return;

    window.addEventListener("focus", refreshIdentity);
    window.addEventListener("bluelearn:account-status-stale", refreshIdentity);

    return () => {
      window.removeEventListener("focus", refreshIdentity);
      window.removeEventListener(
        "bluelearn:account-status-stale",
        refreshIdentity
      );
    };
  }, [userId, refreshIdentity]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        roles,
        currentProfile,
        loading,
        rolesLoading,
        identityError,
        refreshIdentity,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useRequireRole(role: string | Array<string>) {
  const { session, roles, loading, rolesLoading } = useAuth();
  const navigate = useNavigate();
  const resolving = loading || rolesLoading;

  useEffect(() => {
    if (!resolving && !session) navigate({ to: "/login" });
  }, [resolving, session, navigate]);

  if (resolving || !session) return "pending" as const;

  const allowed = Array.isArray(role) ? role : [role];
  return allowed.some((r) => roles.includes(r))
    ? ("allowed" as const)
    : ("not-found" as const);
}

// Authoring gates read this instead of the raw profile so a signed-in user is
// "pending" until /me answers.
// Signed-out visitors are "active": the public surface does not change for them.
export function useSuspensionStatus(): SuspensionStatus {
  const { session, currentProfile, loading, rolesLoading, identityError } =
    useAuth();

  if (loading || (session && rolesLoading)) return "pending";
  if (session && identityError) return "unavailable";
  if (session && !currentProfile) return "pending";

  return currentProfile?.is_suspended ? "suspended" : "active";
}

// Redirect already-authed users away from auth-only pages (login, register).
export function useRedirectIfAuthed(to = "/") {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  // getSession and onAuthStateChange both land a session with a fresh object.
  // This could cause the object to fire a second navigate that cancels the
  // first one's loader mid-flight and blanks the page.
  useEffect(() => {
    if (!loading && session) navigate({ to });
  }, [loading, Boolean(session), navigate, to]);
}
