import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/verix/AppShell";
import { Chip, Field, GhostButton, Panel, PanelHead } from "@/components/verix/ui";
import { useVerix } from "@/lib/verix/store";
import { AUDIENCES, COMPLEXITIES, LANGUAGES, LENGTHS, TONES } from "@/lib/verix/types";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — VERIX" },
      {
        name: "description",
        content:
          "Set the default audience, tone, complexity, length and language used for new VERIX transformations.",
      },
      { property: "og:title", content: "Settings — VERIX" },
      {
        property: "og:description",
        content: "Defaults for audience, tone, complexity, length and language.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const v = useVerix();

  return (
    <AppShell title="Settings" subtitle="Defaults applied when you start a new transformation.">
      <Panel>
        <PanelHead title="Generation defaults" />
        <div className="mt-4 space-y-5">
          <Field label="Audience">
            <div className="flex flex-wrap gap-2">
              {AUDIENCES.map((a) => (
                <Chip
                  key={a}
                  active={v.config.audience === a}
                  onClick={() => v.setConfig({ audience: a })}
                 label={a} />
              ))}
            </div>
          </Field>
          <Field label="Tone">
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <Chip key={t} active={v.config.tone === t} onClick={() => v.setConfig({ tone: t })} label={t} />
              ))}
            </div>
          </Field>
          <Field label="Complexity">
            <div className="flex flex-wrap gap-2">
              {COMPLEXITIES.map((c) => (
                <Chip
                  key={c}
                  active={v.config.complexity === c}
                  onClick={() => v.setConfig({ complexity: c })}
                 label={c} />
              ))}
            </div>
          </Field>
          <Field label="Length">
            <div className="flex flex-wrap gap-2">
              {LENGTHS.map((l) => (
                <Chip
                  key={l}
                  active={v.config.length === l}
                  onClick={() => v.setConfig({ length: l })}
                 label={l} />
              ))}
            </div>
          </Field>
          <Field label="Language">
            <select
              value={v.config.language}
              onChange={(e) => v.setConfig({ language: e.target.value as (typeof LANGUAGES)[number] })}
              className="w-full max-w-xs rounded-xl border border-sand bg-cream px-3 py-2 text-sm outline-none focus:border-sage"
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Panel>

      <Panel className="mt-6">
        <PanelHead
          title="Session data"
          hint="Clears the in-progress workflow in this tab. Saved transformations stay in your workspace."
        />
        <div className="mt-4">
          <GhostButton
            onClick={() => {
              v.resetWorkflow();
              toast.success("Current workflow cleared.");
            }}
          >
            Clear current workflow
          </GhostButton>
        </div>
      </Panel>
    </AppShell>
  );
}
