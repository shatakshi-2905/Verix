import type { ClaimCheck } from "./types";

/**
 * Source-grounded verification.
 * Every claim is compared against the actual source text using lexical
 * overlap. Section references come from real headings in the source — the
 * system never invents a citation. Unmatched claims are marked Needs Review.
 */

const STOP = new Set(
  "the a an and or of to in on for with is are be been was were that this these those it its as at by from will shall should must may can not no if then than have has had do does did you your our their they them we us".split(
    " ",
  ),
);

interface Segment {
  ref: string;
  text: string;
}

export function segmentSource(source: string): Segment[] {
  const lines = source.split(/\n+/);
  const segments: Segment[] = [];
  let currentSection = "Document";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const sectionMatch = trimmed.match(/^Section\s+(\d+)\s*[—-]\s*(.+)$/i);
    if (sectionMatch) {
      currentSection = `Section ${sectionMatch[1]} — ${sectionMatch[2]}`;
      continue;
    }
    const numbered = trimmed.match(/^(\d+\.\d+)\s+(.*)$/);
    if (numbered) {
      segments.push({ ref: `${currentSection} · ${numbered[1]}`, text: numbered[2] ?? "" });
      continue;
    }
    for (const sentence of splitSentences(trimmed)) {
      segments.push({ ref: currentSection, text: sentence });
    }
  }
  return segments;
}

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30);
}

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0) return 0;
  let hits = 0;
  for (const t of a) if (b.has(t)) hits += 1;
  return hits / a.size;
}

export function verifyClaims(claims: string[], source: string): ClaimCheck[] {
  const segments = segmentSource(source).map((s) => ({ ...s, tokens: tokens(s.text) }));

  return claims.map((claim) => {
    const ct = tokens(claim);
    let best = { score: 0, ref: null as string | null, excerpt: null as string | null };

    for (const seg of segments) {
      const score = overlap(ct, seg.tokens);
      if (score > best.score) {
        best = { score, ref: seg.ref, excerpt: seg.text.slice(0, 220) };
      }
    }

    if (best.score >= 0.6) {
      return { claim, status: "Supported", sourceRef: best.ref, excerpt: best.excerpt };
    }
    if (best.score >= 0.35) {
      return { claim, status: "Partially Supported", sourceRef: best.ref, excerpt: best.excerpt };
    }
    return { claim, status: "Needs Review", sourceRef: null, excerpt: null };
  });
}

/** Picks the most substantive statements from a generated output to verify. */
export function extractClaims(content: string, limit = 6): string[] {
  const sentences = splitSentences(content.replace(/[#*_>`]/g, " "));
  return sentences
    .filter((s) => /[a-z]/.test(s) && !s.endsWith(":"))
    .sort((a, b) => b.length - a.length)
    .slice(0, limit);
}
