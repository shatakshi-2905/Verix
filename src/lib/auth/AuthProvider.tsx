import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import * as auth from "./authService";
import type { AuthUser } from "./authService";

/** React binding around Supabase Auth sessions issued by the FastAPI backend. */

interface AuthContextValue {
  user: AuthUser | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<auth.AuthResult>;
  signUp: (fullName: string, email: string, password: string) => Promise<auth.AuthResult>;
  signOut: () => void;
  /** Validate access token → refresh if expired → false when session is dead. */
  ensureSession: () => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const SESSION_EXPIRED_MESSAGE = "Your session has expired. Please sign in again.";

export function setSessionExpiredFlag() {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem("verix.auth.expired", "1");
  }
}

export function consumeSessionExpiredFlag(): boolean {
  if (typeof window === "undefined") return false;
  const flag = window.sessionStorage.getItem("verix.auth.expired");
  if (flag) window.sessionStorage.removeItem("verix.auth.expired");
  return Boolean(flag);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Hydrate the session on the client only (SSR has no storage).
    setUser(auth.isAuthenticated() ? auth.getCurrentUser() : null);
    setReady(true);
  }, []);

  const ensureSession = useCallback(() => {
    const ok = auth.isAuthenticated();
    const next = ok ? auth.getCurrentUser() : null;
    // Only swap identity objects when the user actually changed.
    setUser((prev) => (prev?.userId === next?.userId ? prev : next));
    return ok;
  }, []);

  // Periodically revalidate so an expired access token triggers the refresh flow.
  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => {
      if (auth.getCurrentUser()) ensureSession();
    }, 15000);
    return () => window.clearInterval(id);
  }, [ready, ensureSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      signIn: async (email, password) => {
        const result = await auth.login(email, password);
        if (result.ok) setUser(result.session.user);
        return result;
      },
      signUp: async (fullName, email, password) => {
        const result = await auth.signup(fullName, email, password);
        if (result.ok) setUser(result.session.user);
        return result;
      },
      signOut: () => {
        auth.logout();
        setUser(null);
      },
      ensureSession,
    }),
    [user, ready, ensureSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/**
 * Route protection for every VERIX page.
 * Renders a loading state while the session is checked — protected content is
 * never shown before validation completes.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { ready, user, ensureSession } = useAuth();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const hadSession = Boolean(auth.getSession());
    const ok = ensureSession();
    if (!ok) {
      if (hadSession) setSessionExpiredFlag();
      navigate({ to: "/login", replace: true });
      return;
    }
    setChecked(true);
  }, [ready, ensureSession, navigate]);

  if (!ready || !checked || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="panel flex flex-col items-center gap-3 px-10 py-8">
          <span className="size-6 animate-spin rounded-full border-2 border-sand border-t-sagedeep" />
          <p className="text-sm text-muted-foreground">Verifying secure session…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
