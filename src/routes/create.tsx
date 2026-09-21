import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/verix/AppShell";
import { StepRail } from "@/components/verix/StepRail";
import { OutputEditor } from "@/components/verix/OutputEditor";
import {
  Chip,
  DemoBadge,
  EmptyState,
  ErrorNote,
  Field,
  GhostButton,
  Panel,
  PanelHead,
  PrimaryButton,
  Stat,
  Tag,
  VerifyBadge,
} from "@/components/verix/ui";
import { analyzeDocument, generateContent, ingestUrl, createDocument, createTransformation, uploadDocument, protectDocument } from "@/lib/verix/ai.functions";
import { DEMO_DOCUMENT, DEMO_TITLE } from "@/lib/verix/demo";
import { extractFile, ExtractError } from "@/lib/verix/extract";
import { maskPreview } from "@/lib/verix/sensitive";
import { useVerix } from "@/lib/verix/store";
import {
  AUDIENCES,
  COMPLEXITIES,
  LANGUAGES,
  LENGTHS,
  OUTPUT_TYPES,
  SECTIONS,
  TONES,
  type GeneratedOutput,
  type OutputType,
} from "@/lib/verix/types";
import type { FormatCheck, FormatId, FormatPayload } from "@/lib/verix/formats/contracts";
import { newId, wordCount } from "@/lib/verix/utils";
import { extractClaims, verifyClaims } from "@/lib/verix/verify";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Create Transformation — VERIX" },
      {
        name: "description",
        content:
          "Run the VERIX workflow: input, analyze, protect, configure, generate, verify, review and export audience-ready content.",
      },
      { property: "og:title", content: "Create Transformation — VERIX" },
      {
        property: "og:description",
        content: "One source document, many verified audience-ready outputs, with human approval.",
      },
    ],
  }),
  component: CreatePage,
});

