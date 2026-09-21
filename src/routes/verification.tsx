import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/verix/AppShell";
import { EmptyState, Panel, PanelHead, VerifyBadge } from "@/components/verix/ui";
import { useVerix } from "@/lib/verix/store";

export const Route = createFileRoute("/verification")({
  head: () => ({
    meta: [
      { title: "Verification — VERIX" },
      {
        name: "description",
        content:
          "Every generated claim checked against the original source, with section references and matched excerpts.",
      },
      { property: "og:title", content: "Verification — VERIX" },
      {
        property: "og:description",
        content: "Source-grounded claim checks with section references and excerpts.",
      },
    ],
  }),
  component: VerificationPage,
});

function VerificationPage() {
  const v = useVerix();
  const rows = v.transformations.flatMap((t) =>
    t.outputs.map((o) => ({ docTitle: t.docTitle, output: o })),
  );

  return (
    <AppShell
      title="Verification"
      subtitle="Claims are matched to real source text — VERIX never invents a citation."
    >
      {rows.length === 0 ? (
        <Panel>
          <EmptyState
            title="No verification results yet"
            hint="Generate content and VERIX will check each claim against the source."
            action={
              <Link
                to="/create"
                className="rounded-full bg-sagedeep px-4 py-2 text-sm font-semibold text-paper"
              >
                Start a transformation
              </Link>
            }
          />
        </Panel>
      ) : (
        <div className="space-y-5">
          {rows.map(({ docTitle, output }) => (
            <Panel key={output.id}>
              <PanelHead title={`${output.type}`} hint={docTitle} />
              <ul className="mt-4 space-y-3">
                {output.verification.length === 0 ? (
                  <li className="text-xs text-muted-foreground">No claims extracted.</li>
                ) : (
                  output.verification.map((c, i) => (
                    <li key={i} className="rounded-2xl border border-sand bg-cream p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="max-w-[70ch] text-sm">{c.claim}</p>
                        <VerifyBadge status={c.status} />
                      </div>
                      {c.excerpt ? (
                        <p className="mt-2 border-l-2 border-sage/50 pl-3 text-[11px] italic text-muted-foreground">
                          {c.excerpt}
                        </p>
                      ) : null}
                      {c.sourceRef ? (
                        <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                          {c.sourceRef}
                        </p>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </AppShell>
  );
}
