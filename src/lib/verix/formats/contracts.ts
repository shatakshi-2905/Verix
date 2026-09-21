import { z } from "zod";
import { escapeHtml } from "../utils";

/**
 * FORMAT CONTRACT
 * ---------------
 * One centralized place per output format that owns:
 *   - schema                (strict structured shape the LLM must return)
 *   - generation instructions (format-specific prompt)
 *   - validation rules      (format-specific checks before display/export)
 *   - serializers           (structure-preserving plain text + HTML for export)
 *
 * Renderers live in src/components/verix/formats and key off `payload.format`.
 * Adding a new format = add a schema + one entry in FORMAT_CONTRACTS.
 */

export const X_CHAR_LIMIT = 280;

/* ------------------------------- schemas -------------------------------- */

const str = z.string().min(1).max(4000);
const softStr = z.string().max(4000);

export const LinkedInSchema = z.object({
  format: z.literal("linkedin"),
  hook: str,
  body: z.array(str).min(1).max(8),
  key_points: z.array(str).max(8).default([]),
  cta: softStr,
  hashtags: z.array(z.string().max(60)).max(10).default([]),
});

export const XPostSchema = z.object({
  format: z.literal("x"),
  /** 1 item = a single post. 2+ items = a thread, rendered as "1/3", "2/3", … */
  tweets: z.array(z.string().min(1).max(320)).min(1).max(9),
  hashtags: z.array(z.string().max(40)).max(5).default([]),
});

export const ExecutiveSummarySchema = z.object({
  format: z.literal("executive_summary"),
  title: str,
  overview: str,
  key_findings: z.array(str).min(1).max(10),
  implications: z.array(str).max(10).default([]),
  recommendations: z.array(str).min(1).max(10),
});

export const AdvisorySchema = z.object({
  format: z.literal("advisory"),
  title: str,
  severity: softStr,
  date: z.string().max(80).default(""),
  affected: str,
  summary: str,
  issue: str,
  impact: str,
  recommended_actions: z.array(str).min(1).max(12),
  references: z.array(str).max(10).default([]),
});

export const PptScriptSchema = z.object({
  format: z.literal("ppt_script"),
  title: str,
  slides: z
    .array(
      z.object({
        number: z.number().int().min(1).max(60),
        title: str,
        talking_points: z.array(str).min(1).max(8),
        speaker_notes: str,
      }),
    )
    .min(3)
    .max(20),
});

export const EmailSchema = z.object({
  format: z.literal("email"),
  subject: str,
  greeting: str,
  body: z.array(str).min(1).max(8),
  key_points: z.array(str).max(8).default([]),
  closing: str,
  signature: softStr,
});

export const NewsletterSchema = z.object({
  format: z.literal("newsletter"),
  title: str,
  intro: str,
  items: z
    .array(z.object({ heading: str, body: str }))
    .min(2)
    .max(8),
  closing: softStr,
});

export const SummarySchema = z.object({
  format: z.literal("summary"),
  title: str,
  overview: str,
  key_points: z.array(str).min(1).max(10),
  conclusion: softStr,
});

export type LinkedInPayload = z.infer<typeof LinkedInSchema>;
export type XPostPayload = z.infer<typeof XPostSchema>;
export type ExecutiveSummaryPayload = z.infer<typeof ExecutiveSummarySchema>;
export type AdvisoryPayload = z.infer<typeof AdvisorySchema>;
export type PptScriptPayload = z.infer<typeof PptScriptSchema>;
export type EmailPayload = z.infer<typeof EmailSchema>;
export type NewsletterPayload = z.infer<typeof NewsletterSchema>;
export type SummaryPayload = z.infer<typeof SummarySchema>;

export type FormatPayload =
  | LinkedInPayload
  | XPostPayload
  | ExecutiveSummaryPayload
  | AdvisoryPayload
  | PptScriptPayload
  | EmailPayload
  | NewsletterPayload
  | SummaryPayload;

export type FormatId = FormatPayload["format"];

/* ------------------------------ config in ------------------------------- */

export interface FormatConfig {
  audience: string;
  tone: string;
  complexity: string;
  length: string;
  language: string;
}

export interface FormatCheck {
  label: string;
  ok: boolean;
  detail?: string;
}