function CreatePage() {
  const v = useVerix();
  const navigate = useNavigate();
  const analyze = analyzeDocument;
  const generate = generateContent;
  const fetchUrl = ingestUrl;

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [url, setUrl] = useState("");
  const [activeTab, setActiveTab] = useState<OutputType | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reachable = useMemo(() => {
    if (!v.doc) return 1;
    if (!v.analysis) return 2;
    if (v.protectedText === null) return 3;
    if (v.outputs.length === 0) return 5;
    return 8;
  }, [v.doc, v.analysis, v.protectedText, v.outputs.length]);

  const sourceForGeneration = v.protectedText ?? v.doc?.text ?? "";

  /* ------------------------------- step 1 ------------------------------- */

  const loadDemo = async () => {
    setError(null);
    setBusy("Loading…");
    try {
      const saved = await createDocument({
        title: DEMO_TITLE,
        kind: "demo",
        text: DEMO_DOCUMENT,
        is_demo: true,
      });
      v.setDoc({
        id: saved.id,
        title: DEMO_TITLE,
        kind: "demo",
        text: DEMO_DOCUMENT,
        wordCount: wordCount(DEMO_DOCUMENT),
        isDemo: true,
        createdAt: saved.created_at || new Date().toISOString(),
      });
      v.setStep(2);
      toast.success("Demo document loaded");
    } catch {
      setError("We couldn't load the demo document. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy("Uploading…");
    try {
      const local = await extractFile(file);
      const saved = await uploadDocument(file);
      const text = saved.source_text || local.text;
      v.setDoc({
        id: saved.id,
        title: saved.title || local.title,
        kind: "file",
        text,
        wordCount: saved.word_count || wordCount(text),
        isDemo: false,
        createdAt: saved.created_at || new Date().toISOString(),
      });
      v.setStep(2);
      toast.success("Document uploaded");
    } catch (err) {
      setError(
        err instanceof ExtractError
          ? err.message
          : "We couldn't process this document. Please check the file and try again.",
      );
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onPaste = async () => {
    setError(null);
    const text = pastedText.trim();
    if (text.length < 200) {
      setError("Please paste at least a couple of paragraphs (200 characters) of content.");
      return;
    }
    if (text.length > 200000) {
      setError("That text is too long. Please keep it under 200,000 characters.");
      return;
    }
    setBusy("Saving…");
    try {
      const title = `Pasted text — ${new Date().toLocaleDateString()}`;
      const saved = await createDocument({ title, kind: "text", text, is_demo: false });
      v.setDoc({
        id: saved.id,
        title,
        kind: "text",
        text,
        wordCount: wordCount(text),
        isDemo: false,
        createdAt: saved.created_at || new Date().toISOString(),
      });
      v.setStep(2);
    } catch {
      setError("We couldn't save this text. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const onUrl = async () => {
    setError(null);
    if (!/^https?:\/\/.+\..+/i.test(url.trim())) {
      setError("Please enter a full web address starting with http:// or https://");
      return;
    }
    setBusy("Fetching page…");
    try {
      const res = await fetchUrl({ data: { url: url.trim() } });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      const saved = await createDocument({ title: res.title, kind: "url", text: res.text, is_demo: false });
      v.setDoc({
        id: saved.id,
        title: res.title,
        kind: "url",
        text: res.text,
        wordCount: wordCount(res.text),
        isDemo: false,
        createdAt: saved.created_at || new Date().toISOString(),
      });
      v.setStep(2);
    } catch {
      setError("We couldn't load that page. Please check the address and try again.");
    } finally {
      setBusy(null);
    }
  };

  /* ------------------------------- step 2 ------------------------------- */

  const runAnalysis = async () => {
    if (!v.doc) return;
    setError(null);
    setBusy("Analyzing…");
    try {
      // The backend detects and masks sensitive items BEFORE calling the
      // model, so this single call both runs analysis and returns the
      // sensitive-item findings shown in Step 3 — no raw text goes to
      // Bedrock at any point here.
      const res = await analyze({ data: { document_id: v.doc.id } });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      v.setAnalysis({
        ...res.analysis,
        wordCount: v.doc.wordCount,
        characterCount: v.doc.text.length,
      });
      v.setSensitive(res.findings || []);
    } catch {
      setError("We couldn't analyse this document. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  /* ------------------------------- step 3 ------------------------------- */

  const applyProtect = async () => {
    if (!v.doc) return;
    setBusy("Protecting…");
    try {
      const result = await protectDocument({ document_id: v.doc.id, findings: v.sensitive });
      v.setSensitive(result.findings || v.sensitive);
      v.setProtectedText(result.protected_text || "");
      v.setStep(4);
      toast.success("Protection applied to the working copy");
    } catch {
      setError("We couldn't apply protection. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  /* ------------------------------- step 5 ------------------------------- */

  const buildOutput = (
    type: OutputType,
    res: { format: FormatId; data: FormatPayload; content: string; checks: FormatCheck[]; verification?: any[]; runId?: string },
  ): GeneratedOutput => ({
    id: newId("out"),
    type,
    format: res.format,
    data: res.data,
    formatChecks: res.checks,
    content: res.content,
    status: "Draft",
    activeVersion: 1,
    versions: [
      {
        n: 1,
        content: res.content,
        label: "AI generated",
        createdAt: new Date().toISOString(),
        data: res.data,
      },
    ],
    verification:
      res.verification && res.verification.length > 0
        ? res.verification
        : verifyClaims(extractClaims(res.content), v.doc?.text ?? ""),
    ...(res.runId ? { runId: res.runId } : {}),
    createdAt: new Date().toISOString(),
  });

  const generateAll = async () => {
    const doc = v.doc;
    if (!doc || v.selected.length === 0) return;
    setError(null);
    setBusy("Generating…");
    setProgress({ done: 0, total: v.selected.length });
    const results: GeneratedOutput[] = [];
    const failures: string[] = [];

    await Promise.all(
      v.selected.map(async (type) => {
        try {
          const res = await generate({
            data: {
              document_id: doc.id,
              outputType: type,
              audience: v.config.audience,
              tone: v.config.tone,
              complexity: v.config.complexity,
              length: v.config.length,
              language: v.config.language,
              sections: v.config.sections,
            },
          });
          if (res.ok)
            results.push(
              buildOutput(type, {
                format: res.format as FormatId,
                data: res.data as FormatPayload,
                content: res.content,
                checks: res.checks as FormatCheck[],
                verification: res.verification,
                runId: res.run_id,
              }),
            );
          else failures.push(type);
        } catch {
          failures.push(type);
        } finally {
          setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
        }
      }),
    );

    setBusy(null);
    setProgress(null);

    if (results.length === 0) {
      setError("We couldn't generate any outputs. Your source is preserved — please retry.");
      return;
    }
    const ordered = v.selected
      .map((t) => results.find((r) => r.type === t))
      .filter(Boolean) as GeneratedOutput[];
    v.setOutputs(ordered);
    setActiveTab(ordered[0]!.type);
    try {
      const saved = await createTransformation({ document_id: doc.id, config: v.config, sensitive_count: v.sensitive.length, outputs: ordered });
      // Replace the client-generated ids with the real database ids the
      // backend just assigned, in the same order they were sent — every
      // later approve/edit/version PATCH targets an id that actually
      // exists as an `outputs` row.
      if (Array.isArray(saved?.outputs) && saved.outputs.length === ordered.length) {
        const withRealIds = ordered.map((o, i) => ({ ...o, id: saved.outputs[i].id as string }));
        v.setOutputs(withRealIds);
      }
    } catch { toast.warning("Generated successfully, but cloud history could not be saved."); }
    v.commitTransformation();
    v.setStep(6);
    if (failures.length) toast.warning(`${failures.length} output(s) couldn't be generated.`);
    else toast.success(`1 source → ${ordered.length} outputs`);
  };

  const regenerateOne = async (output: GeneratedOutput) => {
    if (!v.doc) return;
    const doc = v.doc;
    setRegenerating(output.id);
    try {
      const res = await generate({
        data: {
          document_id: doc.id,
          outputType: output.type,
          audience: v.config.audience,
          tone: v.config.tone,
          complexity: v.config.complexity,
          length: v.config.length,
          language: v.config.language,
          sections: v.config.sections,
        },
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      const n = output.versions.length + 1;
      const payload = res.data as FormatPayload;
      v.updateOutput(output.id, {
        content: res.content,
        format: res.format as FormatId,
        data: payload,
        formatChecks: res.checks as FormatCheck[],
        status: "Under Review",
        activeVersion: n,
        versions: [
          ...output.versions,
          {
            n,
            content: res.content,
            label: "AI regenerated",
            createdAt: new Date().toISOString(),
            data: payload,
          },
        ],
        verification:
          res.verification && res.verification.length > 0
            ? res.verification
            : verifyClaims(extractClaims(res.content), v.doc?.text ?? ""),
        runId: res.runId,
      });
      toast.success(`Regenerated as version ${n}`);
    } catch {
      toast.error("We couldn't regenerate this output. Please try again.");
    } finally {
      setRegenerating(null);
    }
  };

  const current = v.outputs.find((o) => o.type === activeTab) ?? v.outputs[0];
  const approved = v.outputs.filter((o) => o.status === "Approved");

  return (
    <AppShell
      title="Create Transformation"
      subtitle="Input → Understand → Protect → Adapt → Transform → Verify → Review → Export"
    >
      <StepRail current={v.step} reachable={reachable} onSelect={v.setStep} />

      {error ? (
        <div className="mb-6">
          <ErrorNote message={error} onRetry={() => setError(null)} />
        </div>
      ) : null}

      {/* ------------------------------ STEP 1 ------------------------------ */}
      {v.step === 1 ? (
        <div className="grid gap-6 xl:grid-cols-12">
          <Panel className="xl:col-span-7">
            <PanelHead
              eyebrow="Step 1"
              title="Provide your source"
              hint="PDF, DOCX, TXT or MD up to 8 MB, pasted text, or a public web page."
            />
            <div className="mt-5 space-y-5">
              <div className="rounded-2xl border border-dashed border-sand bg-cream p-5 text-center">
                <p className="text-sm text-muted-foreground">Upload a document</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  className="mx-auto mt-3 block max-w-xs text-xs"
                  onChange={(e) => void onFile(e.target.files?.[0])}
                  disabled={busy !== null}
                />
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Or paste text
                </p>
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste an article, report or advisory here…"
                  className="mt-2 min-h-[140px] w-full rounded-2xl border border-sand bg-cream p-4 text-sm outline-none focus:border-sage"
                />
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{pastedText.trim().length} characters</span>
                  <GhostButton className="px-3 py-1.5 text-xs" onClick={onPaste} disabled={busy !== null}>
                    Use this text
                  </GhostButton>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Or a web address
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.org/advisory"
                    className="flex-1 rounded-2xl border border-sand bg-cream px-4 py-2.5 text-sm outline-none focus:border-sage"
                  />
                  <GhostButton onClick={() => void onUrl()} disabled={busy !== null}>
                    {busy === "Fetching page…" ? "Fetching…" : "Fetch"}
                  </GhostButton>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Only public http/https pages. Internal and private addresses are blocked.
                </p>
              </div>
            </div>
          </Panel>

          <div className="space-y-6 xl:col-span-5">
            <Panel>
              <PanelHead eyebrow="Fastest route" title="Load Demo Document" />
              <p className="mt-2 text-sm text-muted-foreground">
                A fictional <strong>Cybersecurity Awareness Advisory</strong> with realistic
                structure, claims and sensitive items so the whole workflow can be demonstrated
                without uploading anything real.
              </p>
              <div className="mt-4 flex items-center gap-3">
                <PrimaryButton onClick={loadDemo}>Load Demo Document</PrimaryButton>
                <DemoBadge />
              </div>
            </Panel>
            <Panel>
              <PanelHead
                eyebrow="Privacy"
                title="What happens to your document"
                hint="Prototype behaviour — not a claim of enterprise-grade data protection."
              />
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                <li>· Documents are stored in your authenticated workspace, not shared with other users.</li>
                <li>· The browser only stores your session tokens — never document text or sensitive values.</li>
                <li>· Sensitive values are never placed in URLs or error messages.</li>
                <li>· AI requests run server-side; no keys reach the browser.</li>
              </ul>
            </Panel>
          </div>
        </div>
      ) : null}

      {/* ------------------------------ STEP 2 ------------------------------ */}
      {v.step === 2 && v.doc ? (
        <div className="grid gap-6 xl:grid-cols-12">
          <Panel className="xl:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="eyebrow">Source document</p>
              {v.doc.isDemo ? <DemoBadge /> : null}
            </div>
            <h2 className="mt-3 font-display text-3xl leading-tight">{v.doc.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {v.analysis
                ? "AI analysis complete. Review it before protecting the content."
                : "Run AI content understanding to extract topics, key points and claims."}
            </p>

            {v.analysis ? (
              <>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="eyebrow">Document type</p>
                    <p className="mt-1 text-sm font-semibold">{v.analysis.documentType}</p>
                  </div>
                  <div>
                    <p className="eyebrow">Main topic</p>
                    <p className="mt-1 text-sm font-semibold">{v.analysis.mainTopic}</p>
                  </div>
                </div>
                <div className="mt-5">
                  <p className="eyebrow">Key topics</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {v.analysis.keyTopics.map((t) => (
                      <Tag key={t}>{t}</Tag>
                    ))}
                  </div>
                </div>
                <div className="mt-5">
                  <p className="eyebrow">Key points</p>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {v.analysis.keyPoints.map((p, i) => (
                      <li key={i} className="rounded-xl bg-cream px-3 py-2">
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-5">
                  <p className="eyebrow">Important entities</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {v.analysis.entities.map((e, i) => (
                      <Tag key={i}>
                        {e.name} · <span className="text-muted-foreground">{e.type}</span>
                      </Tag>
                    ))}
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  <Stat value={v.analysis.claims.length} label="Claims detected" />
                  <Stat value={v.sensitive.length} label="Sensitive items" />
                  <Stat value={v.analysis.wordCount} label="Words" />
                </div>
              </>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-2">
              <PrimaryButton onClick={() => void runAnalysis()} disabled={busy !== null}>
                {busy === "Analyzing…" ? "Analyzing…" : v.analysis ? "Re-run analysis" : "Run AI Analysis"}
              </PrimaryButton>
              <GhostButton onClick={() => v.setStep(3)} disabled={!v.analysis}>
                Continue to Protect
              </GhostButton>
            </div>
          </Panel>

          <Panel className="xl:col-span-5">
            <PanelHead
              eyebrow="Source information"
              title="Original text"
              hint="Shown as-is. AI-generated information is always labelled separately."
            />
            <pre className="mt-4 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-2xl bg-cream p-4 font-sans text-xs leading-relaxed">
              {v.doc.text}
            </pre>
          </Panel>
        </div>
      ) : null}

      {/* ------------------------------ STEP 3 ------------------------------ */}
      {v.step === 3 && v.doc ? (
        <Panel>
          <PanelHead
            eyebrow="Step 3 · Protect"
            title="Sensitive Information"
            hint="Prototype security feature — a demonstration control, not complete enterprise-grade data protection."
            right={
              <div className="flex gap-1 rounded-full bg-cream p-1 text-xs font-medium">
                {(["mask", "remove", "keep"] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => v.setAllSensitiveActions(a)}
                    className="rounded-full px-3 py-1 capitalize text-muted-foreground hover:bg-sand/50"
                  >
                    All {a}
                  </button>
                ))}
              </div>
            }
          />

          {v.sensitive.length === 0 ? (
            <p className="mt-5 rounded-2xl bg-cream px-4 py-3 text-sm text-muted-foreground">
              No sensitive patterns were detected in this source. You can continue — the document is
              marked <strong className="text-sagedeep">Safe for Transformation</strong>.
            </p>
          ) : (
            <div className="mt-5 divide-y divide-sand/70">
              {v.sensitive.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="font-mono text-[13px]">{maskPreview(item.value)}</span>
                  <span className="rounded-full bg-cream px-2.5 py-0.5 text-[11px] text-muted-foreground">
                    {item.category}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {item.occurrences} occurrence{item.occurrences > 1 ? "s" : ""}
                  </span>
                  <div className="ml-auto flex gap-1 rounded-full bg-cream p-1 text-xs font-medium">
                    {(["mask", "remove", "keep"] as const).map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => v.setSensitiveAction(item.id, a)}
                        className={
                          item.action === a
                            ? "rounded-full bg-sagedeep px-3 py-1 capitalize text-paper"
                            : "rounded-full px-3 py-1 capitalize text-muted-foreground"
                        }
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <PrimaryButton onClick={applyProtect} disabled={busy !== null}>
              {busy === "Protecting…" ? "Protecting…" : "Apply protection & continue"}
            </PrimaryButton>
            <span className="text-xs text-muted-foreground">
              Full values are never displayed, logged or placed in the address bar.
            </span>
          </div>
        </Panel>
      ) : null}

      {/* ------------------------------ STEP 4 ------------------------------ */}
      {v.step === 4 ? (
        <div className="grid gap-6 xl:grid-cols-12">
          <Panel className="xl:col-span-7">
            <PanelHead eyebrow="Step 4 · Configure" title="Audience & Tone" />
            <div className="mt-5 grid gap-x-6 gap-y-5 text-sm sm:grid-cols-2">
              <Field label="Audience">
                {AUDIENCES.map((a) => (
                  <Chip
                    key={a}
                    label={a}
                    active={v.config.audience === a}
                    onClick={() => v.setConfig({ audience: a })}
                  />
                ))}
              </Field>
              <Field label="Tone">
                {TONES.map((t) => (
                  <Chip
                    key={t}
                    label={t}
                    active={v.config.tone === t}
                    onClick={() => v.setConfig({ tone: t })}
                  />
                ))}
              </Field>
              <Field label="Complexity">
                {COMPLEXITIES.map((c) => (
                  <Chip
                    key={c}
                    label={c}
                    active={v.config.complexity === c}
                    onClick={() => v.setConfig({ complexity: c })}
                  />
                ))}
              </Field>
              <Field label="Length">
                {LENGTHS.map((l) => (
                  <Chip
                    key={l}
                    label={l}
                    active={v.config.length === l}
                    onClick={() => v.setConfig({ length: l })}
                  />
                ))}
              </Field>
              <Field label="Language">
                <select
                  value={v.config.language}
                  onChange={(e) => v.setConfig({ language: e.target.value as (typeof LANGUAGES)[number] })}
                  className="w-full rounded-xl border border-sand bg-cream px-3 py-2 text-sm outline-none focus:border-sage"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Structure sections">
                {SECTIONS.map((s) => (
                  <Chip
                    key={s}
                    label={s}
                    active={v.config.sections.includes(s)}
                    onClick={() =>
                      v.setConfig({
                        sections: v.config.sections.includes(s)
                          ? v.config.sections.filter((x) => x !== s)
                          : [...v.config.sections, s],
                      })
                    }
                  />
                ))}
              </Field>
            </div>
            <p className="mt-5 rounded-2xl bg-cream px-4 py-3 text-xs italic text-sagedeep">
              “VERIX adapts the same information to suit different audiences.”
            </p>
            <div className="mt-5">
              <PrimaryButton onClick={() => v.setStep(5)}>Continue to Generate</PrimaryButton>
            </div>
          </Panel>

          <Panel className="xl:col-span-5">
            <PanelHead
              eyebrow="Preview"
              title="Template preview"
              hint="How the request will be framed before generation."
            />
            <div className="mt-4 space-y-2 rounded-2xl bg-cream p-4 text-xs leading-relaxed">
              <p>
                <strong>Audience:</strong> {v.config.audience} · <strong>Tone:</strong>{" "}
                {v.config.tone}
              </p>
              <p>
                <strong>Complexity:</strong> {v.config.complexity} · <strong>Length:</strong>{" "}
                {v.config.length} · <strong>Language:</strong> {v.config.language}
              </p>
              <p>
                <strong>Sections:</strong>{" "}
                {v.config.sections.length ? v.config.sections.join(" → ") : "Model decides"}
              </p>
              <p className="text-muted-foreground">
                Protected working copy: {wordCount(sourceForGeneration)} words
                {v.sensitive.filter((s) => s.action !== "keep").length
                  ? ` · ${v.sensitive.filter((s) => s.action !== "keep").length} item(s) redacted`
                  : ""}
              </p>
            </div>
          </Panel>
        </div>
      ) : null}

      {/* ------------------------------ STEP 5 ------------------------------ */}
      {v.step === 5 ? (
        <div className="grid gap-6 xl:grid-cols-12">
          <Panel className="xl:col-span-7">
            <PanelHead
              eyebrow="Step 5 · Generate"
              title="One-to-Many Transformation"
              hint="Select every format you need. VERIX produces them all from the same protected source."
            />
            <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {OUTPUT_TYPES.map((t) => {
                const on = v.selected.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => v.toggleSelected(t)}
                    disabled={busy !== null}
                    className={
                      on
                        ? "flex items-center gap-3 rounded-2xl border border-sand bg-cream px-4 py-3 text-left text-sm"
                        : "flex items-center gap-3 rounded-2xl border border-dashed border-sand bg-paper px-4 py-3 text-left text-sm text-muted-foreground"
                    }
                  >
                    <span
                      className={
                        on
                          ? "grid size-5 place-items-center rounded-md bg-sagedeep text-xs text-paper"
                          : "size-5 rounded-md border border-sand"
                      }
                    >
                      {on ? "✓" : ""}
                    </span>
                    {t}
                  </button>
                );
              })}
            </div>
            <div className="mt-5">
              <PrimaryButton
                className="w-full py-3.5"
                onClick={() => void generateAll()}
                disabled={busy !== null || v.selected.length === 0}
              >
                {busy === "Generating…"
                  ? `Generating… ${progress?.done ?? 0}/${progress?.total ?? 0}`
                  : "GENERATE ALL"}
              </PrimaryButton>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                {v.selected.length} selected · {v.config.audience} · {v.config.language}
              </p>
            </div>
          </Panel>

          <Panel className="xl:col-span-5">
            <p className="eyebrow">Concept</p>
            <p className="mt-2 font-display text-2xl leading-tight">
              1 Source <span className="text-clay">→</span> Multiple Outputs
            </p>
            <div className="mt-5 rounded-2xl bg-cream p-4 font-mono text-xs leading-relaxed">
              <p>{v.doc?.title ?? "Source Document"}</p>
              <p className="text-muted-foreground">↓</p>
              {v.selected.map((t, i) => (
                <p key={t}>
                  {i === v.selected.length - 1 ? "└──" : "├──"} {t}
                </p>
              ))}
              {v.selected.length === 0 ? (
                <p className="text-muted-foreground">└── (select at least one format)</p>
              ) : null}
            </div>
          </Panel>
        </div>
      ) : null}

      {/* ------------------------------ STEP 6 ------------------------------ */}
      {v.step === 6 ? (
        v.outputs.length === 0 ? (
          <EmptyState
            title="Nothing to verify yet"
            hint="Generate at least one output first."
            action={<PrimaryButton onClick={() => v.setStep(5)}>Back to Generate</PrimaryButton>}
          />
        ) : (
          <div className="space-y-6">
            <Panel>
              <PanelHead
                eyebrow="Step 6 · Verify"
                title="Source-Grounded Verification"
                hint="Checks whether generated claims are supported by the original source. References point to real sections; unmatched claims are flagged rather than assumed correct."
                right={
                  <span className="rounded-full bg-sage/15 px-3 py-1 text-xs font-semibold text-sagedeep">
                    {v.outputs.flatMap((o) => o.verification).filter((c) => c.status === "Supported").length}{" "}
                    supported ·{" "}
                    {v.outputs.flatMap((o) => o.verification).filter((c) => c.status === "Needs Review").length}{" "}
                    need review
                  </span>
                }
              />
              <div className="mt-5 space-y-5">
                {v.outputs.map((o) => (
                  <div key={o.id}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {o.type}
                    </p>
                    <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {o.verification.map((c, i) => (
                        <div key={i} className="rounded-2xl border border-sand bg-cream p-4">
                          <p className="text-xs leading-relaxed">“{c.claim}”</p>
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <VerifyBadge status={c.status} />
                            <span className="text-right text-[11px] text-muted-foreground">
                              {c.sourceRef ?? "No matching source section"}
                            </span>
                          </div>
                          {c.excerpt ? (
                            <p className="mt-2 border-l-2 border-sand pl-2 text-[11px] italic text-muted-foreground">
                              {c.excerpt}
                            </p>
                          ) : null}
                        </div>
                      ))}
                      {o.verification.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No verifiable statements were extracted from this output.
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
            <PrimaryButton onClick={() => v.setStep(7)}>Continue to Review</PrimaryButton>
          </div>
        )
      ) : null}

      {/* ------------------------------ STEP 7 ------------------------------ */}
      {v.step === 7 ? (
        v.outputs.length === 0 || !current ? (
          <EmptyState
            title="No generated content yet"
            hint="Run Generate All first, then review and approve each output here."
            action={<PrimaryButton onClick={() => v.setStep(5)}>Back to Generate</PrimaryButton>}
          />
        ) : (
          <Panel>
            <PanelHead
              eyebrow="Step 7 · Review"
              title="Human Review & Version Management"
              hint="AI output never becomes final until a person approves it."
            />
            <div className="mt-4 flex flex-wrap gap-1 rounded-full bg-cream p-1 text-xs font-medium">
              {v.outputs.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setActiveTab(o.type)}
                  className={
                    current.id === o.id
                      ? "rounded-full bg-sagedeep px-3 py-1.5 text-paper"
                      : "rounded-full px-3 py-1.5 text-muted-foreground"
                  }
                >
                  {o.type}
                </button>
              ))}
            </div>
            <div className="mt-5">
              <OutputEditor
                output={current}
                regenerating={regenerating === current.id}
                onRegenerate={() => void regenerateOne(current)}
              />
            </div>
            <div className="mt-6">
              <PrimaryButton
                onClick={() => {
                  v.commitTransformation();
                  v.setStep(8);
                }}
              >
                Continue to Export
              </PrimaryButton>
            </div>
          </Panel>
        )
      ) : null}

      {/* ------------------------------ STEP 8 ------------------------------ */}
      {v.step === 8 ? (
        <Panel>
          <PanelHead
            eyebrow="Step 8 · Export"
            title="Approve & Export"
            hint="Approved outputs export cleanly. Drafts can still be exported, with a warning."
          />
          {v.outputs.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Nothing has been generated yet.</p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="eyebrow text-left">
                    <th className="py-2 font-medium">Output</th>
                    <th className="py-2 font-medium">Status</th>
                    <th className="py-2 font-medium">Versions</th>
                    <th className="py-2 font-medium">Checks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand/70">
                  {v.outputs.map((o) => (
                    <tr key={o.id}>
                      <td className="py-3">{o.type}</td>
                      <td className="py-3">{o.status}</td>
                      <td className="py-3 text-muted-foreground">{o.versions.length}</td>
                      <td className="py-3 text-muted-foreground">
                        {o.verification.filter((c) => c.status === "Supported").length}/
                        {o.verification.length} supported
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <PrimaryButton
              disabled={v.outputs.length === 0}
              onClick={() => {
                v.commitTransformation();
                toast.success("Transformation saved to History");
                void navigate({ to: "/history" });
              }}
            >
              Save to History
            </PrimaryButton>
            <GhostButton onClick={() => void navigate({ to: "/generated" })}>
              Open Generated Content
            </GhostButton>
            <span className="text-xs text-muted-foreground">
              {approved.length} of {v.outputs.length} approved
            </span>
          </div>
        </Panel>
      ) : null}
    </AppShell>
  );
}
