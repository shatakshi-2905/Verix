const API_BASE = (import.meta.env["VITE_API_URL"] || "http://localhost:8000").replace(/\/$/, "");
const ACCESS_KEY = "verix.access_token";
const REFRESH_KEY = "verix.refresh_token";

export function getAccessToken() { return typeof window === "undefined" ? null : localStorage.getItem(ACCESS_KEY); }
export function getRefreshToken() { return typeof window === "undefined" ? null : localStorage.getItem(REFRESH_KEY); }
export function setTokens(access: string, refresh?: string) { localStorage.setItem(ACCESS_KEY, access); if (refresh) localStorage.setItem(REFRESH_KEY, refresh); }
export function clearTokens() { localStorage.removeItem(ACCESS_KEY); localStorage.removeItem(REFRESH_KEY); }

let refreshInFlight: Promise<boolean> | null = null;

/** Exchanges the stored refresh token for a new access token. Returns false
 * (and clears tokens) if there is no refresh token or it's no longer valid. */
async function tryRefresh(): Promise<boolean> {
  const refresh_token = getRefreshToken();
  if (!refresh_token) return false;
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token }),
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const data = await res.json().catch(() => null);
        if (!data?.session?.access_token) return false;
        setTokens(data.session.access_token, data.session.refresh_token);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  const ok = await refreshInFlight;
  if (!ok) clearTokens();
  return ok;
}

export async function api<T>(path: string, options: RequestInit = {}, _retried = false): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    if (!_retried && path !== "/api/auth/refresh" && (await tryRefresh())) {
      return api<T>(path, options, true);
    }
    clearTokens();
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || "Request failed");
  return data as T;
}