export interface FormatContract<P extends FormatPayload = FormatPayload> {
  id: FormatId;
  /** Output type label shown in the UI. */
  label: string;
  schema: z.ZodType<P, z.ZodTypeDef, unknown>;
  /** JSON shape appended to the prompt. */
  jsonShape: string;
  /** Format-specific generation instructions (structure, tone, prohibitions). */
  instructions: (cfg: FormatConfig) => string;
  /** Format-specific validation run before display and export. */
  validate: (payload: P) => FormatCheck[];
  /** Structure-preserving plain text (editor, diff, verification, TXT export). */
  toText: (payload: P) => string;
  /** Structure-preserving HTML (DOC / PDF export). */
  toHtml: (payload: P) => string;
}

/* ------------------------------- helpers -------------------------------- */

const LENGTH_HINT: Record<string, string> = {
  Short: "keep it tight — the shortest workable version of this format",
  Medium: "a balanced, standard-length version of this format",
  Detailed: "a thorough version of this format, still without padding",
};

export function styleBlock(cfg: FormatConfig): string {
  return `Audience: ${cfg.audience}. Tone: ${cfg.tone}. Complexity: ${cfg.complexity}. Language: ${cfg.language}.
Length: ${cfg.length} — ${LENGTH_HINT[cfg.length] ?? "a balanced version"}.
Audience, tone, complexity, length and language change vocabulary, depth and phrasing ONLY. They must never change the required structure or drop required fields.`;
}

/**
 * Applies the "n/N" thread suffix and attaches hashtags to the final tweet.
 * Numbering is added here, programmatically, rather than trusted to the
 * model — the model is told to leave headroom for it instead of writing it.
 */
export function numberTweets(v: XPostPayload): string[] {
  const n = v.tweets.length;
  return v.tweets.map((t, i) => {
    const withTags = i === n - 1 && v.hashtags.length ? `${t} ${v.hashtags.join(" ")}` : t;
    return n > 1 ? `${withTags} ${i + 1}/${n}` : withTags;
  });
}

const bullets = (items: string[], mark = "•") => items.map((i) => `${mark} ${i}`).join("\n");
const ul = (items: string[]) => `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
const p = (t: string) => `<p>${escapeHtml(t)}</p>`;
const h = (n: number, t: string) => `<h${n}>${escapeHtml(t)}</h${n}>`;
const nonEmpty = (s: string | undefined) => !!s && s.trim().length > 0;
const ARTICLE_HEADINGS = /^(introduction|conclusion|overview|abstract|summary|background)\b/i;

/* ------------------------------ contracts ------------------------------- */

const linkedin: FormatContract<LinkedInPayload> = {
  id: "linkedin",
  label: "LinkedIn Post",
  schema: LinkedInSchema,
  jsonShape: `{"format":"linkedin","hook":string,"body":string[],"key_points":string[],"cta":string,"hashtags":string[]}`,
  instructions: (cfg) => `Produce a LinkedIn post.
${styleBlock(cfg)}
Structure contract:
- "hook": one scroll-stopping opening line (max ~140 characters), no hashtags in it.
- "body": 2-4 SHORT paragraphs (1-3 sentences each) written for reading with whitespace between them.
- "key_points": 0-5 crisp bullet lines, only when they genuinely help; each is a standalone line, no trailing period required.
- "cta": one short invitation to respond, share or read on.
- "hashtags": 3-6 items, each starting with "#", no spaces inside a tag.
Prohibited: article-style headings such as "Introduction", "Conclusion", "Overview"; markdown headings or tables; long academic paragraphs; hashtags anywhere outside the hashtags array; emoji spam (at most 2 emoji in total).`,
  validate: (v) => [
    { label: "Hook exists", ok: nonEmpty(v.hook) },
    { label: "Body paragraphs exist", ok: v.body.length > 0 },
    {
      label: "Paragraphs are readable (short)",
      ok: v.body.every((b) => b.split(/\s+/).length <= 80),
      detail: "Each paragraph stays under 80 words.",
    },
    { label: "CTA present", ok: nonEmpty(v.cta) },
    {
      label: "Hashtags separated and well formed",
      ok: v.hashtags.length > 0 && v.hashtags.every((t) => /^#\S+$/.test(t)),
    },
    {
      label: "No article-style headings",
      ok: ![v.hook, ...v.body, ...v.key_points].some((t) => ARTICLE_HEADINGS.test(t.trim())),
    },
  ],
  toText: (v) =>
    [
      v.hook,
      v.body.join("\n\n"),
      v.key_points.length ? bullets(v.key_points, "→") : "",
      v.cta,
      v.hashtags.join(" "),
    ]
      .filter(nonEmpty)
      .join("\n\n"),
  toHtml: (v) =>
    [
      p(v.hook),
      ...v.body.map(p),
      v.key_points.length ? ul(v.key_points) : "",
      nonEmpty(v.cta) ? p(v.cta) : "",
      v.hashtags.length ? p(v.hashtags.join(" ")) : "",
    ].join(""),
};

const xpost: FormatContract<XPostPayload> = {
  id: "x",
  label: "X Post",
  schema: XPostSchema,
  jsonShape: `{"format":"x","tweets":string[],"hashtags":string[]}`,
  instructions: (cfg) => `Produce a single X (Twitter) post — or, only if the content genuinely doesn't fit in one, a short thread.
