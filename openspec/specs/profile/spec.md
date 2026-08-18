# Profile Specification

## Purpose

Lets a signed-in user persist their main profile and one active resume PDF, then see real completion state and their saved values when they return to `/profile`.

## Requirements

### Requirement: Authenticated profile save

The system SHALL persist the signed-in user's profile when they submit Save Profile, including incomplete profiles. The system SHALL create the `profiles` row on first save and update it on later saves. The system SHALL set `profiles.id` to the authenticated user id and SHALL write `email` from the auth session, ignoring any client-supplied email. The system SHALL NOT write `cover_letter_tone` from the profile UI. After a successful save the system SHALL refresh `/profile` so the next load shows stored data.

#### Scenario: First save creates a profile row

- **WHEN** a signed-in user with no `profiles` row submits Save Profile
- **THEN** the system inserts a row keyed on that user id and a subsequent visit to `/profile` shows the submitted values

#### Scenario: Later save updates the same row

- **WHEN** a signed-in user who already has a `profiles` row submits Save Profile with changed fields
- **THEN** the system updates that row and does not create a second profile

#### Scenario: Incomplete save is allowed

- **WHEN** a signed-in user submits Save Profile with one or more required fields empty
- **THEN** the system still persists the submitted values and sets `is_complete` to false

#### Scenario: Save failure is returned, not thrown

- **WHEN** profile persistence fails
- **THEN** the user sees an error on the profile page and the previous stored profile (if any) is unchanged

### Requirement: Required fields and completeness

The system SHALL treat these fields as required for completion: full name, phone, location, work authorization, current/recent job title, experience level, years of experience, at least one skill, at least one complete work-experience role, education (highest degree, field of study, institution name, graduation year), job titles seeking, and remote preference.

A work-experience role is complete when company, job title, start date, key responsibilities, and either an end date or currently-working are all present.

The system SHALL treat these as optional: industries, LinkedIn URL, portfolio/GitHub URL, salary expectation, preferred locations, and resume PDF. Email SHALL NOT appear as missing.

The system SHALL persist `is_complete` as true only when every required field is filled. The system SHALL compute completion percentage and missing-field tags at read time and SHALL NOT store them as columns.

Empty extra work-experience roles SHALL NOT block completeness when at least one role is complete. Blank extra roles SHALL NOT be persisted.

#### Scenario: All required fields filled marks the profile complete

- **WHEN** the user saves a profile with every required field filled and optional fields empty
- **THEN** `is_complete` is true and `/profile` shows 100% with no missing-field tags

#### Scenario: Missing phone is flagged

- **WHEN** the stored profile has every required field filled except phone
- **THEN** `is_complete` is false, the attention banner is visible, and missing-field tags include Phone

#### Scenario: Resume absence does not block completeness

- **WHEN** the user saves every required field and has never uploaded a resume
- **THEN** `is_complete` is true

### Requirement: Completion banner

When required fields are missing, `/profile` SHALL show the existing attention banner with a completion percentage ring (filled required fields / required field count) and tags for the missing required fields. When no required fields are missing, the system SHALL hide the attention banner.

#### Scenario: Incomplete profile shows the banner

- **WHEN** a signed-in user opens `/profile` with missing required fields
- **THEN** the banner shows a percentage below 100 and tags for those missing fields

#### Scenario: Complete profile hides the banner

- **WHEN** a signed-in user opens `/profile` with `is_complete` true
- **THEN** the attention banner is not shown

### Requirement: Form pre-fill

On `/profile`, the system SHALL pre-fill the form from the saved `profiles` row when one exists. On a first visit with no row, the form SHALL be empty except the read-only email from the auth session. Dropdowns with no stored value SHALL have no real option selected so they count as missing. Stored enum values SHALL display as the matching UI labels.

#### Scenario: Return visit shows saved values

- **WHEN** a user who previously saved a profile opens `/profile`
- **THEN** each field shows the stored value (dropdowns as labels, tags as chips, work experience as roles)

#### Scenario: First visit is empty except email

- **WHEN** a signed-in user with no `profiles` row opens `/profile`
- **THEN** email is filled and read-only, and all other fields are empty (no mock names, jobs, or skills)

### Requirement: Dropdown value mapping

On save, the system SHALL map Work Authorization, Experience Level, and Remote Preference UI labels to schema values `citizen` | `permanent_resident` | `visa_required`, `junior` | `mid` | `senior` | `lead`, and `remote` | `onsite` | `hybrid` | `any` respectively. Highest Degree SHALL be stored on education as `high_school` | `associate` | `bachelors` | `masters` | `phd`. Job titles seeking and preferred locations SHALL be stored as text arrays (comma-separated input split and trimmed, empty tokens dropped). Skills and industries SHALL be stored as text arrays.

#### Scenario: Labels persist as schema values

- **WHEN** the user saves Work Authorization "Permanent Resident", Experience Level "Senior", and Remote Preference "Hybrid"
- **THEN** the stored row contains `permanent_resident`, `senior`, and `hybrid`

#### Scenario: Return visit remaps to labels

- **WHEN** that user reopens `/profile`
- **THEN** the dropdowns show "Permanent Resident", "Senior", and "Hybrid"

### Requirement: Resume upload

The system SHALL upload a resume when the user selects a PDF of at most 5MB, without waiting for Save Profile. The system SHALL store one active resume per user: persist the storage `url` and `key` on the profile row, under a key whose first path segment is the authenticated user id. After a successful replacement upload, the system SHALL remove the previous object when its key differs. Generate Resume from Profile SHALL remain inactive.

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

### Requirement: Profile completed event

The system SHALL capture PostHog event `profile_completed` with `{ userId }` exactly once per user: when a save moves `is_complete` from false to true. Incomplete saves and later saves of an already-complete profile SHALL NOT capture it.

#### Scenario: First time the profile becomes complete

- **WHEN** the user saves and `is_complete` changes from false to true
- **THEN** `profile_completed` is captured with that user's id

#### Scenario: Later complete saves do not recapture

- **WHEN** the user saves again while `is_complete` is already true
- **THEN** `profile_completed` is not captured
