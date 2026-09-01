"use client";

import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type ChangeEvent,
} from "react";
import { CloudUpload, Download, FileText, Sparkles } from "lucide-react";
import { uploadResume } from "@/actions/profile";
import type {
  ExtractActionResult,
  ExtractedProfile,
  GenerateActionResult,
} from "@/types";

type Props = {
  hasResume: boolean;
  hasGeneratedResume: boolean;
  isProfileComplete: boolean;
  onExtracted: (profile: ExtractedProfile) => void;
};

const MAX_RESUME_BYTES = 5 * 1024 * 1024;

function isValidPdf(file: File): string | null {
  if (file.type !== "application/pdf") {
    return "Resume must be a PDF.";
  }
  if (file.size > MAX_RESUME_BYTES) {
    return "Resume must be 5MB or smaller.";
  }
  return null;
}

export function ResumeUpload({
  hasResume,
  hasGeneratedResume,
  isProfileComplete,
  onExtracted,
}: Props) {
  const [fileName, setFileName] = useState<string | null>(
    hasResume ? "Resume on file" : null,
  );
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [resumeOnFile, setResumeOnFile] = useState(hasResume);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  /**
   * Signed and short-lived, so it is deliberately not persisted across a
   * reload — the user generates again to get a fresh link.
   */
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  /**
   * Synchronous in-flight guard. The `disabled` attribute is not enough on its
   * own: `setGenerating(true)` does not take effect until React re-renders, so
   * two clicks landing in the same tick both read `generating === false` and
   * both fire. Verified — a double click sent two POSTs, meaning two billed AI
   * calls and two uploads racing the same storage key. A ref updates
   * immediately, closing the window.
   */
  const generatingRef = useRef(false);

  /**
   * A resume generated in an earlier visit is recorded on the profile, but its
   * download link is signed and long expired. Fetch a fresh one on mount so the
   * user can reach the existing document without paying for another model call.
   */
  useEffect(() => {
    if (!hasGeneratedResume) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/resume/generate");
        const result = (await response.json()) as GenerateActionResult;
        // Never clobber a link from a generation the user just ran.
        if (!cancelled && result.success && result.downloadUrl) {
          setDownloadUrl((current) => current ?? result.downloadUrl ?? null);
        }
      } catch {
        // Silent: this is a convenience, and Generate remains the way back.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasGeneratedResume]);

  const handleGenerate = async (): Promise<void> => {
    if (generatingRef.current) {
      return;
    }
    generatingRef.current = true;

    setGenerateError(null);
    setDownloadUrl(null);
    setGenerating(true);

    try {
      const response = await fetch("/api/resume/generate", { method: "POST" });
      const result = (await response.json()) as GenerateActionResult;

      if (!result.success || !result.downloadUrl) {
        setGenerateError(result.error ?? "Failed to generate resume");
        return;
      }

      setDownloadUrl(result.downloadUrl);
    } catch {
      setGenerateError("Failed to generate resume");
    } finally {
      generatingRef.current = false;
      setGenerating(false);
    }
  };

  const handleExtract = async (): Promise<void> => {
    setError(null);
    setExtracting(true);

    try {
      const response = await fetch("/api/resume/extract", { method: "POST" });
      const result = (await response.json()) as ExtractActionResult;

      if (!result.success || !result.profile) {
        setError(result.error ?? "Failed to extract from resume");
        return;
      }

      onExtracted(result.profile);
    } catch {
      setError("Failed to extract from resume");
    } finally {
      setExtracting(false);
    }
  };

  const uploadFile = async (file: File): Promise<void> => {
    const validationError = isValidPdf(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setUploading(true);
    const formData = new FormData();
    formData.set("resume", file);
    const result = await uploadResume(formData);
    setUploading(false);

    if (!result.success) {
      setError(result.error ?? "Failed to upload resume");
      return;
    }

    setFileName(file.name);
    setResumeOnFile(true);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>): void => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) {
      void uploadFile(file);
    }
  };

  const handleDragOver = (event: DragEvent<HTMLLabelElement>): void => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file) {
      void uploadFile(file);
    }
  };

  return (
    <section className="bg-surface border border-border rounded-2xl p-6 shadow-card">
      <h2 className="text-base font-semibold text-text-primary">Resume</h2>
      <p className="mt-1 text-sm text-text-secondary">
        Upload an existing resume to auto-fill the profile, or generate a new
        tailored one from your details below.
      </p>

      <input
        id="resume-upload"
        type="file"
        accept="application/pdf"
        className="sr-only"
        onChange={handleFileChange}
        disabled={uploading}
      />
      <label
        htmlFor="resume-upload"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setIsDragging(false)}
        className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-dashed px-6 py-10 text-center transition-colors ${
          isDragging
            ? "border-accent bg-accent-muted"
            : "border-border-muted bg-surface-secondary"
        }`}
      >
        <CloudUpload className="h-6 w-6 text-accent" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-text-primary">
            {uploading
              ? "Uploading…"
              : (fileName ?? "Click to upload or drag and drop")}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            PDF formatting only. Maximum file size 5MB.
          </p>
        </div>
        <span className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-secondary">
          Select Resume
        </span>
      </label>

      {resumeOnFile ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text-secondary">
            Fill the profile below from this resume. You can review and edit
            everything before saving.
          </p>
          <button
            type="button"
            onClick={() => void handleExtract()}
            disabled={extracting || uploading}
            className="flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-secondary focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {extracting ? "Extracting…" : "Extract from Resume"}
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-sm text-text-secondary">
          {isProfileComplete
            ? "Need a fresh document based on the fields below?"
            : "Complete the missing profile fields above to generate a resume."}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {downloadUrl ? (
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-secondary focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={!isProfileComplete || generating}
            className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            {generating ? "Generating…" : "Generate Resume from Profile"}
          </button>
        </div>
      </div>

      {downloadUrl ? (
        <p className="mt-3 text-xs text-text-muted">
          This download link expires in a few minutes. Generate again for a
          fresh one.
        </p>
      ) : null}

      {generateError ? (
        <p className="mt-3 text-sm text-error" role="alert">
          {generateError}
        </p>
      ) : null}
    </section>
  );
}