${styleBlock(cfg)}
Structure contract:
- "tweets": 1 item for a normal post. Use 2-6 items ONLY when the content needs more room than one post allows; each item is one tweet, written so it reads naturally both on its own and as part of the sequence (no "as I was saying" continuations).
- Do NOT write your own numbering like "1/3" inside the text — that is added automatically after generation. Leave about 12 characters of headroom in each tweet for it.
- "hashtags": 1-3 items starting with "#"; they are attached only to the final tweet.
Hard limit: every individual tweet, once its automatic "n/N" suffix (and hashtags on the last one) are added, must be at most ${X_CHAR_LIMIT} characters. Write short and count before answering.
Prohibited: turning this into an article; more than 6 tweets; a thread where any tweet only makes sense out of order; numbering the tweets yourself.`,
  validate: (v) => {
    const numbered = numberTweets(v);
    const isThread = v.tweets.length > 1;
    const checks: FormatCheck[] = [
      { label: "Every tweet has content", ok: v.tweets.length > 0 && v.tweets.every(nonEmpty) },
      {
        label: isThread ? "Reads like a real thread, not an article" : "Reads like a real post",
        ok: v.tweets.every((t) => t.split(/\s+/).length <= 70),
      },
    ];
    numbered.forEach((text, i) => {
      checks.push({
        label: isThread ? `Tweet ${i + 1}/${v.tweets.length} within ${X_CHAR_LIMIT} characters` : `Within ${X_CHAR_LIMIT} characters`,
        ok: text.length <= X_CHAR_LIMIT,
        detail: `${text.length} / ${X_CHAR_LIMIT} characters`,
      });
    });
    checks.push({
      label: "Hashtags separated and well formed",
      ok: v.hashtags.length === 0 || v.hashtags.every((t) => /^#\S+$/.test(t)),
    });
    if (isThread) checks.push({ label: "6 tweets or fewer", ok: v.tweets.length <= 6 });
    return checks;
  },
  toText: (v) => numberTweets(v).join("\n\n"),
  toHtml: (v) => numberTweets(v).map(p).join(""),
};

const executive: FormatContract<ExecutiveSummaryPayload> = {
  id: "executive_summary",
  label: "Executive Summary",
  schema: ExecutiveSummarySchema,
  jsonShape: `{"format":"executive_summary","title":string,"overview":string,"key_findings":string[],"implications":string[],"recommendations":string[]}`,
  instructions: (cfg) => `Produce an executive summary for decision-makers.
