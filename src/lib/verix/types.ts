import type { FormatCheck, FormatId, FormatPayload } from "./formats/contracts";

export type SourceKind = "demo" | "file" | "text" | "url";

export interface SourceDoc {
  id: string;
  title: string;
  kind: SourceKind;
  text: string;
  wordCount: number;
  isDemo: boolean;
  createdAt: string;
}

export interface Analysis {
  documentType: string;
  mainTopic: string;
  keyTopics: string[];
  keyPoints: string[];
  entities: { name: string; type: string }[];
  claims: string[];
  wordCount: number;
  characterCount: number;
}

export type SensitiveAction = "mask" | "remove" | "keep";

export interface SensitiveItem {
  id: string;
  value: string;
  category: string;
  action: SensitiveAction;
  occurrences: number;
}

export const AUDIENCES = [
  "General Public",
  "Students",
  "Professionals",
  "Executives",
  "Technical Experts",
] as const;
export const TONES = ["Simple", "Professional", "Formal", "Conversational", "Technical"] as const;
export const COMPLEXITIES = ["Basic", "Intermediate", "Advanced"] as const;
export const LENGTHS = ["Short", "Medium", "Detailed"] as const;
export const LANGUAGES = [
  "English",
  "Hindi",
  "Marathi",
  "Bengali",
  "Tamil",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Gujarati",
  "Punjabi",
  "Odia",
  "Assamese",
  "Urdu",
  "Konkani",
  "French",
  "Spanish",
  "German",
  "Portuguese",
  "Arabic",
  "Chinese (Simplified)",
  "Japanese",
  "Russian",
] as const;
export const SECTIONS = [
  "Title",
  "Introduction",
  "Key Points",
  "Recommendations",
  "Conclusion",
] as const;
export const OUTPUT_TYPES = [
  "Executive Summary",
  "Advisory",
  "LinkedIn Post",
  "X Post",
  "PPT Script",
  "Summary",
  "Email",
  "Newsletter",
] as const;

export type Audience = (typeof AUDIENCES)[number];
export type Tone = (typeof TONES)[number];
export type Complexity = (typeof COMPLEXITIES)[number];
export type Length = (typeof LENGTHS)[number];
export type Language = (typeof LANGUAGES)[number];
export type OutputType = (typeof OUTPUT_TYPES)[number];

export interface Config {
  audience: Audience;
  tone: Tone;
  complexity: Complexity;
  length: Length;
  language: Language;
  sections: string[];
}

export type ReviewStatus = "Draft" | "Under Review" | "Approved" | "Rejected";

export interface Version {
  n: number;
  content: string;
  label: string;
  createdAt: string;
  /** Structured payload behind this version, when it came from the format pipeline. */
  data?: FormatPayload | null;
}

export type VerificationStatus = "Supported" | "Partially Supported" | "Needs Review";

export interface ClaimCheck {
  claim: string;
  status: VerificationStatus;
  sourceRef: string | null;
  excerpt: string | null;
}

export interface GeneratedOutput {
  id: string;
  type: OutputType;
  /** Format contract this output was produced under. */
  format: FormatId;
  /** Structured payload validated against the format schema (null for edited text). */
  data: FormatPayload | null;
  /** Format-specific validation results for the current content. */
  formatChecks: FormatCheck[];
  content: string;
  status: ReviewStatus;
  versions: Version[];
  activeVersion: number;
  verification: ClaimCheck[];
  runId?: string;
  createdAt: string;
}

export interface Transformation {
  id: string;
  docTitle: string;
  docId: string;
  audience: Audience;
  language: Language;
  outputs: GeneratedOutput[];
  sensitiveCount: number;
  createdAt: string;
}
