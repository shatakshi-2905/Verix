/** Client-side file validation and text extraction. Browser only. */

export const MAX_FILE_BYTES = 8 * 1024 * 1024;

const ALLOWED = [
  { ext: "txt", mimes: ["text/plain", ""] },
  { ext: "md", mimes: ["text/markdown", "text/plain", ""] },
  { ext: "pdf", mimes: ["application/pdf"] },
  {
    ext: "docx",
    mimes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ""],
  },
];

export class ExtractError extends Error {}

export async function extractFile(file: File): Promise<{ title: string; text: string }> {
  const name = file.name ?? "document";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const rule = ALLOWED.find((a) => a.ext === ext);

  if (!rule) throw new ExtractError("That file type isn't supported. Use PDF, DOCX, TXT or MD.");
  if (!rule.mimes.includes(file.type))
    throw new ExtractError("This file's content doesn't match its extension. Please check the file.");
  if (file.size === 0) throw new ExtractError("That file appears to be empty.");
  if (file.size > MAX_FILE_BYTES) throw new ExtractError("That file is larger than the 8 MB limit.");

  // Never trust the user-supplied filename for anything but a display title.
  const title = name.replace(/\.[^.]+$/, "").replace(/[^\w\s.-]/g, "").slice(0, 80) || "Uploaded document";

  let text = "";
  try {
    if (ext === "txt" || ext === "md") {
      text = await file.text();
    } else if (ext === "docx") {
      const mammoth = await import("mammoth/mammoth.browser.js");
      const buffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });
      text = result.value;
    } else {
      const pdfjs = await import("pdfjs-dist");
      const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: buffer }).promise;
      const pages: string[] = [];
      const limit = Math.min(pdf.numPages, 40);
      for (let i = 1; i <= limit; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        pages.push(
          content.items
            .map((it) => ("str" in it ? it.str : ""))
            .join(" ")
            .replace(/\s{2,}/g, " "),
        );
      }
      text = pages.join("\n\n");
    }
  } catch {
    throw new ExtractError("We couldn't read this document. Please check the file and try again.");
  }

  text = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length < 50)
    throw new ExtractError("We couldn't find enough readable text in this document.");

  return { title, text: text.slice(0, 200000) };
}
