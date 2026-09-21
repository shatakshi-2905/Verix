import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-10 text-ink">
      <div className="w-full max-w-md">
        <section className="panel p-7 sm:p-8">{children}</section>
        <p className="mt-6 text-center font-display text-xs italic text-muted-foreground">
          Transform one source into trusted, audience-ready content — securely, intelligently and
          with human control.
        </p>
      </div>
    </div>
  );
}

export function AuthBrand({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-2xl bg-sagedeep font-display text-lg text-paper">
          V
        </span>
        <span>
          <span className="block font-display text-xl leading-none">VERIX</span>
          <span className="mt-1 block text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            GenAI Content
          </span>
        </span>
        <span className="ml-auto rounded-full bg-sage/20 px-2.5 py-1 text-[10px] font-semibold text-sagedeep">
          JWT Protected
        </span>
      </div>
      <h1 className="mt-6 font-display text-2xl leading-tight">{title}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

export function AuthField({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  autoComplete,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string | undefined;
  error?: string | undefined;
  autoComplete?: string | undefined;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "mt-1.5 w-full rounded-2xl border bg-paper px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-sage",
          error ? "border-destructive" : "border-sand",
        )}
      />
      {error ? <span className="mt-1 block text-xs text-destructive">{error}</span> : null}
    </label>
  );
}

/**
 * FUTURE:
 * Organization SSO / LDAP integration will enter
 * the authentication flow here. Disabled placeholder only — no LDAP is
 * implemented or simulated in this prototype.
 */
export function SsoPlaceholder() {
  return (
    <div className="mt-7">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-sand" />
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-sand" />
      </div>
      <button
        type="button"
        disabled
        aria-disabled="true"
        className="mt-4 w-full cursor-not-allowed rounded-2xl border border-sand bg-sand/30 px-4 py-2.5 text-sm font-medium text-muted-foreground opacity-70"
      >
        Sign in with Organization SSO (LDAP)
      </button>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        Coming soon — will connect to your organization&apos;s identity provider.
      </p>
    </div>
  );
}
