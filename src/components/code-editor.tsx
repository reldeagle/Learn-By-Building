"use client";

import { useRef } from "react";

import { MAX_SUBMISSION_CHARACTERS } from "@/lib/schemas";
import {
  SubmissionEditorLanguageSchema,
  type SubmissionEditorLanguage,
} from "@/lib/submission-files";

export const EDITOR_STARTERS: Record<SubmissionEditorLanguage, string> = {
  jsx: `export default function App() {
  return <main>Start building your project here.</main>;
}`,
  tsx: `export default function App() {
  return <main>Start building your project here.</main>;
}`,
};

const editorLabels: Record<SubmissionEditorLanguage, string> = {
  jsx: "React JavaScript (JSX)",
  tsx: "React TypeScript (TSX)",
};

export function CodeEditor({
  code,
  language,
  onChange,
  onLanguageChange,
}: {
  code: string;
  language: SubmissionEditorLanguage;
  onChange: (code: string) => void;
  onLanguageChange: (language: SubmissionEditorLanguage) => void;
}) {
  const lineNumbers = useRef<HTMLPreElement>(null);
  const lineCount = Math.max(12, code.split("\n").length);
  const showLineNumbers = lineCount <= 2_000;

  function indent(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Tab") {
      return;
    }

    event.preventDefault();
    const textarea = event.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selection = code.slice(start, end);
    const indentedSelection = selection.replaceAll("\n", "\n  ");
    const nextCode = `${code.slice(0, start)}  ${indentedSelection}${code.slice(end)}`;

    if (nextCode.length > MAX_SUBMISSION_CHARACTERS) {
      return;
    }

    onChange(nextCode);
    window.requestAnimationFrame(() => {
      textarea.setSelectionRange(
        start + 2,
        end + 2 + indentedSelection.length - selection.length,
      );
    });
  }

  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/60 px-4 py-3">
        <div>
          <p className="font-mono text-sm font-medium text-slate-200">
            App.{language}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Text editor only — your code is never run here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!code.trim() ? (
            <button
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-cyan-300/60 hover:text-cyan-200"
              onClick={() => onChange(EDITOR_STARTERS[language])}
              type="button"
            >
              Use starter
            </button>
          ) : null}
          <label className="sr-only" htmlFor="submission-language">
            Editor language
          </label>
          <select
            className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-slate-200 outline-none focus:border-cyan-300"
            id="submission-language"
            onChange={(event) => {
              const nextLanguage = SubmissionEditorLanguageSchema.safeParse(
                event.target.value,
              );

              if (nextLanguage.success) {
                onLanguageChange(nextLanguage.data);
              }
            }}
            value={language}
          >
            {(Object.keys(editorLabels) as SubmissionEditorLanguage[]).map(
              (value) => (
                <option key={value} value={value}>
                  {editorLabels[value]}
                </option>
              ),
            )}
          </select>
        </div>
      </div>
      <div className="flex h-80">
        {showLineNumbers ? (
          <pre
            aria-hidden="true"
            className="m-0 h-full w-12 shrink-0 overflow-hidden border-r border-slate-800 bg-slate-900/40 px-3 py-4 text-right font-mono text-sm leading-6 text-slate-600 select-none"
            ref={lineNumbers}
          >
            {Array.from({ length: lineCount }, (_, index) => index + 1).join(
              "\n",
            )}
          </pre>
        ) : null}
        <textarea
          aria-label={`${editorLabels[language]} code`}
          className="h-full w-full resize-none bg-slate-950 p-4 font-mono text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-600"
          maxLength={MAX_SUBMISSION_CHARACTERS}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={indent}
          onScroll={(event) => {
            if (lineNumbers.current) {
              lineNumbers.current.scrollTop = event.currentTarget.scrollTop;
            }
          }}
          placeholder="Write your React implementation here. Press Tab to indent."
          spellCheck={false}
          value={code}
        />
      </div>
    </div>
  );
}
