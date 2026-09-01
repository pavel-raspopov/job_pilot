## ADDED Requirements

### Requirement: Resume generation request

The system SHALL let a signed-in user request a generated resume from `/profile`. The generation control SHALL be offered only when the stored profile is complete, SHALL indicate that generation is in progress, and SHALL be unavailable while a request is in flight so a user cannot start two at once.

When the stored profile is not complete the control SHALL remain visible but inactive, and SHALL tell the user that the profile must be completed first. The system SHALL enforce the same condition when handling the request, not only in the interface.

Generation SHALL read only the profile belonging to the requesting user, and SHALL write only to storage paths whose first path segment is the authenticated user id.

Generation SHALL read the stored profile. Unsaved edits in the form SHALL NOT appear in the generated document.

#### Scenario: Generation is offered for a complete profile

- **WHEN** a signed-in user opens `/profile` and their stored profile is complete
- **THEN** the generation control is active

#### Scenario: Generation is refused for an incomplete profile

- **WHEN** a signed-in user opens `/profile` and their stored profile is not complete
- **THEN** the control is inactive, the user is told to complete the profile first, and no document is produced

#### Scenario: Generation is unavailable while running

- **WHEN** the user starts a generation and it has not yet finished
- **THEN** the control shows progress and cannot be triggered again

#### Scenario: Signed-out request is refused

- **WHEN** generation is requested without a valid session
- **THEN** the system refuses it, reads no profile, writes nothing, and returns an error

#### Scenario: Unsaved edits are not included

- **WHEN** the user edits a form field, does not save, and then generates
- **THEN** the generated document reflects the stored value, not the unsaved edit

### Requirement: Generated resume content

The generated document SHALL be a single-page PDF derived from the stored profile. It SHALL present the user's name, current title, and available contact details, a professional summary, work experience, education, and skills.

The system SHALL rewrite stored profile text into resume prose — a summary paragraph and tightened responsibility statements — without changing the facts. The system SHALL NOT introduce an employer, job title, date, institution, degree, or skill that the stored profile does not contain.

Where rewritten content cannot be produced or fails validation, the system SHALL fall back to the stored profile values rather than omitting the section or inventing a replacement.

Sections the profile leaves empty SHALL be omitted rather than rendered as blank headings or placeholder text.

#### Scenario: Generated document matches the profile

- **WHEN** a user with a complete profile generates a resume
- **THEN** the PDF shows their stored name, title, contact details, roles, education, and skills

#### Scenario: No facts are invented

- **WHEN** the generated document is compared against the stored profile
- **THEN** every employer, title, date, institution, degree, and skill in it appears in the stored profile

#### Scenario: Rewritten prose falls back to stored text

- **WHEN** the rewrite step returns unusable content for a section
- **THEN** that section renders the stored profile values and the rest of the document is still produced

#### Scenario: Empty sections are omitted

- **WHEN** the stored profile has no education entry
- **THEN** the document contains no education section rather than an empty one

### Requirement: Generation does not disturb the uploaded resume

The system SHALL store the generated resume as a separate object from the resume the user uploaded, and SHALL track it with its own stored url and key. Generating SHALL NOT modify, replace, or delete the uploaded resume object, and SHALL NOT change the profile's uploaded-resume url or key.

Resume extraction SHALL continue to read the uploaded resume after any number of generations.

Regenerating SHALL replace the previously generated document; the system SHALL keep at most one generated resume per user.

#### Scenario: Uploaded resume survives generation

- **WHEN** a user who has uploaded a resume generates a new one
- **THEN** the uploaded object and the profile's uploaded-resume url and key are unchanged

#### Scenario: Extraction still reads the uploaded resume

- **WHEN** the user generates a resume and then requests extraction
- **THEN** extraction reads the uploaded resume, not the generated one

#### Scenario: Regeneration replaces the previous generated document

- **WHEN** a user who has already generated a resume generates again
- **THEN** the stored generated resume is the newer document and only one generated resume is retained

#### Scenario: Generation works without an uploaded resume

- **WHEN** a user with a complete profile and no uploaded resume generates a resume
- **THEN** the document is produced and the profile's uploaded-resume fields stay empty

### Requirement: Generated resume delivery

On a successful generation the system SHALL offer the user a way to download the document. Stored resumes SHALL remain private: the system SHALL NOT expose a durable public URL for a generated resume, and any download link it issues SHALL be time-limited.

The system SHALL record that a generated resume exists so a later request can offer it again.

#### Scenario: Download is offered after generation

- **WHEN** generation succeeds
- **THEN** the user is offered a download and receives the generated PDF

#### Scenario: Stored location is not publicly readable

- **WHEN** the generated resume's stored location is requested without authorization
- **THEN** the document is not served

### Requirement: Generation failures are reported, not thrown

When generation cannot complete, the system SHALL show the user an error on the profile page, leave the form untouched, and leave the stored profile and both resume objects unchanged. This applies when the user has no stored profile, when the profile is incomplete, when the AI service is unavailable or unfunded, when the document cannot be rendered, and when the upload fails.

The system SHALL NOT surface internal error detail, provider names, or storage locations to the user.

#### Scenario: No stored profile

- **WHEN** generation is requested by a user with no stored profile row
- **THEN** the user is told to complete and save their profile first, and nothing is written

#### Scenario: Service unavailable

- **WHEN** the AI service errors or is unfunded
- **THEN** the user sees an error, no document is stored, and the profile is unchanged

#### Scenario: Upload fails

- **WHEN** the document renders but cannot be stored
- **THEN** the user sees an error and the profile's generated-resume fields are unchanged

## MODIFIED Requirements

### Requirement: Resume upload

The system SHALL upload a resume when the user selects a PDF of at most 5MB, without waiting for Save Profile. The system SHALL store one active uploaded resume per user: persist the storage `url` and `key` on the profile row, under a key whose first path segment is the authenticated user id. After a successful replacement upload, the system SHALL remove the previous object when its key differs.

The uploaded resume SHALL be tracked separately from any generated resume, and an upload SHALL NOT modify or remove a generated resume.

Rejected files (not PDF, or larger than 5MB) SHALL NOT be uploaded. The same checks SHALL apply to file-picker and drag-and-drop, and again on the server.

#### Scenario: Valid PDF uploads immediately

- **WHEN** a signed-in user selects a PDF of 5MB or less
- **THEN** the file is stored, `resume_pdf_url` and `resume_pdf_key` are saved, and the dropzone shows that a resume is on file

#### Scenario: Invalid file is rejected

- **WHEN** the user drops or picks a non-PDF or a PDF larger than 5MB
- **THEN** the system does not upload, does not change stored resume fields, and shows an error

#### Scenario: Replacement removes the previous object

- **WHEN** the user uploads a new valid PDF and a previous `resume_pdf_key` exists
- **THEN** the profile points at the new url/key and the previous object is removed

#### Scenario: Upload does not require saving the form

- **WHEN** the user uploads a valid PDF and does not click Save Profile
- **THEN** a reload of `/profile` still shows that a resume is on file

#### Scenario: Upload leaves a generated resume alone

- **WHEN** a user who has generated a resume uploads a new PDF
- **THEN** the generated resume and its stored url and key are unchanged
