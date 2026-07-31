"use client";

import { useState, type DragEvent, type ChangeEvent } from "react";
import { CloudUpload, FileText } from "lucide-react";

export function ResumeUpload() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (event: DragEvent<HTMLLabelElement>): void => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      setFileName(file.name);
    }
  };

  const handleDragOver = (event: DragEvent<HTMLLabelElement>): void => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
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
            {fileName ?? "Click to upload or drag and drop"}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            PDF formatting only. Maximum file size 5MB.
          </p>
        </div>
        <span className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-secondary">
          Select Resume
        </span>
      </label>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-sm text-text-secondary">
          Need a fresh document based on the fields below?
        </p>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <FileText className="h-4 w-4" aria-hidden="true" />
          Generate Resume from Profile
        </button>
      </div>
    </section>
  );
}
