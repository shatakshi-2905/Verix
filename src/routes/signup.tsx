import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PrimaryButton } from "@/components/verix/ui";
import { AuthBrand, AuthField, AuthShell, SsoPlaceholder } from "@/components/verix/AuthLayout";
import { useAuth } from "@/lib/auth/AuthProvider";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create account — VERIX" },
      {
        name: "description",
        content:
          "Create a VERIX account to transform source documents into audience-ready content with verification and human review.",
      },
      { property: "og:title", content: "Create account — VERIX" },
      { property: "og:description", content: "Set up your VERIX workspace in a few seconds." },
    ],
  }),
  component: SignupPage,
});

interface Errors {
  fullName?: string;
  email?: string;
  password?: string;
  confirm?: string;
  form?: string;
}

function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (!fullName.trim()) next.fullName = "Please enter your full name.";
    if (!email.trim()) next.email = "Please enter your email.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = "Please enter a valid email address.";
    if (!password) next.password = "Please enter a password.";
    else if (password.length < 8) next.password = "Password must be at least 8 characters.";
    if (confirm !== password) next.confirm = "Passwords do not match.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    void (async () => {
      const result = await signUp(fullName, email, password);
      setLoading(false);
      if (!result.ok) { setErrors({ form: result.error }); return; }
      toast.success("Account created — you're signed in.");
      navigate({ to: "/", replace: true });
    })();
  }

  return (
    <AuthShell>
      <AuthBrand
        title="Create account"
        subtitle="Accounts and workspace data are secured through Supabase and the VERIX API."
      />

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <AuthField
          label="Full name"
          value={fullName}
          onChange={setFullName}
          placeholder="Rakshita Bajaj"
          error={errors.fullName}
          autoComplete="name"
        />
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
          placeholder="At least 8 characters"
          error={errors.password}
          autoComplete="new-password"
        />
        <AuthField
          label="Confirm password"
          type="password"
          value={confirm}
          onChange={setConfirm}
          placeholder="Repeat password"
          error={errors.confirm}
          autoComplete="new-password"
        />

        {errors.form ? (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
            {errors.form}
          </p>
        ) : null}

        <PrimaryButton type="submit" disabled={loading} className="w-full">
          {loading ? "Creating account…" : "Create Account"}
        </PrimaryButton>
      </form>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-sagedeep underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>

      <SsoPlaceholder />
    </AuthShell>
  );
}
