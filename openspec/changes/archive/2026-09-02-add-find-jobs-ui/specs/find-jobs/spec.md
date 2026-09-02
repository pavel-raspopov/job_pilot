## Purpose

Lets a signed-in user search for jobs and work through the results: a search form with a
result summary, and a job list they can filter, sort, search within, and page through, with
each job's fit shown as a colour-banded match score.

## ADDED Requirements

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

### Requirement: Job search controls

The page SHALL present a search form with a job title field and a location field, each with
a visible label and placeholder text, plus a primary Find Jobs action. The fields SHALL
accept free text and SHALL NOT be required in this change.

Submitting the search SHALL reveal a success summary stating how many jobs were found and
how many were saved as strong matches. The summary SHALL be announced to assistive
technology as a status message.

In this change the search action SHALL NOT issue a network request, contact any job
provider, or alter the displayed job list; it only reveals the summary. The list is
populated from fixed sample data.

#### Scenario: Search reveals the result summary

- **WHEN** the user activates Find Jobs
- **THEN** a success summary naming the number of jobs found and strong matches saved
  appears below the search fields

#### Scenario: Search summary is hidden before the first search

- **WHEN** the user opens the page and has not yet activated Find Jobs
- **THEN** no result summary is shown

#### Scenario: Search performs no request in this change

- **WHEN** the user activates Find Jobs
- **THEN** no network request is issued and the rows shown in the job list are unchanged

### Requirement: Job list presentation

The system SHALL present jobs in a tabular list with a column for each of: company, role,
match score, salary estimate, source, and date found. Column headers SHALL be visible and
SHALL be associated with their columns for assistive technology.

Each row SHALL show the company name, the role title, the match score as both a bar and a
percentage, the salary estimate, a badge naming how the job was found, and how long ago the
job was found expressed in relative terms.

A row SHALL show a hover state indicating it is the unit of interest. In this change a row
SHALL NOT be a link and SHALL NOT navigate anywhere — the job details page does not exist
yet, and the system SHALL NOT present a control that leads to a missing page.

On a narrow viewport the list SHALL scroll horizontally within its own container and SHALL
NOT cause the page body to scroll horizontally.

#### Scenario: A job row shows all six values

- **WHEN** the job list renders a job
- **THEN** that row shows the company, role, match score bar with its percentage, salary
  estimate, source badge, and a relative date found

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

When no jobs match the active filters, the system SHALL show an explanatory empty state in
place of the table body, including a way to clear the active filters and return to the full
list. The system SHALL NOT present an empty table with headers and no explanation.

#### Scenario: Filter matching nothing shows the empty state

- **WHEN** the user's active filters match no jobs
- **THEN** an empty state explaining that no jobs match is shown, together with a control
  that clears the filters

#### Scenario: Clearing filters restores the list

- **WHEN** the user clears the filters from the empty state
- **THEN** the full job list is shown again from the first page