${styleBlock(cfg)}
Structure contract:
- "title": a specific, factual document title (no "Executive Summary of…" boilerplate alone).
- "overview": 2-4 sentences stating what this is about and why it matters.
- "key_findings": 3-6 findings, each one sentence, fact-first.
- "implications": 2-4 consequences for the organisation.
- "recommendations": 3-5 concrete actions, each starting with a verb.
Prohibited: marketing language, hashtags, emoji, rhetorical questions, filler like "In today's world".`,
  validate: (v) => [
    { label: "Title present", ok: nonEmpty(v.title) },
    { label: "Executive overview present", ok: nonEmpty(v.overview) },
    { label: "Key findings listed", ok: v.key_findings.length >= 2 },
    { label: "Implications present", ok: v.implications.length >= 1 },
    { label: "Recommendations clearly separated", ok: v.recommendations.length >= 2 },
    {
      label: "Concise professional structure",
      ok: v.overview.split(/\s+/).length <= 160,
    },
  ],
  toText: (v) =>
    [
      v.title.toUpperCase(),
      `OVERVIEW\n${v.overview}`,
      `KEY FINDINGS\n${bullets(v.key_findings)}`,
      v.implications.length ? `IMPLICATIONS\n${bullets(v.implications)}` : "",
      `RECOMMENDATIONS\n${bullets(v.recommendations, "1.")}`,
    ]
      .filter(nonEmpty)
      .join("\n\n"),
  toHtml: (v) =>
    [
      h(1, v.title),
      h(2, "Overview"),
      p(v.overview),
      h(2, "Key findings"),
      ul(v.key_findings),
      v.implications.length ? h(2, "Implications") + ul(v.implications) : "",
      h(2, "Recommendations"),
      ul(v.recommendations),
    ].join(""),
};

const advisory: FormatContract<AdvisoryPayload> = {
  id: "advisory",
  label: "Advisory",
  schema: AdvisorySchema,
  jsonShape: `{"format":"advisory","title":string,"severity":string,"date":string,"affected":string,"summary":string,"issue":string,"impact":string,"recommended_actions":string[],"references":string[]}`,
  instructions: (cfg) => `Produce a formal advisory notice.
${styleBlock(cfg)}
Structure contract:
- "title": advisory headline.
- "severity": one of Critical / High / Medium / Low / Informational — choose only what the source supports.
- "date": a date taken from the source; empty string if the source has none. Never invent a date.
- "affected": the affected systems, people or audience, as stated in the source.
- "summary": 2-3 sentences.
- "issue": what the problem or threat is.
- "impact": what happens if it is not addressed.
- "recommended_actions": 3-6 imperative actions, each a separate item.
- "references": short pointers to the source sections or documents mentioned in the source; empty array if none. Never fabricate a reference or URL.
Prohibited: hashtags, emoji, conversational openers, invented statistics, invented CVEs or dates.`,
  validate: (v) => [
    { label: "Title present", ok: nonEmpty(v.title) },
    { label: "Severity / priority set", ok: nonEmpty(v.severity) },
    { label: "Affected area stated", ok: nonEmpty(v.affected) },
    { label: "Summary, issue and impact present", ok: [v.summary, v.issue, v.impact].every(nonEmpty) },
    { label: "Recommended actions separated", ok: v.recommended_actions.length >= 2 },
    {
      label: "Source references preserved",
      ok: true,
      detail: v.references.length ? `${v.references.length} reference(s)` : "None present in source",
    },
  ],
  toText: (v) =>
    [
      `ADVISORY: ${v.title}`,
      [`Severity: ${v.severity || "Not stated"}`, v.date ? `Date: ${v.date}` : "", `Affected: ${v.affected}`]
        .filter(nonEmpty)
        .join("\n"),
      `SUMMARY\n${v.summary}`,
      `ISSUE\n${v.issue}`,
      `IMPACT\n${v.impact}`,
      `RECOMMENDED ACTIONS\n${bullets(v.recommended_actions)}`,
      v.references.length ? `REFERENCES\n${bullets(v.references, "-")}` : "",
    ]
      .filter(nonEmpty)
      .join("\n\n"),
  toHtml: (v) =>
    [
      h(1, v.title),
      p(
        [`Severity: ${v.severity || "Not stated"}`, v.date ? `Date: ${v.date}` : "", `Affected: ${v.affected}`]
          .filter(nonEmpty)
          .join(" · "),
      ),
      h(2, "Summary"),
      p(v.summary),
      h(2, "Issue"),
      p(v.issue),
      h(2, "Impact"),
      p(v.impact),
      h(2, "Recommended actions"),
      ul(v.recommended_actions),
      v.references.length ? h(2, "References") + ul(v.references) : "",
    ].join(""),
};

const ppt: FormatContract<PptScriptPayload> = {
  id: "ppt_script",
  label: "PPT Script",
  schema: PptScriptSchema,
  jsonShape: `{"format":"ppt_script","title":string,"slides":[{"number":number,"title":string,"talking_points":string[],"speaker_notes":string}]}`,
  instructions: (cfg) => `Produce a presentation script, slide by slide.
