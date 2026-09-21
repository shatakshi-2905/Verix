import { api, clearTokens, getAccessToken, setTokens } from "../api";

export interface AuthUser { userId: string; fullName: string; email: string; }
export interface Session { user: AuthUser; accessToken: string; refreshToken: string; }
export type AuthResult = { ok: true; session: Session } | { ok: false; error: string };

const USER_KEY = "verix.auth.user";
export const DEMO_CREDENTIALS: { email: string; password: string; blocked: boolean }[] = [];

function saveUser(user: AuthUser) { localStorage.setItem(USER_KEY, JSON.stringify(user)); }
function readUser(): AuthUser | null { try { const x = localStorage.getItem(USER_KEY); return x ? JSON.parse(x) : null; } catch { return null; } }
export function getCurrentUser() { return readUser(); }
export function getSession(): Session | null { const u=readUser(), token=getAccessToken(), refresh=localStorage.getItem("verix.refresh_token"); return u&&token&&refresh ? {user:u,accessToken:token,refreshToken:refresh}:null; }
export function isAuthenticated() { return Boolean(getCurrentUser() && getAccessToken()); }
export function logout() { clearTokens(); localStorage.removeItem(USER_KEY); }
export async function login(email: string, password: string): Promise<AuthResult> {
  try { const r:any=await api('/api/auth/login',{method:'POST',body:JSON.stringify({email,password})}); setTokens(r.session.access_token,r.session.refresh_token); const user={userId:r.user.id,fullName:r.user.full_name,email:r.user.email}; saveUser(user); return {ok:true,session:{user,accessToken:r.session.access_token,refreshToken:r.session.refresh_token}}; }
  catch(e:any){return {ok:false,error:e.message||'Invalid email or password.'};}
}
export async function signup(fullName:string,email:string,password:string):Promise<AuthResult>{
  try { const r:any=await api('/api/auth/signup',{method:'POST',body:JSON.stringify({full_name:fullName,email,password})}); if(!r.session) return {ok:false,error:'Account created. Please confirm your email, then sign in.'}; setTokens(r.session.access_token,r.session.refresh_token); const user={userId:r.user.id,fullName:r.user.full_name,email:r.user.email}; saveUser(user); return {ok:true,session:{user,accessToken:r.session.access_token,refreshToken:r.session.refresh_token}}; }
  catch(e:any){return {ok:false,error:e.message||'Could not create account.'};}
}
