"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { CodeEditor } from "@/components/code-editor";
import { MAX_SUBMISSION_CHARACTERS } from "@/lib/schemas";
import {
  buildSubmissionCode,
  MAX_SUBMISSION_FILES,
  SubmissionDraftSchema,
  type SubmissionFile,
  type SubmissionEditorLanguage,
  type SubmissionMode,
  SUPPORTED_SUBMISSION_EXTENSIONS,
  validateSubmissionFiles,
} from "@/lib/submission-files";

function draftKey(projectId: string) {
  return `learn-by-building:submission-draft:${projectId}`;
}

function loadDraft(projectId: string) {
  const emptyDraft = {
    code: "",
    files: [] as SubmissionFile[],
    language: "tsx" as SubmissionEditorLanguage,
    mode: "write" as SubmissionMode,
    restored: false,
  };

  if (typeof window === "undefined") {
    return emptyDraft;
  }

  try {
    const storedDraft = window.localStorage.getItem(draftKey(projectId));
    if (!storedDraft) {
      return emptyDraft;
    }

    const draft = SubmissionDraftSchema.safeParse(JSON.parse(storedDraft));
    if (!draft.success || validateSubmissionFiles(draft.data.files)) {
      window.localStorage.removeItem(draftKey(projectId));
      return emptyDraft;
    }

    return {
      ...draft.data,
      restored: Boolean(draft.data.code || draft.data.files.length),
    };
  } catch {
    return emptyDraft;
  }
}

export function CodeInput({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [initialDraft] = useState(() => loadDraft(projectId));
  const [code, setCode] = useState(initialDraft.code);
  const [files, setFiles] = useState<SubmissionFile[]>(initialDraft.files);
  const [language, setLanguage] = useState<SubmissionEditorLanguage>(
    initialDraft.language,
  );
  const [mode, setMode] = useState<SubmissionMode>(initialDraft.mode);
  const [error, setError] = useState<string | null>(null);

  const submittedCode = mode === "write" ? code : buildSubmissionCode(files);
  const draftMessage =
    code || files.length
      ? initialDraft.restored
        ? "Restored your local draft."
        : "Draft saved in this browser."
      : null;

  useEffect(() => {
    try {
      if (!code && !files.length) {
        window.localStorage.removeItem(draftKey(projectId));
        return;
      }

      window.localStorage.setItem(
        draftKey(projectId),
        JSON.stringify({ code, files, language, mode }),
      );
    } catch {
      // A local draft is a convenience; submission still works if storage is unavailable.
    }
  }, [code, files, language, mode, projectId]);

  async function addFiles(selectedFiles: File[]) {
    if (!selectedFiles.length) {
      return;
    }

    if (selectedFiles.some((file) => file.size > MAX_SUBMISSION_CHARACTERS)) {
      setError("Each file must be smaller than 100 KB.");
      return;
    }

    try {
      const addedFiles = await Promise.all(
        selectedFiles.map(async (file) => ({
          name: file.name,
          content: await file.text(),
        })),
      );
      const nextFiles = [...files, ...addedFiles];
      const fileError = validateSubmissionFiles(nextFiles);

      if (fileError) {
        setError(fileError);
        return;
      }

      setFiles(nextFiles);
      setError(null);
    } catch {
      setError(
        "We could not read one of those files. Choose text-based source files.",
      );
    }
  }

  function removeFile(name: string) {
    setFiles((currentFiles) =>
      currentFiles.filter((file) => file.name !== name),
    );
    setError(null);
  }

  function discardDraft() {
    setCode("");
    setFiles([]);
    setLanguage("tsx");
    setError(null);
    window.localStorage.removeItem(draftKey(projectId));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!submittedCode.trim()) {
      setError("Add code or upload files before requesting a review.");
      return;
    }

    try {
      window.sessionStorage.setItem(
        `learn-by-building:submission:${projectId}`,
        submittedCode,
      );
      router.push(`/project/${projectId}/review?submit=1`);
    } catch {
      setError("We could not prepare your submission. Please try again.");
    }
  }

  return (
    <form
      className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6"
      onSubmit={submit}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-semibold tracking-tight text-slate-100">
            Submit your code
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Write or paste code, or add up to {MAX_SUBMISSION_FILES} React
            source files for one mentor review.
          </p>
        </div>
        {draftMessage ? (
          <div className="text-right text-xs text-slate-400">
            <p>{draftMessage}</p>
            <button
              className="mt-1 font-medium text-cyan-300 hover:text-cyan-200"
              onClick={discardDraft}
              type="button"
            >
              Discard draft
            </button>
          </div>
        ) : null}
      </div>

      <div
        aria-label="Submission method"
        className="mt-5 flex w-fit rounded-xl border border-slate-800 p-1"
        role="group"
      >
        {(
          [
            ["write", "Write or paste"],
            ["files", "Upload files"],
          ] as const
        ).map(([value, label]) => (
          <button
            aria-pressed={mode === value}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              mode === value
                ? "bg-cyan-400/10 text-cyan-300"
                : "text-slate-400 hover:text-slate-200"
            }`}
            key={value}
            onClick={() => {
              setMode(value);
              setError(null);
            }}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "write" ? (
        <CodeEditor
          code={code}
          language={language}
          onChange={(nextCode) => {
            setError(null);
            setCode(nextCode);
          }}
          onLanguageChange={setLanguage}
        />
      ) : (
        <div className="mt-5">
          <label
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950 px-5 py-10 text-center transition hover:border-cyan-300/60"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void addFiles(Array.from(event.dataTransfer.files));
            }}
          >
            <span className="font-medium text-slate-100">
              Drop source files here, or choose files
            </span>
            <span className="mt-2 text-sm text-slate-400">
              {SUPPORTED_SUBMISSION_EXTENSIONS.join(", ")} · text files only
            </span>
            <input
              accept={SUPPORTED_SUBMISSION_EXTENSIONS.join(",")}
              className="sr-only"
              multiple
              onChange={(event) => {
                void addFiles(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
              type="file"
            />
          </label>

          {files.length ? (
            <ul className="mt-4 divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800">
              {files.map((file) => (
                <li
                  className="flex items-center justify-between gap-4 px-4 py-3"
                  key={file.name}
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm text-slate-200">
                      {file.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {file.content.length.toLocaleString()} characters
                    </p>
                  </div>
                  <button
                    className="shrink-0 text-sm font-medium text-slate-400 transition hover:text-rose-300"
                    onClick={() => removeFile(file.name)}
                    type="button"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-4">
        <p className="text-xs text-slate-500">
          {submittedCode.length.toLocaleString()}/
          {MAX_SUBMISSION_CHARACTERS.toLocaleString()} characters
          {mode === "files" ? " including file labels" : ""}
        </p>
        <button
          className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
          type="submit"
        >
          Request review
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
    </form>
  );
}
