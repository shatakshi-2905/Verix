import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/verix/AppShell";
import { EmptyState, Panel, StatusBadge, Tag } from "@/components/verix/ui";
import { useVerix } from "@/lib/verix/store";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "History — VERIX" },
      {
        name: "description",
        content:
          "A chronological record of every transformation run in this session, including audience, language and approvals.",
      },
      { property: "og:title", content: "History — VERIX" },
      {
        property: "og:description",
        content: "Chronological record of transformations, audiences and approvals.",
      },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const v = useVerix();

  return (
    <AppShell title="History" subtitle="What was transformed, for whom, and how it was reviewed.">
      <Panel>
        {v.transformations.length === 0 ? (
          <EmptyState
            title="No history yet"
            hint="Completed transformations are recorded here for the workspace."
            action={
              <Link
                to="/create"
                className="rounded-full bg-sagedeep px-4 py-2 text-sm font-semibold text-paper"
              >
                Create transformation
              </Link>
            }
          />
        ) : (
          <ol className="space-y-3">
            {v.transformations.map((t) => (
              <li key={t.id} className="rounded-2xl border border-sand bg-cream px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{t.docTitle}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(t.createdAt).toLocaleString()} · {t.sensitiveCount} sensitive items
                      handled
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Tag>{t.audience}</Tag>
                    <Tag>{t.language}</Tag>
                    {t.outputs.map((o) => (
                      <StatusBadge key={o.id} status={o.status} />
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </AppShell>
  );
}
