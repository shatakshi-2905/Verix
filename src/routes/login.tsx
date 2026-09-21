import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PrimaryButton } from "@/components/verix/ui";
import { AuthBrand, AuthField, AuthShell, SsoPlaceholder } from "@/components/verix/AuthLayout";
import { consumeSessionExpiredFlag, SESSION_EXPIRED_MESSAGE, useAuth } from "@/lib/auth/AuthProvider";
import { DEMO_CREDENTIALS } from "@/lib/auth/authService";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — VERIX" },
      {
        name: "description",
        content:
          "Sign in to VERIX to transform source documents into trusted, audience-ready content with human review.",
      },
      { property: "og:title", content: "Sign in — VERIX" },
      { property: "og:description", content: "Access your VERIX content transformation workspace." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn, user, ready } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (consumeSessionExpiredFlag()) setNotice(SESSION_EXPIRED_MESSAGE);
  }, []);

  useEffect(() => {
    if (ready && user) navigate({ to: "/", replace: true });
  }, [ready, user, navigate]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!email.trim()) next.email = "Please enter your email.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = "Please enter a valid email address.";
    if (!password) next.password = "Please enter your password.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    setNotice(null);
    void (async () => {
      const result = await signIn(email, password);
      setLoading(false);
      if (!result.ok) { setErrors({ form: result.error }); return; }
      navigate({ to: "/", replace: true });
    })();
  }

  return (
    <AuthShell>
      <AuthBrand
        title="Sign in"
        subtitle="Token-protected access to your content transformation workspace."
      />

      {notice ? (
        <p className="mt-5 rounded-2xl border border-clay/40 bg-clay/10 px-4 py-3 text-sm">
          {notice}
        </p>
      ) : null}

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <AuthField
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@organisation.gov.in"
          error={errors.email}
          autoComplete="email"
        />
        <AuthField
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          error={errors.password}
          autoComplete="current-password"
        />

        {errors.form ? (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
            {errors.form}
          </p>
        ) : null}

        <PrimaryButton type="submit" disabled={loading} className="w-full">
          {loading ? "Signing in…" : "Sign In"}
        </PrimaryButton>
      </form>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link to="/signup" className="font-semibold text-sagedeep underline-offset-2 hover:underline">
          Sign up
        </Link>
      </p>

      <SsoPlaceholder />

    </AuthShell>
  );
}
