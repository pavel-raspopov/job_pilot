-- =============================================================================
-- Feature 06 — Profile Save Logic
--
-- Adds resume_pdf_key so the app can download/delete the active resume via
-- the InsForge Storage SDK (url is display-only). Nullable: users may save a
-- profile before uploading a PDF. Existing RLS on profiles covers the column.
-- =============================================================================

alter table public.profiles
  add column if not exists resume_pdf_key text;
