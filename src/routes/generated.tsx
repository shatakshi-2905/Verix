import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/verix/AppShell";
import { AiBadge, EmptyState, Panel, PanelHead, StatusBadge } from "@/components/verix/ui";
import { useVerix } from "@/lib/verix/store";

export const Route = createFileRoute("/generated")({
  head: () => ({
    meta: [
      { title: "Generated Content — VERIX" },
      {
        name: "description",
        content:
          "Browse every AI-generated output produced in this session, grouped by source document and review status.",
      },
      { property: "og:title", content: "Generated Content — VERIX" },
      {
        property: "og:description",
        content: "AI-generated outputs grouped by source document and review status.",
      },
    ],
  }),
  component: GeneratedPage,
});

function GeneratedPage() {
  const v = useVerix();

  return (
    <AppShell title="Generated Content" subtitle="AI drafts awaiting or holding human approval.">
      {v.transformations.length === 0 ? (
        <Panel>
          <EmptyState
            title="Nothing generated yet"
            hint="Run a transformation to create summaries, advisories, emails and posts."
            action={
              <Link
                to="/create"
                className="rounded-full bg-sagedeep px-4 py-2 text-sm font-semibold text-paper"
              >
                Create transformation
              </Link>
            }
          />
        </Panel>
      ) : (
        <div className="space-y-5">
          {v.transformations.map((t) => (
            <Panel key={t.id}>
              <PanelHead title={t.docTitle} hint={`${t.audience} · ${t.language}`} />
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {t.outputs.map((o) => (
                  <article key={o.id} className="rounded-2xl border border-sand bg-cream p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{o.type}</p>
                      <div className="flex items-center gap-1.5">
                        <AiBadge />
                        <StatusBadge status={o.status} />
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                      {o.content}
                    </p>
                  </article>
                ))}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </AppShell>
  );
}
