import type { SensitiveItem } from "./types";

/**
 * Prototype sensitive-information detection.
 * Deterministic pattern matching only — this is a demonstration control,
 * not a claim of complete enterprise-grade data protection.
 */

interface Rule {
  category: string;
  regex: RegExp;
}

const RULES: Rule[] = [
  { category: "Email", regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { category: "Phone Number", regex: /(?:\+\d{1,3}[\s-]?)?(?:\d[\s-]?){9,12}\d/g },
  { category: "Identifier", regex: /\b(?:employee\s+id|emp\s+id|id\s+no\.?|reference)[:\s]+[A-Z0-9-]{3,}/gi },
  { category: "Account Number", regex: /\b(?:account|acct|a\/c)[\s.:#-]*\d{6,}\b/gi },
  {
    category: "Address",
    regex: /\bRoom\s+\d+[^.\n]{0,80}?\b\d{6}\b/gi,
  },
  { category: "Confidential Label", regex: /\bClassification:\s*[A-Za-z][A-Za-z\s—-]{2,40}/g },
  { category: "Internal Project", regex: /\b(?:internal\s+project|project)\s+[A-Z]{4,}\b/g },
  {
    category: "Personal Information",
    // Two capitalised words immediately preceding a role/identifier cue.
    regex:
      /\b([A-Z][a-z]{2,}\s[A-Z][a-z]{2,})(?=,?\s(?:Information Security Officer|Security Officer|Officer|Director|Manager|Head of|employee|Employee))/g,
  },
];

export function detectSensitive(text: string): SensitiveItem[] {
  const found = new Map<string, SensitiveItem>();

  for (const rule of RULES) {
    const re = new RegExp(rule.regex.source, rule.regex.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const raw = (m[1] ?? m[0]).trim().replace(/[.,;]$/, "");
      if (raw.length < 4) continue;
      const key = `${rule.category}::${raw.toLowerCase()}`;
      const existing = found.get(key);
      if (existing) {
        existing.occurrences += 1;
      } else {
        found.set(key, {
          id: key,
          value: raw,
          category: rule.category,
          action: "mask",
          occurrences: 1,
        });
      }
      if (m.index === re.lastIndex) re.lastIndex += 1;
    }
  }

  return [...found.values()];
}

/** Partially masks a value for display — never shows the full sensitive value. */
export function maskPreview(value: string): string {
  if (value.includes("@")) {
    const [user = "", domain = ""] = value.split("@");
    return `${user.slice(0, 1)}${"*".repeat(Math.max(2, user.length - 1))}@${domain}`;
  }
  const visible = value.length > 8 ? 2 : 1;
  return `${value.slice(0, visible)}${"•".repeat(Math.max(3, value.length - visible * 2))}${value.slice(-visible)}`;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function placeholder(category: string) {
  const slug = category.toUpperCase().replace(/\s+/g, "_");
  return `[${slug}_REDACTED]`;
}

/** Applies the user's Mask / Remove / Keep choices to the source text. */
export function applyProtection(text: string, items: SensitiveItem[]): string {
  let out = text;
  for (const item of items) {
    if (item.action === "keep") continue;
    const re = new RegExp(escapeRe(item.value), "g");
    out = out.replace(re, item.action === "mask" ? placeholder(item.category) : "");
  }
  return out.replace(/[ \t]{2,}/g, " ");
}
