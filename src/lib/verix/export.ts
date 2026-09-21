import { download, escapeHtml, safeFileName } from "./utils";

export function exportTxt(title: string, content: string) {
  download(safeFileName(title, "txt"), `${title}\n\n${content}\n`, "text/plain;charset=utf-8");
}

function paragraphs(content: string) {
  return content
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

/** Word-compatible HTML document (.doc) — a reliable prototype fallback for DOCX. */
export function exportDoc(title: string, content: string) {
  exportDocHtml(title, paragraphs(content));
}

/** Same as exportDoc, but with format-structured HTML supplied by the format contract. */
export function exportDocHtml(title: string, bodyHtml: string) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body><h1>${escapeHtml(title)}</h1>${bodyHtml}</body></html>`;
  download(safeFileName(title, "doc"), html, "application/msword");
}

/** Opens a print-ready view; the browser's "Save as PDF" produces the file. */
export function exportPdf(title: string, content: string): boolean {
  return exportPdfHtml(title, paragraphs(content));
}

/** Same as exportPdf, but with format-structured HTML supplied by the format contract. */
export function exportPdfHtml(title: string, body: string): boolean {
  // No `noopener`/`noreferrer` here: per the HTML spec, window.open() always
  // returns null when those are set, which broke this feature entirely.
  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) return false;
  win.document.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font-family:Georgia,serif;max-width:42rem;margin:3rem auto;padding:0 1.5rem;color:#21281f;line-height:1.6}
h1{font-size:1.6rem;margin-bottom:0.25rem}h2{font-size:1.05rem;margin:1.4rem 0 .4rem}h3{font-size:.95rem;margin:1.2rem 0 .3rem}
small{color:#8a8678}p{margin:0 0 1rem}ul,ol{margin:0 0 1rem 1.2rem}li{margin:0 0 .35rem}
.meta{color:#8a8678;font-size:.85rem}</style></head>
<body><h1>${escapeHtml(title)}</h1><small>Generated with VERIX · reviewed and approved by a human</small>${body}
<script>window.onload=function(){window.print()}</script></body></html>`,
  );
  win.document.close();
  return true;
}
