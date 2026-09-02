## Purpose

Finds real job listings from an external provider for a title and location, scores each
one against the signed-in user's profile, and saves the results as a recorded run so the
Find Jobs list has real data to present. Every search consumes a paid model call and a
shared provider quota, so the prerequisites, limits, and failure behaviour are part of
the contract.

## ADDED Requirements

### Requirement: Job search requires an authenticated user

The system SHALL reject a job search from an unauthenticated caller, and SHALL NOT query
the provider, call the scoring model, or write any record for such a request.

#### Scenario: Unauthenticated search is refused

- **WHEN** a job search is requested without a valid session
- **THEN** the request is refused with a message telling the user to sign in
- **AND** no provider request, no model call, and no stored run or job results from it

### Requirement: Job search requires a job title

The system SHALL require a non-empty job title and SHALL treat the location as optional.
Both values SHALL be length-bounded. A request failing validation SHALL be refused before
any billable work occurs.

#### Scenario: Missing job title is refused

- **WHEN** a job search is requested with an empty or whitespace-only job title
- **THEN** the request is refused with a message asking for a job title
- **AND** no provider request and no model call are made

#### Scenario: Search without a location is accepted

- **WHEN** a job search is requested with a job title and no location
- **THEN** the search proceeds and returns listings without being restricted to a place

### Requirement: Job search requires profile signal for scoring

Scoring a job is only meaningful against a profile that carries signal, so the system
SHALL refuse a search when the user has no saved profile, or a profile with neither
skills nor a current title. The refusal SHALL name what the user must add, and SHALL
occur before any rate-limit decision so that a user who cannot yet search is told what
to fix rather than that they have searched too often.

#### Scenario: No saved profile is refused with guidance

- **WHEN** a user with no saved profile requests a search
- **THEN** the request is refused with a message telling them to save their profile first
- **AND** no provider request and no model call are made

#### Scenario: Profile without skills or title is refused with guidance

- **WHEN** a user whose profile has no skills and no current title requests a search
- **THEN** the request is refused with a message naming the job title and skills as what
  to add

#### Scenario: Prerequisite failures are reported ahead of rate limiting

- **WHEN** a user who has exhausted their search allowance and has no saved profile
  requests a search
- **THEN** the message describes the missing profile, not the exhausted allowance

### Requirement: Job search is rate limited per user

The system SHALL limit each user to a fixed number of searches per rolling hour, counted
once per search regardless of how many listings that search scores. The limit SHALL be
enforced on the server before the provider is contacted, so that it bounds both model
spend and the shared provider quota. A refusal SHALL tell the user when they may try
again.

#### Scenario: Search beyond the allowance is refused

- **WHEN** a user requests a search having already used their hourly allowance
- **THEN** the request is refused with a message stating the limit and when to retry
- **AND** no provider request and no model call are made

#### Scenario: The limit counts searches, not listings

- **WHEN** a single search scores ten listings
- **THEN** it consumes exactly one unit of the user's hourly allowance

#### Scenario: A search that finds nothing still consumes the allowance

- **WHEN** a search reaches the provider and the provider returns no listings
- **THEN** that search consumes one unit of the user's hourly allowance
- **AND** a repeated series of such searches is therefore bounded, because each one
  still spends a request against the provider's shared quota

#### Scenario: A provider outage does not consume the allowance

- **WHEN** a search fails because the provider is unreachable
- **THEN** that attempt does not count against the user's hourly allowance

### Requirement: Job search queries the provider for IT listings

The system SHALL request listings from the external job provider matching the given
title, restricted to information-technology listings, capped at ten results per search.
When a location is given the search SHALL be narrowed to it, except where the location
names a working arrangement rather than a place, in which case the search SHALL cover the
whole inferred country.

Because the provider is organised by country, the system SHALL infer a country from the
location text and SHALL default to the United States when no country can be identified.
Inference SHALL rely on country names and unambiguous country abbreviations only, and
SHALL NOT treat regional or state abbreviations as countries.

#### Scenario: Listings are restricted to IT jobs

- **WHEN** any search is performed
- **THEN** the provider request is filtered to information-technology listings

#### Scenario: A named country is used

- **WHEN** the location text names a supported country
- **THEN** that country's listings are searched

#### Scenario: A regional abbreviation is not mistaken for a country

- **WHEN** the location is "San Francisco, CA"
- **THEN** the search uses the default country rather than treating "CA" as Canada

#### Scenario: An unsupported country is not presented as a retryable search

- **WHEN** a search names a country the provider is not queried for, and returns nothing
- **THEN** the message names the countries that can be searched, rather than only
  suggesting a broader location

#### Scenario: An unrecognised location falls back to the default country

- **WHEN** the location names no identifiable country
- **THEN** the default country is searched

#### Scenario: A working arrangement is not treated as a place

