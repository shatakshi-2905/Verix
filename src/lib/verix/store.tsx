import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  Analysis,
  Config,
  GeneratedOutput,
  OutputType,
  ReviewStatus,
  SensitiveItem,
  SourceDoc,
  Transformation,
} from "./types";
import { newId } from "./utils";
import { api } from "../api";
import { updateOutput as apiUpdateOutput } from "./ai.functions";
import { useAuth } from "../auth/AuthProvider";

/**
 * UI workflow state is kept in memory; durable documents and transformations are stored through the FastAPI backend.
 */

interface State {
  documents: SourceDoc[];
  transformations: Transformation[];
  step: number;
  doc: SourceDoc | null;
  analysis: Analysis | null;
  sensitive: SensitiveItem[];
  protectedText: string | null;
  config: Config;
  selected: OutputType[];
  outputs: GeneratedOutput[];
}

const DEFAULT_CONFIG: Config = {
  audience: "General Public",
  tone: "Simple",
  complexity: "Basic",
  length: "Medium",
  language: "English",
  sections: ["Title", "Introduction", "Key Points", "Recommendations", "Conclusion"],
};

const initial: State = {
  documents: [],
  transformations: [],
  step: 1,
  doc: null,
  analysis: null,
  sensitive: [],
  protectedText: null,
  config: DEFAULT_CONFIG,
  selected: ["Executive Summary", "Advisory", "LinkedIn Post", "X Post"],
  outputs: [],
};

interface Ctx extends State {
  setStep: (n: number) => void;
  setDoc: (doc: SourceDoc) => void;
  setAnalysis: (a: Analysis | null) => void;
  setSensitive: (items: SensitiveItem[]) => void;
  setSensitiveAction: (id: string, action: SensitiveItem["action"]) => void;
  setAllSensitiveActions: (action: SensitiveItem["action"]) => void;
  setProtectedText: (t: string | null) => void;
  setConfig: (patch: Partial<Config>) => void;
  toggleSelected: (t: OutputType) => void;
  setOutputs: (o: GeneratedOutput[]) => void;
  updateOutput: (id: string, patch: Partial<GeneratedOutput>) => void;
  saveVersion: (id: string, content: string) => void;
  setOutputStatus: (id: string, status: ReviewStatus) => void;
  commitTransformation: () => void;
  resetWorkflow: () => void;
}

const VerixContext = createContext<Ctx | null>(null);

