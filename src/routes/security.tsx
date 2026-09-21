import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AppShell } from "@/components/verix/AppShell";
import { Panel, PanelHead, Stat } from "@/components/verix/ui";
import { useVerix } from "@/lib/verix/store";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: "Security & Privacy — VERIX" },
      {
        name: "description",
        content:
          "How VERIX protects sensitive information: session-only storage, masking before generation and prompt-injection defences.",
      },
      { property: "og:title", content: "Security & Privacy — VERIX" },
      {
        property: "og:description",
        content: "Session-only storage, sensitive-data masking and prompt-injection defences.",
      },
    ],
  }),
  component: SecurityPage,
});

const PRACTICES = [
  {
    title: "Authenticated workspace storage",
    body: "Documents and transformation history are stored in your authenticated workspace, isolated per account by row-level security; the browser stores only the session tokens needed for authentication.",
  },
  {
    title: "Protect before generate",
    body: "Detected personal data is masked or removed in the text that is sent for generation, so raw identifiers never reach the model.",
  },
  {
    title: "Prompt-injection defence",
    body: "Source content is fenced and treated strictly as data. Instructions found inside a document are ignored, never executed.",
  },
  {
    title: "Source-grounded output",
    body: "Every claim is matched back to real source text. Unmatched statements are flagged Needs Review instead of being presented as fact.",
  },
  {
    title: "Human-in-the-loop",
    body: "AI output stays a draft until a person edits, approves and exports it. Approval is always a human action.",
  },
  {
    title: "Safe input handling",
    body: "Uploads are size- and type-limited, filenames are sanitised for display, and fetched URLs are stripped to plain text.",
  },
];

function SecurityPage() {
  const v = useVerix();
  const masked = v.sensitive.filter((s) => s.action !== "keep").length;
  const [logs, setLogs] = useState<any[]>([]);
  useEffect(() => { void api<any[]>("/api/audit-logs").then(setLogs).catch(() => setLogs([])); }, []);

  return (
    <AppShell
      title="Security & Privacy"
      subtitle="Protection is part of the pipeline, not an afterthought."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Panel>
          <Stat value={v.sensitive.length} label="Sensitive items detected" />
        </Panel>
        <Panel>
          <Stat value={masked} label="Masked or removed" />
        </Panel>
        <Panel>
          <Stat value={v.documents.length} label="Documents in your workspace" />
        </Panel>
      </div>

      <Panel className="mt-6">
        <PanelHead title="Recent audit activity" hint="Workflow actions are recorded without storing raw source text or PII values." />
        {logs.length ? (
          <div className="mt-4 space-y-2">
            {logs.slice(0, 12).map((log) => (
              <div key={log.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-cream px-3 py-2 text-xs">
                <div><span className="font-semibold">{log.action}</span><span className="ml-2 text-muted-foreground">{log.resource_type || "system"}</span></div>
                <span className="text-[11px] text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        ) : <p className="mt-4 text-xs text-muted-foreground">No audit events yet.</p>}
      </Panel>

      <Panel className="mt-6">
        <PanelHead title="How VERIX protects your content" />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {PRACTICES.map((p) => (
            <article key={p.title} className="rounded-2xl border border-sand bg-cream p-4">
              <h3 className="text-sm font-semibold text-sagedeep">{p.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{p.body}</p>
            </article>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
