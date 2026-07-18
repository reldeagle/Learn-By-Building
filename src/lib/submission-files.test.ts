import { describe, expect, it } from "vitest";

import { EDITOR_STARTERS } from "@/components/code-editor";

import {
  buildSubmissionCode,
  MAX_SUBMISSION_FILES,
  SubmissionDraftSchema,
  validateSubmissionFiles,
} from "./submission-files";

describe("submission file helpers", () => {
  it("labels every uploaded file in the review payload", () => {
    expect(
      buildSubmissionCode([
        { name: "App.tsx", content: "export default function App() {}" },
        { name: "styles.css", content: ".app {}" },
      ]),
    ).toBe(
      "// File: App.tsx\nexport default function App() {}\n\n// File: styles.css\n.app {}",
    );
  });

  it("rejects duplicate, unsupported, and binary-looking files", () => {
    expect(
      validateSubmissionFiles([
        { name: "App.tsx", content: "one" },
        { name: "app.tsx", content: "two" },
      ]),
    ).toContain("unique");
    expect(
      validateSubmissionFiles([{ name: "archive.zip", content: "text" }]),
    ).toContain("React source files");
    expect(
      validateSubmissionFiles([{ name: "App.tsx", content: "\u0000" }]),
    ).toContain("text file");
  });

  it("limits the number and combined size of files", () => {
    expect(
      validateSubmissionFiles(
        Array.from({ length: MAX_SUBMISSION_FILES + 1 }, (_, index) => ({
          name: `Component${index}.tsx`,
          content: "",
        })),
      ),
    ).toContain("up to");
    expect(
      validateSubmissionFiles([
        { name: "App.tsx", content: "a".repeat(100_000) },
      ]),
    ).toContain("combined");
  });

  it("defaults restored drafts to the TypeScript editor", () => {
    expect(
      SubmissionDraftSchema.parse({
        code: "export default function App() {}",
        files: [],
        mode: "write",
      }).language,
    ).toBe("tsx");
  });

  it("provides a starter for both supported React syntaxes", () => {
    expect(EDITOR_STARTERS.jsx).toContain("function App");
    expect(EDITOR_STARTERS.tsx).toContain("function App");
  });
});
