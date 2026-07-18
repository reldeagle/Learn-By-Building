import { z } from "zod";

import { MAX_SUBMISSION_CHARACTERS } from "@/lib/schemas";

export const MAX_SUBMISSION_FILES = 10;

export const SUPPORTED_SUBMISSION_EXTENSIONS = [
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".css",
  ".json",
  ".html",
  ".md",
  ".txt",
] as const;

export type SubmissionFile = {
  name: string;
  content: string;
};

export type SubmissionMode = "write" | "files";

const SubmissionFileSchema = z
  .object({
    name: z.string().trim().min(1),
    content: z.string(),
  })
  .strict();

export const SubmissionDraftSchema = z
  .object({
    code: z.string().max(MAX_SUBMISSION_CHARACTERS),
    files: z.array(SubmissionFileSchema).max(MAX_SUBMISSION_FILES),
    mode: z.enum(["write", "files"]),
  })
  .strict();

function extensionFor(name: string) {
  const lastDot = name.lastIndexOf(".");
  return lastDot === -1 ? "" : name.slice(lastDot).toLowerCase();
}

export function buildSubmissionCode(files: SubmissionFile[]) {
  return files
    .map(({ name, content }) => `// File: ${name}\n${content}`)
    .join("\n\n");
}

export function validateSubmissionFiles(files: SubmissionFile[]) {
  if (files.length > MAX_SUBMISSION_FILES) {
    return `Choose up to ${MAX_SUBMISSION_FILES} source files.`;
  }

  const names = new Set<string>();

  for (const file of files) {
    const name = file.name.trim();

    if (!name) {
      return "Each uploaded file needs a name.";
    }

    if (
      !SUPPORTED_SUBMISSION_EXTENSIONS.some(
        (extension) => extension === extensionFor(name),
      )
    ) {
      return "Upload React source files such as .js, .jsx, .ts, .tsx, .css, or .json.";
    }

    if (names.has(name.toLowerCase())) {
      return "Each uploaded file must have a unique name.";
    }

    if (file.content.includes("\u0000")) {
      return `${name} does not look like a text file.`;
    }

    names.add(name.toLowerCase());
  }

  if (buildSubmissionCode(files).length > MAX_SUBMISSION_CHARACTERS) {
    return `Keep all files under ${MAX_SUBMISSION_CHARACTERS.toLocaleString()} characters combined.`;
  }

  return null;
}
