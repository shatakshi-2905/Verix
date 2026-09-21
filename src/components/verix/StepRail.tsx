import { cn } from "@/lib/utils";

export const STEPS = [
  "Input",
  "Analyze",
  "Protect",
  "Configure",
  "Generate",
  "Verify",
  "Review",
  "Export",
] as const;

export function StepRail({
  current,
  reachable,
  onSelect,
}: {
  current: number;
  reachable: number;
  onSelect: (n: number) => void;
}) {
  return (
    <div className="mb-8 flex items-center gap-1.5 overflow-x-auto pb-1">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n === current ? "current" : n < current ? "done" : "todo";
        const enabled = n <= reachable;
        return (
          <div key={label} className="flex items-center gap-1.5">
            {i > 0 ? <span className="h-px w-4 shrink-0 bg-sand" /> : null}
            <button
              type="button"
              disabled={!enabled}
              onClick={() => onSelect(n)}
              className={cn(
                "whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] transition-colors",
                state === "current" && "bg-sagedeep font-semibold text-paper",
                state === "done" && "border border-sage/40 bg-sage/20 font-semibold text-sagedeep",
                state === "todo" && "border border-sand bg-paper font-medium text-muted-foreground",
                !enabled && "cursor-not-allowed opacity-60",
              )}
            >
              {n} {label}
            </button>
          </div>
        );
      })}
    </div>
  );
}
