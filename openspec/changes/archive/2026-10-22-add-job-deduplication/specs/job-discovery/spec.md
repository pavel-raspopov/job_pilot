## ADDED Requirements

### Requirement: A listing is saved to a user's job list at most once

The system SHALL identify a discovered listing by the identifier the provider assigns to
it, and SHALL NOT identify it by its apply destination, which the provider varies from
one request to the next, or by its title and company, which distinct openings can share.

A listing already in the signed-in user's job list SHALL NOT be saved again, and a later
search SHALL NOT change it: its score, reasoning, skill lists, and the time it was first
found SHALL remain as they were. This SHALL hold even when two searches by the same user
run at the same time, and SHALL be enforced by the database, not only checked beforehand.

The one exception is a saved listing that has **no match score**, because scoring failed
when it was first found. A later search that returns it SHALL score it and fill in its
missing scoring values, so a failed scoring can still be recovered. Filling in SHALL NOT
overwrite a score that is already present, including one written by a concurrent search
a moment earlier, and SHALL NOT change the listing's date found or the run it belongs to. A listing that the provider returns more than once in a single response
SHALL be saved once. A listing the provider returns without an identifier SHALL NOT be
saved, since it could never be recognised again.

Deduplication SHALL be per user: one user's saved listing SHALL NOT prevent another user
from saving the same listing.

#### Scenario: Repeating a search does not duplicate the list

- **WHEN** a user runs a search that returns ten listings, then runs the same search
  again and the provider returns the same ten listings
- **THEN** the user's job list still holds those ten jobs exactly once each

#### Scenario: A re-found job keeps its original values

- **WHEN** a search returns a listing the user already has
- **THEN** that job's match score, reasoning, skill lists, and date found are unchanged

#### Scenario: The same listing is recognised despite a different apply destination

- **WHEN** the provider returns a listing the user already has, carrying the same
  identifier but a different apply destination
- **THEN** it is recognised as already saved and is not saved again

#### Scenario: Two openings sharing a title and company are both kept

- **WHEN** a search returns two listings with the same title and company but different
  provider identifiers
- **THEN** both are saved as separate jobs

#### Scenario: Concurrent searches save a shared listing once

- **WHEN** the same user runs two searches at the same time and both return a listing the
  user did not have
- **THEN** that listing is saved exactly once

#### Scenario: A listing repeated within one response is saved once

- **WHEN** a single provider response contains the same listing twice
- **THEN** it is saved once

#### Scenario: A listing without an identifier is not saved

- **WHEN** the provider returns a listing that carries no identifier
- **THEN** that listing is not saved and the rest of the search proceeds

#### Scenario: Another user's saved listing does not block a save

- **WHEN** a listing is already in one user's job list and a different user's search
  returns it
- **THEN** it is saved to the second user's list

#### Scenario: A saved but unscored job is scored by a later search

- **WHEN** a listing was saved without a match score, and a later search returns it
- **THEN** it is scored and its missing scoring values are filled in
- **AND** its date found and its run are unchanged, and no second copy is saved

#### Scenario: Filling in never overwrites a score

- **WHEN** two searches both score the same unscored listing and both try to fill it in
- **THEN** the listing keeps the first score written, and the second is discarded

#### Scenario: A search finding only saved, scored listings makes no scoring call

- **WHEN** every listing a search returns is already in the user's job list with a score
- **THEN** no scoring request is made and nothing is saved
- **AND** the search still consumes one unit of the allowance, because the provider was
  queried

## MODIFIED Requirements

### Requirement: Discovered jobs are scored against the user profile

The system SHALL produce, for each discovered listing it is about to save, a match score
between 0 and 100 inclusive, a short written reason addressed to the user, a list of the
user's own skills the listing asks for, and a list of skills the listing asks for that
the user lacks. Listings already in the user's job list SHALL NOT be sent for scoring,
except those saved without a match score, which SHALL be scored in the same request so
their missing values can be filled in.

Scores SHALL be whole numbers within range regardless of what the model returns, so that
one malformed score cannot invalidate an entire search. Skills named as matched SHALL be
drawn from the user's profile and SHALL NOT be invented. A listing the model fails to
score SHALL be identified individually rather than by position, so that a short or
partial response cannot attribute one listing's score to a different employer.

The system SHALL NOT send profile identity fields — name, email address, phone number, or
personal links — to the scoring model, as they carry no scoring signal.

#### Scenario: Each listing receives a score in range

- **WHEN** a search scores its listings
- **THEN** every scored listing has a whole-number match score between 0 and 100

#### Scenario: An out-of-range score does not invalidate the search

- **WHEN** the scoring model returns a score above 100 or below 0 for one listing
- **THEN** that score is brought into range and every new listing from the search is
  still saved

#### Scenario: A partially scored batch attributes scores correctly

- **WHEN** the scoring model returns results for only some of the listings
- **THEN** each returned score is attached to the listing it was produced for
- **AND** the remaining listings are saved with no score rather than a borrowed one

#### Scenario: Identity fields are withheld from the model

- **WHEN** a profile is prepared for scoring
- **THEN** the user's name, email address, phone number, and personal links are not
  included

#### Scenario: Only new and unscored listings are scored

- **WHEN** a search returns ten listings of which seven are already in the user's list,
  one of those seven without a score
- **THEN** only the three new listings and the one unscored listing are sent for scoring

### Requirement: Discovered jobs are persisted to the signed-in user's job list

The system SHALL save each discovered listing that is not already in the signed-in
user's job list, recorded as having been found by search, carrying the provider's
identifier for the listing, its title, company, location, salary estimate where the
provider supplies a usable one, an apply destination, a short summary of the listing,
and the four scoring values.

