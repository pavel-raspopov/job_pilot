"use client";

import { useState, type DragEvent, type ChangeEvent } from "react";
import { CloudUpload, FileText, Sparkles } from "lucide-react";
import { uploadResume } from "@/actions/profile";
import type { ExtractActionResult, ExtractedProfile } from "@/types";

type Props = {
  hasResume: boolean;
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

export function ResumeUpload({ hasResume, onExtracted }: Props) {
  const [fileName, setFileName] = useState<string | null>(
    hasResume ? "Resume on file" : null,
  );
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [resumeOnFile, setResumeOnFile] = useState(hasResume);

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
          Need a fresh document based on the fields below?
        </p>
        <button
          type="button"
          disabled
          className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground opacity-60 cursor-not-allowed"
        >
          <FileText className="h-4 w-4" aria-hidden="true" />
          Generate Resume from Profile
        </button>
      </div>
    </section>
  );
}