export function VerixProvider({ children }: { children: ReactNode }) {
  const [s, set] = useState<State>(initial);
  const { ready, user } = useAuth();

  useEffect(() => {
    if (!ready || !user) return;
    void Promise.all([api<any[]>("/api/documents"), api<any[]>("/api/transformations")]).then(([docs, trs]) => {
      const documents: SourceDoc[] = docs.map((d) => ({ id:d.id, title:d.title, kind:d.kind, text:"", wordCount:d.word_count, isDemo:d.is_demo, createdAt:d.created_at }));
      const transformations: Transformation[] = trs.map((t:any) => ({
        id:t.id, docTitle:t.documents?.title ?? "Document", docId:t.document_id, audience:t.config?.audience ?? "General Public", language:t.config?.language ?? "English", sensitiveCount:t.sensitive_count ?? 0, createdAt:t.created_at,
        outputs:(t.outputs ?? []).map((o:any) => ({ id:o.id, type:o.output_type, format:o.format, data:o.data, content:o.content, formatChecks:o.format_checks ?? [], status:o.status, versions:o.versions ?? [], activeVersion:o.active_version ?? 1, verification:o.verification ?? [], createdAt:o.created_at }))
      }));
      set(prev => ({ ...prev, documents, transformations }));
    }).catch(() => undefined);
  }, [ready, user]);

  const patch = useCallback((p: Partial<State>) => set((prev) => ({ ...prev, ...p })), []);

  const value = useMemo<Ctx>(
    () => ({
      ...s,
      setStep: (n) => patch({ step: n }),
      setDoc: (doc) =>
        set((prev) => ({
          ...prev,
          doc,
          analysis: null,
          sensitive: [],
          protectedText: null,
          outputs: [],
          documents: prev.documents.some((d) => d.id === doc.id)
            ? prev.documents
            : [doc, ...prev.documents],
        })),
      setAnalysis: (a) => patch({ analysis: a }),
      setSensitive: (items) => patch({ sensitive: items }),
      setSensitiveAction: (id, action) =>
        set((prev) => ({
          ...prev,
          sensitive: prev.sensitive.map((i) => (i.id === id ? { ...i, action } : i)),
        })),
      setAllSensitiveActions: (action) =>
        set((prev) => ({ ...prev, sensitive: prev.sensitive.map((i) => ({ ...i, action })) })),
      setProtectedText: (t) => patch({ protectedText: t }),
      setConfig: (p) => set((prev) => ({ ...prev, config: { ...prev.config, ...p } })),
      toggleSelected: (t) =>
        set((prev) => ({
          ...prev,
          selected: prev.selected.includes(t)
            ? prev.selected.filter((x) => x !== t)
            : [...prev.selected, t],
        })),
      setOutputs: (o) => patch({ outputs: o }),
      // Every mutation below is mirrored to the backend via PATCH
      // /api/outputs/{id} (best-effort — a failure here shouldn't block the
      // in-session UI, but it does mean approvals/edits survive a reload).
      // This only works once the output has a real database id, which
      // create.tsx assigns right after /api/transformations responds.
      updateOutput: (id, p) =>
        set((prev) => {
          const current = prev.outputs.find((o) => o.id === id);
          if (current && (p.content !== undefined || p.status !== undefined)) {
            const status = p.status ?? current.status;
            void apiUpdateOutput(
              id,
              p.content !== undefined ? { status, content: p.content } : { status },
            ).catch(() => undefined);
          }
          return {
            ...prev,
            outputs: prev.outputs.map((o) => (o.id === id ? { ...o, ...p } : o)),
          };
        }),
      saveVersion: (id, content) =>
        set((prev) => ({
          ...prev,
          outputs: prev.outputs.map((o) => {
            if (o.id !== id) return o;
            const n = o.versions.length + 1;
            void apiUpdateOutput(id, { status: "Under Review", content }).catch(() => undefined);
            return {
              ...o,
              content,
              // Hand-edited text no longer maps to the validated structured payload.
              data: null,
              status: "Under Review" as const,
              activeVersion: n,
              versions: [
                ...o.versions,
                { n, content, label: "User edited", createdAt: new Date().toISOString(), data: null },
              ],
            };
          }),
        })),
      setOutputStatus: (id, status) =>
        set((prev) => {
          void apiUpdateOutput(id, { status }).catch(() => undefined);
          return {
            ...prev,
            outputs: prev.outputs.map((o) => (o.id === id ? { ...o, status } : o)),
          };
        }),
      commitTransformation: () =>
        set((prev) => {
          if (!prev.doc || prev.outputs.length === 0) return prev;
          const record: Transformation = {
            id: newId("tr"),
            docTitle: prev.doc.title,
            docId: prev.doc.id,
            audience: prev.config.audience,
            language: prev.config.language,
            outputs: prev.outputs,
            sensitiveCount: prev.sensitive.length,
            createdAt: new Date().toISOString(),
          };
          const existingIdx = prev.transformations.findIndex((t) => t.docId === prev.doc?.id);
          const transformations =
            existingIdx >= 0
              ? prev.transformations.map((t, i) => (i === existingIdx ? { ...record, id: t.id, createdAt: t.createdAt } : t))
              : [record, ...prev.transformations];
          return { ...prev, transformations };
        }),
      resetWorkflow: () =>
        set((prev) => ({
          ...prev,
          step: 1,
          doc: null,
          analysis: null,
          sensitive: [],
          protectedText: null,
          outputs: [],
        })),
    }),
    [s, patch],
  );

  return <VerixContext.Provider value={value}>{children}</VerixContext.Provider>;
}

export function useVerix() {
  const ctx = useContext(VerixContext);
  if (!ctx) throw new Error("useVerix must be used inside VerixProvider");
  return ctx;
}