${styleBlock(cfg)}
Structure contract:
- "title": deck title.
- "slides": 4-8 slides (Short: 4, Medium: 5-6, Detailed: 7-8), numbered sequentially from 1.
- Each slide: "title" (max 8 words), "talking_points" (2-4 short on-slide bullets, not sentences), "speaker_notes" (2-4 sentences of what the presenter says).
- Slides must progress logically: opening/context → substance → implications/actions → close.
Prohibited: writing an essay and splitting it arbitrarily; putting full paragraphs in talking_points; repeating the speaker notes as bullets; hashtags; emoji.`,
  validate: (v) => [
    { label: "Deck title present", ok: nonEmpty(v.title) },
    { label: "Every slide has a title", ok: v.slides.every((s) => nonEmpty(s.title)) },
    { label: "Every slide has talking points", ok: v.slides.every((s) => s.talking_points.length >= 1) },
    { label: "Speaker notes separated", ok: v.slides.every((s) => nonEmpty(s.speaker_notes)) },
    {
      label: "Slides numbered sequentially",
      ok: v.slides.every((s, i) => s.number === i + 1),
    },
    {
      label: "Talking points are bullets, not prose",
      ok: v.slides.every((s) => s.talking_points.every((t) => t.split(/\s+/).length <= 18)),
    },
  ],
  toText: (v) =>
    [
      `PRESENTATION SCRIPT: ${v.title}`,
      ...v.slides.map((s) =>
        [
          `SLIDE ${s.number} — ${s.title}`,
          `Talking points:\n${bullets(s.talking_points)}`,
          `Speaker notes:\n${s.speaker_notes}`,
        ].join("\n"),
      ),
    ].join("\n\n"),
  toHtml: (v) =>
    [
      h(1, v.title),
      ...v.slides.map((s) =>
        [
          h(2, `Slide ${s.number} — ${s.title}`),
          h(3, "Talking points"),
          ul(s.talking_points),
          h(3, "Speaker notes"),
          p(s.speaker_notes),
        ].join(""),
      ),
    ].join(""),
};

const email: FormatContract<EmailPayload> = {
  id: "email",
  label: "Email",
  schema: EmailSchema,
  jsonShape: `{"format":"email","subject":string,"greeting":string,"body":string[],"key_points":string[],"closing":string,"signature":string}`,
  instructions: (cfg) => `Produce a single email.
${styleBlock(cfg)}
Structure contract:
- "subject": under 70 characters, specific, no "Re:".
- "greeting": one line addressed to the audience.
- "body": 2-4 short paragraphs.
- "key_points": 0-5 bullets when a list genuinely helps.
- "closing": one closing line.
- "signature": sender line; use a role, never an invented personal name.
Prohibited: hashtags, headings such as "Introduction"/"Conclusion", markdown, invented contact details.`,
  validate: (v) => [
    { label: "Subject line present", ok: nonEmpty(v.subject) && v.subject.length <= 90 },
    { label: "Greeting present", ok: nonEmpty(v.greeting) },
    { label: "Body paragraphs exist", ok: v.body.length > 0 },
    { label: "Closing present", ok: nonEmpty(v.closing) },
    { label: "No article-style headings", ok: !v.body.some((b) => ARTICLE_HEADINGS.test(b.trim())) },
  ],
  toText: (v) =>
    [
      `Subject: ${v.subject}`,
      v.greeting,
      v.body.join("\n\n"),
      v.key_points.length ? bullets(v.key_points) : "",
      v.closing,
      v.signature,
    ]
      .filter(nonEmpty)
      .join("\n\n"),
  toHtml: (v) =>
    [
      h(1, v.subject),
      p(v.greeting),
      ...v.body.map(p),
      v.key_points.length ? ul(v.key_points) : "",
      p(v.closing),
      nonEmpty(v.signature) ? p(v.signature) : "",
    ].join(""),
};

const newsletter: FormatContract<NewsletterPayload> = {
  id: "newsletter",
  label: "Newsletter",
  schema: NewsletterSchema,
  jsonShape: `{"format":"newsletter","title":string,"intro":string,"items":[{"heading":string,"body":string}],"closing":string}`,
  instructions: (cfg) => `Produce a newsletter issue.
