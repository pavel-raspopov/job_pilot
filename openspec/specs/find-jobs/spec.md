# Find Jobs Specification

## Purpose

Lets a signed-in user search for jobs and work through the results: a search form with a
result summary, and a job list they can filter, sort, search within, and page through, with
each job's fit shown as a colour-banded match score.

## Requirements

### Requirement: Find Jobs page is authenticated and reachable

The system SHALL serve a Find Jobs page at `/find-jobs` to signed-in users only, using the
shared authenticated layout. An unauthenticated visitor SHALL be redirected to sign in. The
Navbar's Find Jobs link SHALL resolve to this page and SHALL be shown as the active
navigation item while the user is on it.

#### Scenario: Signed-in user opens Find Jobs

- **WHEN** a signed-in user follows the Navbar's Find Jobs link
- **THEN** the Find Jobs page renders inside the standard authenticated shell and the Find
  Jobs navigation item is highlighted as active

#### Scenario: Signed-out visitor is redirected

- **WHEN** a visitor who is not signed in requests `/find-jobs`
- **THEN** the system redirects them to the login page and does not render the job list

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

### Requirement: Match score presentation

The system SHALL show each job's match score as a horizontal bar with a filled proportion
equal to the score, accompanied by the numeric percentage.

The fill colour SHALL be banded by score: the success colour token for scores of 70 and
above, the warning colour token for scores from 50 to 69, and the muted text colour token
below 50. These bands SHALL come from design tokens; the system SHALL NOT use hardcoded
colour values or raw framework colour classes. The bands SHALL align with the High Match
threshold of 70 used by the match filter, so a job shown in the success colour is exactly a
job the High Match filter keeps.

The bar SHALL carry an accessible description of the score, so the value is available to a
user who cannot see the fill.

#### Scenario: A high score is shown in the success band

- **WHEN** a job's match score is 70 or above
- **THEN** its bar is filled in the success colour and the percentage is shown beside it

#### Scenario: A mid score is shown in the warning band

- **WHEN** a job's match score is between 50 and 69
- **THEN** its bar is filled in the warning colour

#### Scenario: A low score is shown in the muted band

- **WHEN** a job's match score is below 50
- **THEN** its bar is filled in the muted colour

#### Scenario: Score is available without colour

- **WHEN** assistive technology reads a job row
- **THEN** the match score is announced as a value, not only conveyed by the bar's fill

### Requirement: Filtering, searching, and sorting the job list

The system SHALL let the user narrow the list by free text matching either the company name
or the role title, case-insensitively, matching on any part of either value.

The system SHALL let the user restrict the list by match band: all jobs, only jobs scoring
70 or above, or only jobs scoring below 70.

The system SHALL let the user order the list by match score descending, by date found
descending, or by date found ascending.

The text filter, the match filter, and the sort order SHALL apply together, and the visible
list SHALL always reflect the current combination.

#### Scenario: Text filter matches company or role

- **WHEN** the user types text that appears in a company name or a role title
- **THEN** only jobs whose company or role contains that text, ignoring case, remain in the
  list

#### Scenario: High Match keeps only scores of 70 and above

- **WHEN** the user selects the High Match filter
- **THEN** every remaining job has a match score of 70 or above

#### Scenario: Low Match keeps only scores below 70

- **WHEN** the user selects the Low Match filter
- **THEN** every remaining job has a match score below 70

#### Scenario: Sorting reorders the visible list

- **WHEN** the user changes the sort from match score to newest
- **THEN** the list is reordered by date found, most recent first

#### Scenario: Filters combine

- **WHEN** the user has a text filter applied and then selects High Match
- **THEN** the list shows only jobs that satisfy both conditions

### Requirement: Job list pagination

The system SHALL paginate the job list and SHALL state the range and total in the form
"Showing X to Y of N results", where N is the number of jobs after filtering.

The system SHALL offer a previous control, a next control, and a control for each page. The
current page SHALL be identified to assistive technology. The previous control SHALL be
disabled on the first page and the next control SHALL be disabled on the last page; disabled
controls SHALL be genuinely disabled rather than styled to look unavailable.

The number of pages SHALL be derived from the filtered result count and the page size, and
SHALL NOT be a fixed value.

Changing the text filter, the match filter, or the sort order SHALL return the user to the
first page, so a filtered list is never presented as empty merely because the user was on a
later page.

#### Scenario: Range and total are reported

- **WHEN** the unfiltered list is shown on the first page
- **THEN** the footer states the visible range and the total number of results

#### Scenario: Edge controls are disabled at the edges

- **WHEN** the user is on the first page
- **THEN** the previous control is disabled, and when the user is on the last page the next
  control is disabled

#### Scenario: Filtering returns to the first page

- **WHEN** the user is on a page other than the first and then changes a filter or the sort
- **THEN** the list returns to the first page and shows the first results of the new
  ordering

#### Scenario: Page count follows the filtered total

- **WHEN** a filter reduces the number of matching jobs
- **THEN** the number of page controls is recalculated from the reduced total

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
