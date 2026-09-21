import type {
  AdvisoryPayload,
  EmailPayload,
  ExecutiveSummaryPayload,
  FormatPayload,
  LinkedInPayload,
  NewsletterPayload,
  PptScriptPayload,
  SummaryPayload,
  XPostPayload,
} from "@/lib/verix/formats/contracts";
import { contractFor, numberTweets, X_CHAR_LIMIT } from "@/lib/verix/formats/contracts";

/** Shared little building blocks so each renderer stays declarative. */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </p>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-sand bg-cream p-5">{children}</div>;
}

/* ------------------------------- LinkedIn -------------------------------- */

export function LinkedInPreview({ data }: { data: LinkedInPayload }) {
  return (
    <Card>
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-full bg-sagedeep text-xs font-bold text-paper">
          in
        </span>
        <div className="text-xs">
          <p className="font-semibold">VERIX Communications</p>
          <p className="text-muted-foreground">Draft post · now</p>
        </div>
      </div>
      <p className="text-[15px] font-semibold leading-snug">{data.hook}</p>
      <div className="mt-4 space-y-3 text-sm leading-relaxed">
        {data.body.map((b, i) => (
          <p key={i}>{b}</p>
        ))}
      </div>
      {data.key_points.length ? (
        <ul className="mt-4 space-y-1.5 text-sm">
          {data.key_points.map((k, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-clay">→</span>
              <span>{k}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {data.cta ? <p className="mt-4 text-sm font-medium">{data.cta}</p> : null}
      {data.hashtags.length ? (
        <p className="mt-4 text-sm text-sagedeep">{data.hashtags.join(" ")}</p>
      ) : null}
    </Card>
  );
}

/* --------------------------------- X post -------------------------------- */

export function XPostPreview({ data }: { data: XPostPayload }) {
  const tweets = numberTweets(data);
  const isThread = tweets.length > 1;
  return (
    <div className="space-y-2">
      {tweets.map((text, i) => {
        const over = text.length > X_CHAR_LIMIT;
        return (
          <Card key={i}>
            <div className="mb-3 flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full bg-ink text-xs font-bold text-paper">
                X
              </span>
              <div className="text-xs">
                <p className="font-semibold">VERIX @verix</p>
                <p className="text-muted-foreground">
                  {isThread ? `Draft thread · tweet ${i + 1} of ${tweets.length}` : "Draft post"}
                </p>
              </div>
            </div>
            <p className="whitespace-pre-wrap text-[15px] leading-snug">{text}</p>
            <p
              className={
                over
                  ? "mt-4 text-[11px] font-semibold text-destructive"
                  : "mt-4 text-[11px] text-muted-foreground"
              }
            >
              {text.length} / {X_CHAR_LIMIT} characters
            </p>
          </Card>
        );
      })}
    </div>
  );
}

/* --------------------------- Executive summary --------------------------- */

export function ExecutiveSummaryPreview({ data }: { data: ExecutiveSummaryPayload }) {
  return (
    <Card>
      <h4 className="font-display text-2xl leading-tight">{data.title}</h4>
      <div className="mt-4">
        <Label>Executive overview</Label>
        <p className="mt-1.5 text-sm leading-relaxed">{data.overview}</p>
      </div>
      <div className="mt-4">
        <Label>Key findings</Label>
        <ul className="mt-1.5 space-y-1.5 text-sm">
          {data.key_findings.map((f, i) => (
            <li key={i} className="rounded-xl bg-paper px-3 py-2">
              {f}
            </li>
          ))}
        </ul>
      </div>
      {data.implications.length ? (
        <div className="mt-4">
          <Label>Implications</Label>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm">
            {data.implications.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-4">
        <Label>Recommendations</Label>
        <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm">
          {data.recommendations.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ol>
      </div>
    </Card>
  );
}

/* -------------------------------- Advisory ------------------------------- */

export function AdvisoryPreview({ data }: { data: AdvisoryPayload }) {
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-clay/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-clay">
          Advisory
        </span>
        {data.severity ? (
          <span className="rounded-full bg-sage/20 px-2.5 py-0.5 text-[11px] font-semibold text-sagedeep">
            Severity: {data.severity}
          </span>
        ) : null}
        {data.date ? <span className="text-[11px] text-muted-foreground">{data.date}</span> : null}
      </div>
      <h4 className="mt-3 font-display text-2xl leading-tight">{data.title}</h4>
      <p className="mt-2 text-[11px] text-muted-foreground">Affected: {data.affected}</p>

      <div className="mt-4 space-y-4 text-sm leading-relaxed">
        <div>
          <Label>Summary</Label>
          <p className="mt-1.5">{data.summary}</p>
        </div>
        <div>
          <Label>Issue</Label>
          <p className="mt-1.5">{data.issue}</p>
        </div>
        <div>
          <Label>Impact</Label>
          <p className="mt-1.5">{data.impact}</p>
        </div>
        <div>
          <Label>Recommended actions</Label>
          <ol className="mt-1.5 list-decimal space-y-1 pl-5">
            {data.recommended_actions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ol>
        </div>
        {data.references.length ? (
          <div>
            <Label>References</Label>
            <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
              {data.references.map((r, i) => (
                <li key={i} className="border-l-2 border-sand pl-2">
                  {r}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/* ------------------------------- PPT script ------------------------------ */

export function PPTScriptPreview({ data }: { data: PptScriptPayload }) {
  return (
    <div className="space-y-3">
      <h4 className="font-display text-xl">{data.title}</h4>
      {data.slides.map((s) => (
        <div key={s.number} className="rounded-2xl border border-sand bg-cream p-4">
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-md bg-sagedeep text-[11px] font-bold text-paper">
              {s.number}
            </span>
            <p className="text-sm font-semibold">{s.title}</p>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-paper p-3">
              <Label>On-slide talking points</Label>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs">
                {s.talking_points.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl bg-paper p-3">
              <Label>Speaker notes</Label>
              <p className="mt-1.5 text-xs italic leading-relaxed text-muted-foreground">
                {s.speaker_notes}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------- Email / Newsletter / Summary ------------------- */

export function EmailPreview({ data }: { data: EmailPayload }) {
  return (
    <Card>
      <p className="text-[11px] text-muted-foreground">Subject</p>
      <p className="text-sm font-semibold">{data.subject}</p>
      <div className="mt-4 space-y-3 text-sm leading-relaxed">
        <p>{data.greeting}</p>
        {data.body.map((b, i) => (
          <p key={i}>{b}</p>
        ))}
        {data.key_points.length ? (
          <ul className="list-disc space-y-1 pl-5">
            {data.key_points.map((k, i) => (
              <li key={i}>{k}</li>
            ))}
          </ul>
        ) : null}
        <p>{data.closing}</p>
        {data.signature ? <p className="text-muted-foreground">{data.signature}</p> : null}
      </div>
    </Card>
  );
}

export function NewsletterPreview({ data }: { data: NewsletterPayload }) {
  return (
    <Card>
      <h4 className="font-display text-2xl leading-tight">{data.title}</h4>
      <p className="mt-2 text-sm leading-relaxed">{data.intro}</p>
      <div className="mt-4 space-y-4">
        {data.items.map((it, i) => (
          <div key={i}>
            <p className="text-sm font-semibold">{it.heading}</p>
            <p className="mt-1 text-sm leading-relaxed">{it.body}</p>
          </div>
        ))}
      </div>
      {data.closing ? (
        <p className="mt-4 text-sm text-muted-foreground">{data.closing}</p>
      ) : null}
    </Card>
  );
}

export function SummaryPreview({ data }: { data: SummaryPayload }) {
  return (
    <Card>
      <h4 className="font-display text-2xl leading-tight">{data.title}</h4>
      <p className="mt-2 text-sm leading-relaxed">{data.overview}</p>
      <div className="mt-4">
        <Label>Key points</Label>
        <ul className="mt-1.5 space-y-1.5 text-sm">
          {data.key_points.map((k, i) => (
            <li key={i} className="rounded-xl bg-paper px-3 py-2">
              {k}
            </li>
          ))}
        </ul>
      </div>
      {data.conclusion ? <p className="mt-4 text-sm leading-relaxed">{data.conclusion}</p> : null}
    </Card>
  );
}

/* ------------------------------- dispatcher ------------------------------ */

/**
 * The model's structured output is validated against its format schema before
 * it is ever rendered. A field the model dropped or malformed (e.g. a missing
 * `hashtags` array) is filled with the schema's safe default here instead of
 * crashing the preview — schema drift shows up as a failed format check, not
 * a blank screen.
 */
function safePayload(data: FormatPayload): FormatPayload {
  const contract = contractFor(data.format);
  const parsed = contract.schema.safeParse(data);
  return parsed.success ? (parsed.data as FormatPayload) : data;
}

export function FormatPreview({ data: raw }: { data: FormatPayload }) {
  const data = safePayload(raw);
  switch (data.format) {
    case "linkedin":
      return <LinkedInPreview data={data} />;
    case "x":
      return <XPostPreview data={data} />;
    case "executive_summary":
      return <ExecutiveSummaryPreview data={data} />;
    case "advisory":
      return <AdvisoryPreview data={data} />;
    case "ppt_script":
      return <PPTScriptPreview data={data} />;
    case "email":
      return <EmailPreview data={data} />;
    case "newsletter":
      return <NewsletterPreview data={data} />;
    case "summary":
      return <SummaryPreview data={data} />;
    default:
      return null;
  }
}
