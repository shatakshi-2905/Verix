import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ReviewStatus, VerificationStatus } from "@/lib/verix/types";

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cn("panel p-6", className)}>{children}</section>;
}

export function PanelHead({
  eyebrow,
  title,
  hint,
  right,
}: {
  eyebrow?: string;
  title: string;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2 className="mt-1 font-display text-xl">{title}</h2>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function Chip({
  label,
  active,
  onClick,
  disabled,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-50",
        active
          ? "border-sage/40 bg-sage/20 font-semibold text-sagedeep"
          : "border-sand bg-cream text-muted-foreground hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-sand bg-cream px-3 py-1 text-xs">{children}</span>
  );
}

export function DemoBadge() {
  return (
    <span className="rounded-full bg-clay/15 px-3 py-1 text-[11px] font-semibold text-clay">
      DEMO DATA — FICTIONAL
    </span>
  );
}

export function AiBadge() {
  return (
    <span className="rounded-full bg-clay/15 px-2.5 py-1 text-[11px] font-semibold text-clay">
      AI Generated — Requires Human Review
    </span>
  );
}

const reviewTone: Record<ReviewStatus, string> = {
  Draft: "bg-cream text-muted-foreground border border-sand",
  "Under Review": "bg-clay/15 text-clay",
  Approved: "bg-sage/20 text-sagedeep",
  Rejected: "bg-destructive/10 text-destructive",
};

export function StatusBadge({ status }: { status: ReviewStatus }) {
  return (
    <span
      className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", reviewTone[status])}
    >
      {status}
    </span>
  );
}

const verifyTone: Record<VerificationStatus, string> = {
  Supported: "bg-sage/20 text-sagedeep",
  "Partially Supported": "bg-partial/15 text-partial",
  "Needs Review": "bg-clay/15 text-clay",
};

export function VerifyBadge({ status }: { status: VerificationStatus }) {
  const mark = status === "Supported" ? "✓" : status === "Partially Supported" ? "~" : "⚠";
  return (
    <span
      className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", verifyTone[status])}
    >
      {mark} {status}
    </span>
  );
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="rounded-2xl bg-cream px-4 py-3">
      <p className="font-display text-2xl">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-clay/40 bg-clay/10 px-4 py-3 text-sm text-ink">
      <p>{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-xl bg-sagedeep px-3 py-1.5 text-xs font-semibold text-paper"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  className,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-2xl bg-sagedeep px-4 py-2.5 text-sm font-semibold text-paper transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-2xl border border-sand bg-cream px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-sand/40 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) {
  return (
    <div className="panel flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <h3 className="font-display text-lg">{title}</h3>
      <p className="max-w-md text-sm text-muted-foreground">{hint}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
