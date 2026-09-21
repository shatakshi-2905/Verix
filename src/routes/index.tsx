import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/verix/AppShell";
import { EmptyState, Panel, PanelHead, Stat, StatusBadge } from "@/components/verix/ui";
import { useVerix } from "@/lib/verix/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VERIX Dashboard — One Source, Many Audiences" },
      {
        name: "description",
        content:
          "See documents processed, outputs generated and pending reviews at a glance, then start a new content transformation.",
      },
      { property: "og:title", content: "VERIX Dashboard — One Source, Many Audiences" },
      {
        property: "og:description",
        content: "Track documents, generated outputs and human reviews in one controlled workflow.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const v = useVerix();
  const outputs = v.transformations.flatMap((t) => t.outputs);
  const pending = outputs.filter((o) => o.status !== "Approved").length;

  return (
    <AppShell
      title="Dashboard"
      subtitle="One source in. Many trusted, audience-ready outputs out."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Panel>
          <Stat value={v.documents.length} label="Documents processed" />
        </Panel>
        <Panel>
          <Stat value={outputs.length} label="Outputs generated" />
        </Panel>
        <Panel>
          <Stat value={pending} label="Pending review" />
        </Panel>
        <Panel>
          <Stat value={v.transformations.length} label="Transformations" />
        </Panel>
      </div>

      <Panel className="mt-6">
        <PanelHead
          title="Recent transformations"
          hint="Stored securely in your VERIX workspace."
        />
        {v.transformations.length === 0 ? (
          <EmptyState
            title="No transformations yet"
            hint="Start with a document, a pasted text or the built-in demo advisory."
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
          <ul className="mt-4 space-y-3">
            {v.transformations.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sand bg-cream px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold">{t.docTitle}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t.audience} · {t.language} · {t.outputs.length} outputs
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {t.outputs.map((o) => (
                    <StatusBadge key={o.id} status={o.status} />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AppShell>
  );
}
