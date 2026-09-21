import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AuthGate, useAuth } from "@/lib/auth/AuthProvider";

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/create", label: "Create Transformation" },
  { to: "/documents", label: "Documents" },
  { to: "/generated", label: "Generated Content" },
  { to: "/verification", label: "Verification" },
  { to: "/history", label: "History" },
  { to: "/security", label: "Security" },
  { to: "/settings", label: "Settings" },
] as const;

export function AppShell(props: { title: string; subtitle?: string; children: ReactNode }) {
  // Every VERIX page renders through AppShell, so route protection lives here.
  return (
    <AuthGate>
      <AppShellInner {...props} />
    </AuthGate>
  );
}

function AppShellInner({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  function handleSignOut() {
    signOut();
    navigate({ to: "/login", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-cream text-ink">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sand/70 bg-paper/70 px-5 py-7 lg:flex">
        <Link to="/" className="flex items-center gap-3 px-2">
          <span className="grid size-9 place-items-center rounded-2xl bg-sagedeep font-display text-lg text-paper">
            V
          </span>
          <span>
            <span className="block font-display text-xl leading-none">VERIX</span>
            <span className="mt-1 block text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              GenAI Content
            </span>
          </span>
        </Link>

        <nav className="mt-9 space-y-1 text-sm">
          {NAV.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                  active
                    ? "bg-sage/15 font-semibold text-sagedeep"
                    : "text-ink/55 hover:bg-cream hover:text-ink",
                )}
              >
                {active ? <span className="size-1.5 rounded-full bg-clay" /> : null}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-sand bg-cream p-3.5">
          <p className="text-[11px] font-semibold text-sagedeep">Human-in-the-loop</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            AI output never becomes final until a person approves it.
          </p>
        </div>

        <div className="mt-3 rounded-2xl border border-sand bg-paper p-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold">{user?.fullName}</p>
            <span className="shrink-0 rounded-full bg-sage/20 px-2 py-0.5 text-[10px] font-semibold text-sagedeep">
              Authenticated
            </span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{user?.email}</p>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-2.5 w-full rounded-xl border border-sand bg-cream px-3 py-1.5 text-xs font-medium transition-colors hover:bg-sand/40"
          >
            Log out
          </button>
        </div>
      </aside>

      <main className="flex-1 px-6 py-8 md:px-10">
        <nav className="mb-6 flex flex-wrap gap-1.5 lg:hidden">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                pathname === item.to
                  ? "border-sage/40 bg-sage/20 font-semibold text-sagedeep"
                  : "border-sand bg-paper text-muted-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">VERIX</p>
            <h1 className="mt-1 font-display text-3xl leading-tight">{title}</h1>
            {subtitle ? <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-sage/20 px-2.5 py-1 text-[10px] font-semibold text-sagedeep">
              JWT Protected
            </span>
            <div className="hidden text-right lg:block">
              <p className="text-xs font-semibold">{user?.fullName}</p>
              <p className="text-[11px] text-muted-foreground">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-xl border border-sand bg-paper px-3 py-1.5 text-xs font-medium transition-colors hover:bg-sand/40 lg:hidden"
            >
              Log out
            </button>
          </div>
        </header>

        {children}

        <p className="mt-10 text-center font-display text-xs italic text-muted-foreground">
          Transform one source into trusted, audience-ready content — securely, intelligently and
          with human control.
        </p>
      </main>
    </div>
  );
}
