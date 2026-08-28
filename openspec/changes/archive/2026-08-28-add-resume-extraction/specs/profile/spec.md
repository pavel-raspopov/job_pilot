## ADDED Requirements

### Requirement: Resume extraction request

The system SHALL let a signed-in user request extraction of their stored resume from `/profile`. The extraction control SHALL be offered only when a resume is on file, SHALL indicate that extraction is in progress, and SHALL be unavailable while a request is in flight so a user cannot start two at once.

Extraction SHALL read only the resume belonging to the requesting user. The system SHALL reject any stored resume reference whose first path segment is not the authenticated user id.

Extraction SHALL NOT modify the stored profile, the stored resume, or `is_complete`.

#### Scenario: Extraction is offered once a resume is on file

- **WHEN** a signed-in user opens `/profile` and a resume is stored on their profile
- **THEN** the extraction control is available

#### Scenario: Extraction is not offered without a resume

- **WHEN** a signed-in user opens `/profile` and no resume is stored
- **THEN** the extraction control is not available

#### Scenario: Extraction is unavailable while running

- **WHEN** the user starts an extraction and it has not yet finished
- **THEN** the control shows progress and cannot be triggered again

#### Scenario: Signed-out request is refused

- **WHEN** an extraction is requested without a valid session
- **THEN** the system refuses it, reads no resume, and returns an error

### Requirement: Extracted values populate the form

On a successful extraction the system SHALL populate the profile form with the returned values: personal fields, professional fields, skills, industries, education, work experience, and job preferences. Fields the resume does not state SHALL be left as they were rather than overwritten with blanks.

Populated values SHALL be editable exactly as typed values are — the user SHALL be able to correct any extracted field, add or remove tags, and edit or remove roles before saving.

The system SHALL populate at most three work-experience roles, most recent first, matching the maximum the form accepts.

#### Scenario: Extraction fills the form

- **WHEN** extraction succeeds for a resume stating a name, contact details, skills, education, and employment history
- **THEN** the corresponding form fields, dropdowns, tags, and roles show those values

#### Scenario: Extracted values remain editable

- **WHEN** the user edits an extracted field, removes an extracted tag, or clears an extracted role
- **THEN** the edit is kept and a later save persists the edited value

#### Scenario: More than three roles is capped

- **WHEN** the resume lists more than three positions
- **THEN** the form shows the three most recent

#### Scenario: Unstated fields are not blanked

- **WHEN** the resume does not state a field that the user has already filled in
- **THEN** that field keeps the user's existing value

### Requirement: Extracted values map to schema values

The system SHALL map extracted values onto the same stored representations the profile already uses: work authorization as `citizen` | `permanent_resident` | `visa_required`, experience level as `junior` | `mid` | `senior` | `lead`, remote preference as `remote` | `onsite` | `hybrid` | `any`, and highest degree as `high_school` | `associate` | `bachelors` | `masters` | `phd`. Skills, industries, job titles seeking, and preferred locations SHALL be arrays. Years of experience SHALL be a non-negative number.

The system SHALL discard any extracted value that does not match the expected shape rather than placing it in the form.

Where the resume implies but does not state experience level, the system SHALL infer it from the stated titles and years of experience.

#### Scenario: Dropdown values arrive as labels the form can show

- **WHEN** extraction returns work authorization, experience level, remote preference, and degree
- **THEN** the matching dropdown options are selected

#### Scenario: An unusable value is discarded

- **WHEN** extraction returns a value outside the allowed set, or a non-numeric years of experience
- **THEN** that field is left unset and the rest of the extraction is still applied

#### Scenario: Experience level is inferred

- **WHEN** the resume shows a senior title and eight years of history but never names a level
- **THEN** the experience level dropdown is set to the inferred level

### Requirement: Review before save

Extraction SHALL NOT persist anything. Extracted values SHALL reach the stored profile only when the user submits Save Profile.

#### Scenario: Leaving without saving discards the extraction

- **WHEN** the user extracts and then reloads `/profile` without saving
- **THEN** the form shows the previously stored values and the stored profile is unchanged

#### Scenario: Saving after extraction persists the reviewed values

- **WHEN** the user extracts, reviews, and submits Save Profile
- **THEN** the reviewed values are stored and completion is recomputed from them

#### Scenario: The completion banner does not move until save

- **WHEN** extraction fills fields that were previously missing and the user has not saved
- **THEN** the attention banner still reflects the stored profile

### Requirement: Extraction failures are reported, not thrown

When extraction cannot complete, the system SHALL show the user an error on the profile page, leave the form untouched, and change no stored data. This applies when no resume is on file, when the stored resume cannot be read, when the AI service is unavailable or unfunded, and when the response contains no usable profile fields.

When the resume yields no usable fields, the message SHALL tell the user the resume could not be read and to try a different file.

The system SHALL NOT surface internal error detail, provider names, or storage locations to the user.

#### Scenario: Unreadable resume

- **WHEN** extraction returns no usable fields for the stored resume
- **THEN** the user is told the resume could not be read and to try a different file, and the form is unchanged

#### Scenario: Service unavailable

- **WHEN** the AI service errors or is unfunded
- **THEN** the user sees an error, the form is unchanged, and no stored data is written

#### Scenario: Stored resume missing

- **WHEN** the profile references a resume that can no longer be read from storage
- **THEN** the user sees an error and the form is unchanged