${styleBlock(cfg)}
Structure contract:
- "title": issue headline.
- "intro": 2-3 sentences framing the issue.
- "items": 2-5 sections, each with a short "heading" and a 2-4 sentence "body".
- "closing": one short sign-off line.
Prohibited: hashtags, slide numbering, invented events or dates.`,
  validate: (v) => [
    { label: "Title present", ok: nonEmpty(v.title) },
    { label: "Intro present", ok: nonEmpty(v.intro) },
    { label: "At least two sections", ok: v.items.length >= 2 },
    { label: "Every section has a heading", ok: v.items.every((i) => nonEmpty(i.heading)) },
  ],
  toText: (v) =>
    [
      v.title.toUpperCase(),
      v.intro,
      ...v.items.map((i) => `${i.heading}\n${i.body}`),
      v.closing,
    ]
      .filter(nonEmpty)
      .join("\n\n"),
  toHtml: (v) =>
    [
      h(1, v.title),
      p(v.intro),
      ...v.items.map((i) => h(2, i.heading) + p(i.body)),
      nonEmpty(v.closing) ? p(v.closing) : "",
    ].join(""),
};

const summary: FormatContract<SummaryPayload> = {
  id: "summary",
  label: "Summary",
  schema: SummarySchema,
  jsonShape: `{"format":"summary","title":string,"overview":string,"key_points":string[],"conclusion":string}`,
  instructions: (cfg) => `Produce a faithful summary of the source.
${styleBlock(cfg)}
Structure contract:
- "title": what the source is about.
- "overview": 2-4 sentences.
- "key_points": 3-7 single-sentence points.
- "conclusion": one or two closing sentences; may be an empty string.
Prohibited: hashtags, emoji, slide numbering, marketing language.`,
  validate: (v) => [
    { label: "Title present", ok: nonEmpty(v.title) },
    { label: "Overview present", ok: nonEmpty(v.overview) },
    { label: "Key points listed", ok: v.key_points.length >= 2 },
  ],
  toText: (v) =>
    [v.title.toUpperCase(), v.overview, `KEY POINTS\n${bullets(v.key_points)}`, v.conclusion]
      .filter(nonEmpty)
      .join("\n\n"),
  toHtml: (v) =>
    [
      h(1, v.title),
      p(v.overview),
      h(2, "Key points"),
      ul(v.key_points),
      nonEmpty(v.conclusion) ? p(v.conclusion) : "",
    ].join(""),
};

/* ------------------------------ the registry ----------------------------- */

export const FORMAT_CONTRACTS = {
  linkedin,
  x: xpost,
  executive_summary: executive,
  advisory,
  ppt_script: ppt,
  email,
  newsletter,
  summary,
};

/** Output-type label (shown in the UI) → format id. */
export const OUTPUT_TYPE_TO_FORMAT = {
  "Executive Summary": "executive_summary",
  Advisory: "advisory",
  "LinkedIn Post": "linkedin",
  "X Post": "x",
  "PPT Script": "ppt_script",
  Summary: "summary",
  Email: "email",
  Newsletter: "newsletter",
} as const;

export type OutputTypeLabel = keyof typeof OUTPUT_TYPE_TO_FORMAT;

export function contractFor(id: FormatId): FormatContract {
  return FORMAT_CONTRACTS[id] as unknown as FormatContract;
}

export function contractForOutputType(label: string): FormatContract | null {
  const id = (OUTPUT_TYPE_TO_FORMAT as Record<string, FormatId>)[label];
  return id ? contractFor(id) : null;
}

export function renderText(payload: FormatPayload): string {
  return contractFor(payload.format).toText(payload as never);
}

export function renderHtml(payload: FormatPayload): string {
  return contractFor(payload.format).toHtml(payload as never);
}

export function validatePayload(payload: FormatPayload): FormatCheck[] {
  return contractFor(payload.format).validate(payload as never);
}
