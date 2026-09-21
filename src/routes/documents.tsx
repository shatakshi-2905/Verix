import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/verix/AppShell";
import { DemoBadge, EmptyState, Panel, Tag } from "@/components/verix/ui";
import { useVerix } from "@/lib/verix/store";

export const Route = createFileRoute("/documents")({
  head: () => ({
    meta: [
      { title: "Documents — VERIX" },
      {
        name: "description",
        content: "Every source document loaded in this VERIX session, with word counts and origin.",
      },
      { property: "og:title", content: "Documents — VERIX" },
      { property: "og:description", content: "Source documents loaded in this VERIX session." },
    ],
  }),
  component: DocumentsPage,
});

function DocumentsPage() {
  const v = useVerix();

  return (
    <AppShell title="Documents" subtitle="Sources stored in your authenticated workspace.">
      <Panel>
        {v.documents.length === 0 ? (
          <EmptyState
            title="No documents yet"
            hint="Upload a PDF, DOCX or TXT, paste text, fetch a URL, or load the demo."
            action={
              <Link
                to="/create"
                className="rounded-full bg-sagedeep px-4 py-2 text-sm font-semibold text-paper"
              >
                Add a document
              </Link>
            }
          />
        ) : (
          <ul className="space-y-3">
            {v.documents.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sand bg-cream px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold">{d.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {d.wordCount.toLocaleString()} words ·{" "}
                    {new Date(d.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Tag>{d.kind}</Tag>
                  {d.isDemo ? <DemoBadge /> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AppShell>
  );
}
