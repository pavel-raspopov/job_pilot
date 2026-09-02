## ADDED Requirements

### Requirement: Job search execution and feedback

The page SHALL present a search form with a job title field and a location field, each with
a visible label and placeholder text, plus a primary Find Jobs action. The fields SHALL
accept free text. The job title SHALL be required and the location SHALL remain optional.

Submitting the search SHALL run a real job search and, on success, SHALL reveal a summary
stating how many jobs that search found and how many of them were saved as strong matches.
The counts SHALL describe the search just performed, not the user's stored total. The
summary SHALL be announced to assistive technology as a status message.

While a search is running the system SHALL indicate that work is in progress in the action
itself and SHALL announce it to assistive technology, because a search may take tens of
seconds. The system SHALL prevent a second search from being submitted while one is in
flight, and SHALL do so synchronously so that two activations in the same instant cannot
both issue a request — each search is a billed operation.

A search that is refused or fails SHALL show an explanatory message announced assertively,
and SHALL leave the action usable so the user can try again. Where the refusal reason is
determined by the server — an exhausted allowance, an incomplete profile — the system SHALL
present the server's message rather than substituting its own.

A submission with an empty job title SHALL be refused without issuing any request, and
SHALL return the user's focus to the job title field.

A search that completes but finds nothing SHALL be presented as an informational outcome
rather than as a success or an error.

On success the displayed job list SHALL update to include the newly saved jobs without the
user reloading the page, and without discarding any filter, sort, or page position they had
already set.

#### Scenario: Search reveals the result summary for that run

- **WHEN** the user activates Find Jobs and the search saves jobs
- **THEN** a summary naming the number of jobs found and strong matches saved by that
  search appears below the search fields

#### Scenario: Search summary is hidden before the first search

- **WHEN** the user opens the page and has not yet activated Find Jobs
- **THEN** no result summary is shown

#### Scenario: A running search is visible and announced

- **WHEN** a search is in flight
- **THEN** the action reports that a search is running and is unavailable for a second
  submission
- **AND** a status message describing the wait is announced to assistive technology

#### Scenario: Two activations in one instant issue one request

- **WHEN** the user activates Find Jobs twice in immediate succession
- **THEN** exactly one search request is issued

#### Scenario: Empty job title is refused without a request

- **WHEN** the user activates Find Jobs with an empty job title
- **THEN** an error message is shown, focus returns to the job title field, and no request
  is issued

#### Scenario: A server refusal is shown as the server worded it

- **WHEN** the search is refused for an exhausted allowance or an incomplete profile
- **THEN** the message the server supplied is shown unchanged

#### Scenario: A failed search leaves the action usable

- **WHEN** a search fails
- **THEN** an error message is announced and the user can submit another search

#### Scenario: A search finding nothing is not shown as success

- **WHEN** a search completes having found no jobs
- **THEN** an informational message is shown rather than a success summary

#### Scenario: The list updates without losing the user's view

- **WHEN** a search saves new jobs while the user has a filter, sort, or page set
- **THEN** the list refreshes to include the new jobs and the user's filter, sort, and page
  position are preserved

## MODIFIED Requirements

### Requirement: Job list presentation

The system SHALL present the signed-in user's saved jobs in a tabular list with a column
for each of: company, role, match score, salary estimate, source, and date found. Jobs
SHALL be presented most recently found first. Column headers SHALL be visible and SHALL be
associated with their columns for assistive technology.

Each row SHALL show the company name, the role title, the match score as both a bar and a
percentage, the salary estimate, a badge naming how the job was found, and how long ago the
job was found expressed in relative terms. A job saved without a match score SHALL be
presented as unscored rather than as scoring zero, and a job saved without a salary
estimate SHALL be presented as having none.

A row SHALL show a hover state indicating it is the unit of interest. In this change a row
SHALL NOT be a link and SHALL NOT navigate anywhere — the job details page does not exist
yet, and the system SHALL NOT present a control that leads to a missing page.

On a narrow viewport the list SHALL scroll horizontally within its own container and SHALL
NOT cause the page body to scroll horizontally.

Wherever job listings are shown, the system SHALL display a visible credit naming the job
provider, as required by the provider's API terms. The credit SHALL NOT depend on the active
filter, so narrowing the list cannot remove it from the page.

#### Scenario: A job row shows all six values

- **WHEN** the job list renders a job
- **THEN** that row shows the company, role, match score bar with its percentage, salary
  estimate, source badge, and a relative date found

#### Scenario: Only the signed-in user's jobs are shown

- **WHEN** the job list renders
- **THEN** it contains only jobs saved for the signed-in user

#### Scenario: Newest jobs appear first

- **WHEN** the job list renders jobs found at different times
- **THEN** the most recently found job is ordered ahead of older ones

#### Scenario: An unscored job is not shown as a zero

- **WHEN** a saved job has no match score
- **THEN** its match score is presented as absent rather than as zero percent

#### Scenario: Provider attribution is shown with the listings

- **WHEN** the user has saved jobs and the list is rendered
- **THEN** a visible "Jobs by Adzuna" credit is shown
- **AND** it remains visible when a filter narrows the list to nothing

#### Scenario: Rows do not navigate

- **WHEN** the user clicks a job row
- **THEN** the page does not navigate and no job details view is opened

#### Scenario: Narrow viewport keeps the page body stable

- **WHEN** the list is wider than a narrow viewport
- **THEN** the list scrolls horizontally inside its own container while the page body does
  not scroll horizontally

### Requirement: Empty job list state

When the job list has nothing to show, the system SHALL show an explanatory empty state in
place of the table body, and SHALL NOT present an empty table with headers and no
explanation. The explanation SHALL distinguish the reason the list is empty, because the
remedies differ:

- **The user has no saved jobs at all.** The system SHALL tell them to run a search and
  SHALL NOT offer to clear filters, since no filter is responsible.
- **Filters matched none of the user's saved jobs.** The system SHALL say so and SHALL
  offer a way to clear the active filters and return to the full list.
- **The saved jobs could not be loaded.** The system SHALL say the jobs could not be
  loaded, indicate that this is usually temporary, and offer a way to retry. It SHALL NOT
  imply the user has no jobs.

#### Scenario: A user with no saved jobs is told to search

- **WHEN** a user with no saved jobs opens the page
- **THEN** an empty state telling them to run a search is shown, with no control offering
  to clear filters

#### Scenario: Filter matching nothing shows the empty state

- **WHEN** the user's active filters match no jobs
- **THEN** an empty state explaining that no jobs match is shown, together with a control
  that clears the filters

#### Scenario: Clearing filters restores the list

- **WHEN** the user clears the filters from the empty state
- **THEN** the full job list is shown again from the first page

#### Scenario: A load failure is not presented as an empty account

- **WHEN** the user's saved jobs cannot be loaded
- **THEN** an empty state saying the jobs could not be loaded is shown with a retry
  control, and it does not tell the user to run their first search

## REMOVED Requirements

### Requirement: Job search controls

**Reason**: The requirement mandated that activating Find Jobs issue no network request,
contact no job provider, and leave the displayed list unchanged, with the list populated
from fixed sample data. That was a deliberate scaffold for Feature 09, and it is the exact
behaviour this change replaces — the search is now a real, billed operation against a job
provider.

**Migration**: Superseded by "Job search execution and feedback", which carries the search
form's structure forward unchanged and adds the execution, in-flight, failure, and refresh
behaviour. The form markup, field labels, and placeholder text are unaffected, so no user
retraining or interface relearning is implied.
