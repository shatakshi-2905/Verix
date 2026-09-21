import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AiBadge, GhostButton, PrimaryButton, StatusBadge, VerifyBadge } from "./ui";
import { FormatPreview } from "./formats/FormatPreview";
import type { GeneratedOutput } from "@/lib/verix/types";
import { useVerix } from "@/lib/verix/store";
import { diffWords, wordCount } from "@/lib/verix/utils";
import { exportDoc, exportDocHtml, exportPdf, exportPdfHtml, exportTxt } from "@/lib/verix/export";
import { contractFor, renderHtml } from "@/lib/verix/formats/contracts";

export function OutputEditor({
  output,
  onRegenerate,
  regenerating,
}: {
  output: GeneratedOutput;
  onRegenerate?: () => void;
  regenerating?: boolean;
}) {
  const { saveVersion, setOutputStatus, updateOutput } = useVerix();
  const [draft, setDraft] = useState(output.content);
  const [compare, setCompare] = useState(false);
  const [left, setLeft] = useState(1);
  const [right, setRight] = useState(output.versions.length);
  const [mode, setMode] = useState<"preview" | "edit">("preview");

  useEffect(() => {
    setDraft(output.content);
    setRight(output.versions.length);
  }, [output.id, output.content, output.versions.length]);

  const dirty = draft !== output.content;
  const words = wordCount(draft);

  const diff = useMemo(() => {
    const a = output.versions.find((v) => v.n === left)?.content ?? "";
    const b = output.versions.find((v) => v.n === right)?.content ?? "";
    return diffWords(a, b);
  }, [output.versions, left, right]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copying isn't available in this browser. Select the text and copy manually.");
    }
  };

  // Structured export is used whenever the current text still matches the
  // validated payload; hand-edited text falls back to plain paragraphs.
  const structured = output.data && draft === output.content ? output.data : null;

  const doExport = (kind: "txt" | "doc" | "pdf") => {
    if (output.status !== "Approved") {
      toast.warning("This output is not approved yet — exporting a draft.");
    }
    const title = `VERIX ${output.type}`;
    const html = structured ? renderHtml(structured) : null;
    try {
      if (kind === "txt") exportTxt(title, draft);
      else if (kind === "doc") {
        if (html) exportDocHtml(title, html);
        else exportDoc(title, draft);
      } else {
        const ok = html ? exportPdfHtml(title, html) : exportPdf(title, draft);
        if (!ok) {
          toast.error("Your browser blocked the PDF window. Exporting as TXT instead.");
          exportTxt(title, draft);
          return;
        }
      }
      toast.success("Export ready");
    } catch {
      toast.error("We couldn't create that export. Please try the TXT option.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-xl">{output.type}</h3>
          <StatusBadge status={output.status} />
          {output.format ? (
            <span className="rounded-full bg-cream px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {contractFor(output.format).label} format
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {output.status === "Approved" ? null : <AiBadge />}
          {output.data ? (
            <div className="flex rounded-full bg-cream p-0.5 text-[11px] font-medium">
              <button
                type="button"
                onClick={() => setMode("preview")}
                className={
                  mode === "preview"
                    ? "rounded-full bg-sagedeep px-3 py-1 text-paper"
                    : "rounded-full px-3 py-1 text-muted-foreground"
                }
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => setMode("edit")}
                className={
                  mode === "edit"
                    ? "rounded-full bg-sagedeep px-3 py-1 text-paper"
                    : "rounded-full px-3 py-1 text-muted-foreground"
                }
              >
                Edit
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {output.data && mode === "preview" && !dirty ? (
        <FormatPreview data={output.data} />
      ) : (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck={false}
          className="min-h-[280px] w-full rounded-2xl border border-sand bg-cream p-4 text-sm leading-relaxed outline-none focus:border-sage"
        />
      )}

      {output.formatChecks?.length ? (
        <div className="rounded-2xl border border-sand bg-paper p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Format checks
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {output.formatChecks.map((c, i) => (
              <li key={i} className="flex items-start gap-2 rounded-xl bg-cream p-3 text-xs">
                <span className={c.ok ? "text-sagedeep" : "text-destructive"}>
                  {c.ok ? "✓" : "✕"}
                </span>
                <span>
                  {c.label}
                  {c.detail ? (
                    <span className="block text-[11px] text-muted-foreground">{c.detail}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span>
          {words} words · Version {output.activeVersion} of {output.versions.length}
          {dirty ? " · unsaved edits" : ""}
        </span>
        <div className="flex flex-wrap gap-2">
          <GhostButton className="px-3 py-1.5 text-xs" onClick={copy}>
            Copy
          </GhostButton>
          {onRegenerate ? (
            <GhostButton className="px-3 py-1.5 text-xs" onClick={onRegenerate} disabled={!!regenerating}>
              {regenerating ? "Generating…" : "Regenerate"}
            </GhostButton>
          ) : null}
          <GhostButton
            className="px-3 py-1.5 text-xs"
            disabled={!dirty}
            onClick={() => {
              saveVersion(output.id, draft);
              toast.success(`Version ${output.versions.length + 1} saved`);
            }}
          >
            Save Version
          </GhostButton>
          <GhostButton
            className="px-3 py-1.5 text-xs"
            disabled={output.versions.length < 2}
            onClick={() => setCompare((c) => !c)}
          >
            {compare ? "Hide comparison" : "Compare Versions"}
          </GhostButton>
        </div>
      </div>

      {compare && output.versions.length >= 2 ? (
        <div className="rounded-2xl border border-sand bg-paper p-4">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-2">
              Left
              <select
                value={left}
                onChange={(e) => setLeft(Number(e.target.value))}
                className="rounded-lg border border-sand bg-cream px-2 py-1"
              >
                {output.versions.map((v) => (
                  <option key={v.n} value={v.n}>
                    Version {v.n} — {v.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              Right
              <select
                value={right}
                onChange={(e) => setRight(Number(e.target.value))}
                className="rounded-lg border border-sand bg-cream px-2 py-1"
              >
                {output.versions.map((v) => (
                  <option key={v.n} value={v.n}>
                    Version {v.n} — {v.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-sand bg-cream p-4 text-sm leading-relaxed">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Version {left}
              </p>
              <p className="whitespace-pre-wrap">
                {diff.left.map((t, i) => (
                  <span key={i} className={t.removed ? "diff-del" : undefined}>
                    {t.text}
                  </span>
                ))}
              </p>
            </div>
            <div className="rounded-2xl border border-sand bg-cream p-4 text-sm leading-relaxed">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Version {right}
              </p>
              <p className="whitespace-pre-wrap">
                {diff.right.map((t, i) => (
                  <span key={i} className={t.added ? "diff-add" : undefined}>
                    {t.text}
                  </span>
                ))}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {output.verification.length ? (
        <div className="rounded-2xl border border-sand bg-paper p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Source-grounded checks for this output
          </p>
          <ul className="mt-3 space-y-2">
            {output.verification.map((c, i) => (
              <li key={i} className="rounded-xl bg-cream p-3 text-xs">
                <p className="leading-relaxed">“{c.claim}”</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <VerifyBadge status={c.status} />
                  <span className="text-[11px] text-muted-foreground">
                    {c.sourceRef ?? "No supporting section found in the source"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <PrimaryButton
          disabled={output.status === "Approved"}
          onClick={() => {
            if (dirty) {
              updateOutput(output.id, { content: draft });
            }
            setOutputStatus(output.id, "Approved");
            toast.success(`${output.type} approved`);
          }}
        >
          Approve
        </PrimaryButton>
        <GhostButton
          disabled={output.status === "Rejected"}
          onClick={() => {
            setOutputStatus(output.id, "Rejected");
            toast.message(`${output.type} marked as rejected`);
          }}
        >
          Reject
        </GhostButton>
        <span className="ml-auto flex flex-wrap gap-2">
          <GhostButton className="px-3 py-1.5 text-xs" onClick={() => doExport("txt")}>
            Download TXT
          </GhostButton>
          <GhostButton className="px-3 py-1.5 text-xs" onClick={() => doExport("doc")}>
            Download DOC
          </GhostButton>
          <GhostButton className="px-3 py-1.5 text-xs" onClick={() => doExport("pdf")}>
            Export PDF
          </GhostButton>
        </span>
      </div>
    </div>
  );
}
