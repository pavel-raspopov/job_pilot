-- =============================================================================
-- Feature 08 — Resume PDF Generation from Profile
--
-- Adds a second resume pointer, separate from resume_pdf_url / resume_pdf_key.
--
-- Those existing columns track the resume the USER UPLOADED (Feature 06), and
-- resume_pdf_key is the exact key Feature 07's extraction route reads. Storing
-- the generated PDF there — as context/build-plan.md Feature 08 originally
-- specified, with upsert over resumes/{user_id}/resume.pdf — would delete the
-- user's source CV and make "Extract from Resume" re-extract the model's own
-- output, degrading a little further on every round trip.
--
-- So: the uploaded resume lives at resumes/{user_id}/resume.pdf, the generated
-- one at resumes/{user_id}/generated-resume.pdf, and each has its own pointer.
--
-- Both nullable: a user may upload without generating, generate without
-- uploading, or do neither. Existing RLS on profiles covers the new columns.
-- The resumes bucket is private, so the stored url is a record rather than a
-- fetchable link — downloads go through a short-lived signed URL.
-- =============================================================================

alter table public.profiles
  add column if not exists generated_resume_url text,
  add column if not exists generated_resume_key text;