- **WHEN** the location is "Remote"
- **THEN** the search is not narrowed to a place and covers the default country

### Requirement: Discovered jobs are scored against the user profile

The system SHALL produce, for each discovered listing, a match score between 0 and 100
inclusive, a short written reason addressed to the user, a list of the user's own skills
the listing asks for, and a list of skills the listing asks for that the user lacks.

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
- **THEN** that score is brought into range and all listings from the search are still
  saved

#### Scenario: A partially scored batch attributes scores correctly

- **WHEN** the scoring model returns results for only some of the listings
- **THEN** each returned score is attached to the listing it was produced for
- **AND** the remaining listings are saved with no score rather than a borrowed one

#### Scenario: Identity fields are withheld from the model

- **WHEN** a profile is prepared for scoring
- **THEN** the user's name, email address, phone number, and personal links are not
  included

### Requirement: Discovered jobs are persisted to the signed-in user's job list

The system SHALL save each discovered listing to the signed-in user's job list, recorded
as having been found by search, carrying the listing's title, company, location, salary
estimate where the provider supplies a usable one, an apply destination, a short summary
of the listing, and the four scoring values.

Fields the provider does not supply SHALL be left empty rather than filled with a
plausible value, and the time a job was found SHALL be recorded by the database rather
than the caller so that relative dates cannot disagree with the server.

#### Scenario: A discovered job is saved with its provider data and score

- **WHEN** a search completes successfully
- **THEN** each listing is saved to the user's job list, marked as found by search, with
  its title, company, apply destination, summary, and scoring values

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
the number of jobs saved. A run SHALL NOT be left recorded as in-progress once the request
has finished, whatever its outcome.

#### Scenario: A successful search records a completed run

- **WHEN** a search saves jobs successfully
- **THEN** its run is recorded as completed with a count matching the jobs saved

#### Scenario: A failed search records a failed run

- **WHEN** a search fails after its run was recorded
- **THEN** that run is recorded as failed rather than left in progress

#### Scenario: A search finding nothing records a completed run

- **WHEN** the provider returns no listings for the search
- **THEN** the run is recorded as completed with a count of zero, not as failed

### Requirement: The search reports the counts for that run

The system SHALL report, on success, how many jobs that search saved and how many of them
cleared the strong-match threshold. Both counts SHALL describe the search just performed
rather than the user's stored total, and SHALL use the same strong-match threshold the job
list uses to band scores.

#### Scenario: Counts describe the run, not the table

- **WHEN** a user with existing saved jobs runs a search that saves three
- **THEN** the reported count is three

#### Scenario: Finding nothing is reported as success with zero

- **WHEN** the provider returns no listings
- **THEN** the search reports success with a count of zero rather than an error

### Requirement: Failures are reported without discarding usable results

The system SHALL distinguish a provider failure from an internal failure in what it tells
the user, since the two imply different retry decisions. A failure to score SHALL NOT
discard listings that were successfully discovered: the jobs SHALL still be saved and the
search SHALL still report success, because the listings remain useful and a repeat search
costs the user again.

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
- **THEN** all discovered jobs are saved with no scores and the search reports success
- **AND** the run is recorded as completed with the jobs saved

#### Scenario: Saving failure is reported as an internal problem

- **WHEN** discovered jobs cannot be saved
- **THEN** the user is told the search could not be completed
- **AND** the run is recorded as failed

### Requirement: Search activity is instrumented

The system SHALL record an analytics event when a search starts, carrying the user, the
title, and the location searched, and one event per job saved, carrying the user, how the
job was found, and its match score. A search refused before it starts SHALL NOT be
counted as started. Analytics failure SHALL NOT fail a search whose jobs are already
saved.

#### Scenario: A started search is counted once

- **WHEN** a search passes its prerequisites and begins
- **THEN** exactly one search-started event is recorded for it

#### Scenario: A refused search is not counted as started

- **WHEN** a search is refused for missing input, prerequisites, or allowance
- **THEN** no search-started event is recorded

#### Scenario: Each saved job is counted

- **WHEN** a search saves ten jobs
- **THEN** ten job-found events are recorded, each carrying its match score

#### Scenario: Analytics failure does not fail the search

- **WHEN** recording analytics fails after jobs were saved
- **THEN** the search still reports success with its correct counts

### Requirement: Provider credentials are never exposed

The system SHALL read provider credentials on the server only, and SHALL NOT include them
in any client bundle, log line, error message shown to a user, or committed file. A
missing credential SHALL NOT prevent unrelated parts of the application from loading.

#### Scenario: Credentials stay out of logs

- **WHEN** a provider request is logged
- **THEN** the log records the country, response status, and result count, and neither the
  credentials nor the full request URL

#### Scenario: A missing credential does not break unrelated pages

- **WHEN** provider credentials are absent
- **THEN** pages that do not perform a job search continue to load normally