Fields the provider does not supply SHALL be left empty rather than filled with a
plausible value, and the time a job was found SHALL be recorded by the database rather
than the caller so that relative dates cannot disagree with the server.

#### Scenario: A discovered job is saved with its provider data and score

- **WHEN** a search completes successfully and returns a listing the user does not have
- **THEN** that listing is saved to the user's job list, marked as found by search, with
  its provider identifier, title, company, apply destination, summary, and scoring values

#### Scenario: Unsupplied fields are left empty

- **WHEN** the provider supplies no employment type or structured requirement lists
- **THEN** those fields are saved empty rather than guessed or defaulted

#### Scenario: A listing with no usable salary figure saves without one

- **WHEN** the provider supplies no salary, or only a figure too small to be an annual
  one
- **THEN** the job is saved with no salary estimate rather than a misleading one

### Requirement: Every search is recorded as a run

The system SHALL record each search that passes its prerequisites as a run carrying the
title and location searched, and SHALL update that run on completion with its outcome and
the number of jobs that search newly saved. A run SHALL NOT be left recorded as
in-progress once the request has finished, whatever its outcome.

#### Scenario: A successful search records a completed run

- **WHEN** a search saves jobs successfully
- **THEN** its run is recorded as completed with a count matching the jobs newly saved

#### Scenario: A failed search records a failed run

- **WHEN** a search fails after its run was recorded
- **THEN** that run is recorded as failed rather than left in progress

#### Scenario: A search finding nothing records a completed run

- **WHEN** the provider returns no listings for the search
- **THEN** the run is recorded as completed with a count of zero, not as failed

#### Scenario: A search finding only saved listings records a completed run

- **WHEN** every listing the provider returns is already in the user's job list
- **THEN** the run is recorded as completed with a count of zero, not as failed

### Requirement: The search reports the counts for that run

The system SHALL report, on success, how many listings that search found, how many of
them it newly saved, and how many of the newly saved jobs cleared the strong-match
threshold. All three counts SHALL describe the search just performed rather than the
user's stored total. A listing already in the user's job list SHALL count as found but
not as newly saved or as a strong match, even if its stored score clears the threshold
and even if this search filled in its missing score.
The strong-match count SHALL use the same threshold the job list uses to band scores.

When two searches race on the same listing, only the search that actually saved it SHALL
count it as newly saved.

#### Scenario: Counts describe the run, not the table

- **WHEN** a user with existing saved jobs runs a search that finds five listings, three
  of them new
- **THEN** the search reports five found and three newly saved

#### Scenario: Strong matches count only new jobs

- **WHEN** a search re-finds a saved job scoring 90 and saves one new job scoring 40
- **THEN** the search reports zero strong matches

#### Scenario: Finding nothing is reported as success with zero

- **WHEN** the provider returns no listings
- **THEN** the search reports success with zero found and zero newly saved rather than
  an error

#### Scenario: Finding only saved listings is reported as success

- **WHEN** every listing the provider returns is already in the user's job list
- **THEN** the search reports success with the number found and zero newly saved

### Requirement: Search activity is instrumented

The system SHALL record an analytics event when a search starts, carrying the user, the
title, and the location searched, and one event per job newly saved, carrying the user,
how the job was found, and its match score. A search refused before it starts SHALL NOT
be counted as started, and a listing re-found by a later search SHALL NOT be counted
again as found, including when that search fills in its missing score. Analytics failure SHALL NOT fail a search whose jobs are already saved.

#### Scenario: A started search is counted once

- **WHEN** a search passes its prerequisites and begins
- **THEN** exactly one search-started event is recorded for it

#### Scenario: A refused search is not counted as started

- **WHEN** a search is refused for missing input, prerequisites, or allowance
- **THEN** no search-started event is recorded

#### Scenario: Each saved job is counted

- **WHEN** a search saves ten jobs
- **THEN** ten job-found events are recorded, each carrying its match score

#### Scenario: A re-found job is not counted again

- **WHEN** a search returns ten listings of which seven are already in the user's list
- **THEN** three job-found events are recorded

#### Scenario: Analytics failure does not fail the search

- **WHEN** recording analytics fails after jobs were saved
- **THEN** the search still reports success with its correct counts

### Requirement: Failures are reported without discarding usable results

The system SHALL distinguish a provider failure from an internal failure in what it tells
the user, since the two imply different retry decisions. A failure to score SHALL NOT
discard listings that were successfully discovered: the new jobs SHALL still be saved
without scores and the search SHALL still report success, because the listings remain
useful. A later search that returns those listings again SHALL score them, so repeating
the search recovers a failed scoring rather than leaving the jobs unscored for good.

#### Scenario: Provider failure is reported as a provider problem

- **WHEN** the provider returns an error, times out, or is unreachable
- **THEN** the user is told job search is unavailable and to try again
- **AND** the run is recorded as failed with no jobs saved

#### Scenario: Missing provider credentials surface as unavailability

- **WHEN** the provider credentials are absent or rejected
- **THEN** the user is told job search is unavailable, without exposing the cause
- **AND** the condition is logged for the operator

#### Scenario: Scoring failure still saves the discovered jobs

- **WHEN** discovery succeeds but scoring fails entirely
- **THEN** every new listing is saved with no score and the search reports success
- **AND** the run is recorded as completed with the jobs saved

#### Scenario: Repeating the search recovers a failed scoring

- **WHEN** a search saved listings without scores, and the user repeats the search and
  scoring now succeeds
- **THEN** those listings gain scores, and no second copy of any of them is saved

#### Scenario: Saving failure is reported as an internal problem

- **WHEN** discovered jobs cannot be saved
- **THEN** the user is told the search could not be completed
- **AND** the run is recorded as failed
