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

### Requirement: Job list presentation and row navigation

The system SHALL present the signed-in user's saved jobs in a tabular list with a column
for each of: company, role, match score, salary estimate, source, and date found. Column
headers SHALL be visible and SHALL be associated with their columns for assistive
technology. The order in which jobs are presented is governed by the sorting requirement
below, not by this one.

Each row SHALL show the company name, the role title, the match score as both a bar and a
percentage, the salary estimate, a badge naming how the job was found, and how long ago the
job was found expressed in relative terms. A job saved without a match score SHALL be
presented as unscored rather than as scoring zero, and a job saved without a salary
estimate SHALL be presented as having none.

A row SHALL show a hover state indicating it is the unit of interest, and SHALL open that
job's details page when activated anywhere on the row. Each row SHALL be reachable and
operable from the keyboard as a single link whose accessible name identifies the role and
the company. The link SHALL carry the list's current view (its search text, match band,
sort and page), so returning from the details page restores the view the user left.

On a narrow viewport the list SHALL scroll horizontally within its own container and SHALL
NOT cause the page body to scroll horizontally.

Wherever job listings are shown, the system SHALL display a visible credit naming the job
provider, as required by the provider's API terms. The credit SHALL be shown whenever the
user has saved jobs at all, and SHALL NOT depend on the active filter or on which page is
being viewed, so neither narrowing the list nor paging through it can remove the credit
from the page.

#### Scenario: A job row shows all six values

- **WHEN** the job list renders a job
- **THEN** that row shows the company, role, match score bar with its percentage, salary
  estimate, source badge, and a relative date found

#### Scenario: Only the signed-in user's jobs are shown

- **WHEN** the job list renders
- **THEN** it contains only jobs saved for the signed-in user

#### Scenario: Newest jobs appear first

- **WHEN** the job list is ordered by match score and renders jobs whose match scores are
  equal
- **THEN** the most recently found of them is ordered ahead of the older ones

#### Scenario: An unscored job is not shown as a zero

- **WHEN** a saved job has no match score
- **THEN** its match score is presented as absent rather than as zero percent

#### Scenario: Provider attribution is shown with the listings

- **WHEN** the user has saved jobs and the list is rendered
- **THEN** a visible "Jobs by Adzuna" credit is shown
- **AND** it remains visible when a filter narrows the list to nothing

#### Scenario: A row opens its job

- **WHEN** the user clicks anywhere on a job row
- **THEN** that job's details page opens

#### Scenario: A row is one keyboard link

- **WHEN** a keyboard user tabs through the job list
- **THEN** each row is reached once, as a link naming the role and the company
- **AND** activating it opens that job's details page

#### Scenario: The row link carries the list view

- **WHEN** the user opens a job from page 2 of a list filtered to High Match with the
  search text "react"
- **THEN** the details page's Back to Jobs link returns to page 2 of the High Match list
  filtered by "react"

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
or the role title, case-insensitively, matching on any part of either value. An asterisk in
the filter text SHALL be treated as a wildcard standing for any run of characters, and every
other character — including a comma, a period, a percent sign, an underscore, a quotation
mark, a backslash, and a parenthesis — SHALL be matched literally.

The system SHALL let the user restrict the list by match band: all jobs, only jobs scoring
70 or above, or the remainder. **A job with no match score SHALL be treated as belonging to
the lower band**, so that the two bands together account for every one of the user's saved
jobs and a job whose scoring failed cannot disappear from both.

The system SHALL let the user order the list by match score descending, by date found
descending, or by date found ascending. Ordering SHALL be **total**: whenever the chosen key
is equal for two jobs the system SHALL apply further keys until the order is fully
determined, so that a job can never appear on two pages of the same result set and can never
be omitted from all of them. Ordering by match score SHALL place unscored jobs after every
scored job, and SHALL order jobs of equal score most recently found first.

The text filter, the match filter, and the sort order SHALL apply together, and the visible
list SHALL always reflect the current combination. The reported total and the ordering SHALL
be computed over all of the user's saved jobs that satisfy the current filters — never over
a subset already fetched — so the footer's total and the rows on screen cannot disagree.

The current text filter, match band, sort order, and page SHALL be represented in the page's
address, so that a filtered view can be linked to, bookmarked, and restored by reloading,
and so that the browser's back and forward controls move between views the user has
selected. Editing the text filter SHALL NOT add one back-navigation step per keystroke.
Values in the address that are absent, empty, unrecognised, or out of range SHALL fall back
to the default view without presenting an error.

While a change to the filter, band, sort, or page is being applied, the system SHALL
indicate that the list is updating and SHALL announce that state to assistive technology. It
SHALL keep the rows already on screen visible rather than blanking the table or replacing it
with a placeholder. Controls that change which page is shown SHALL be unavailable while a
change is in flight, so that a second activation cannot skip past a page. The text filter
SHALL remain editable throughout, and typing into it SHALL NOT be delayed by a change
already in flight.

#### Scenario: Text filter matches company or role

- **WHEN** the user types text that appears in a company name or a role title
- **THEN** only jobs whose company or role contains that text, ignoring case, remain in the
  list

#### Scenario: Punctuation in the filter text is matched literally

- **WHEN** the user filters on text containing a comma, a percent sign, or an underscore
- **THEN** only jobs whose company or role contains that exact text remain in the list, and
  the list is not reported as having failed to load

#### Scenario: High Match keeps only scores of 70 and above

- **WHEN** the user selects the High Match filter
- **THEN** every remaining job has a match score of 70 or above, and no unscored job remains

#### Scenario: Low Match keeps only scores below 70

- **WHEN** the user selects the Low Match filter
- **THEN** no remaining job scores 70 or above
- **AND** jobs with no match score are among those remaining
- **AND** the number of jobs in the two bands together equals the number of jobs with no
  band filter applied

#### Scenario: Sorting reorders the visible list

- **WHEN** the user changes the sort from match score to newest
- **THEN** the list is reordered by date found, most recent first

#### Scenario: Unscored jobs sort after scored ones

- **WHEN** the list is ordered by match score
- **THEN** every job with a match score appears before every job without one

#### Scenario: Jobs found at the same instant have a stable order

- **WHEN** the result set contains jobs whose date found is identical and the user pages
  through the whole set
- **THEN** each job appears exactly once across all pages

#### Scenario: Filters combine

- **WHEN** the user has a text filter applied and then selects High Match
- **THEN** the list shows only jobs that satisfy both conditions

#### Scenario: A filtered view can be shared and restored

- **WHEN** the user applies a text filter, a band, a sort, and moves to a later page, and
  then reloads the page
- **THEN** the same filter, band, sort, and page are shown

#### Scenario: An unrecognised view in the address falls back to the default

- **WHEN** the page is opened with a sort, band, or page value that is not recognised
- **THEN** the default view is shown and no error is presented

#### Scenario: The list reports that it is updating

- **WHEN** the user changes the sort order
- **THEN** the list indicates it is updating, the rows already shown remain visible, and the
  page controls are unavailable until the new rows arrive

### Requirement: Job list pagination

The system SHALL paginate the job list at twenty jobs per page and SHALL state the range and
total in the form "Showing X to Y of N results", where N is the number of jobs after
filtering.

The system SHALL offer a previous control, a next control, and a control for each page it
chooses to list. The current page SHALL be identified to assistive technology. The previous
control SHALL be disabled on the first page and the next control SHALL be disabled on the
last page; disabled controls SHALL be genuinely disabled rather than styled to look
unavailable.

The number of pages SHALL be derived from the filtered result count and the page size, and
SHALL NOT be a fixed value. When there are more pages than the control lists individually,
it SHALL always offer the first page, the last page, and the pages adjacent to the current
one, and SHALL mark each elided run of pages so the user can see that pages have been
omitted.

Changing the text filter, the match filter, or the sort order SHALL return the user to the
first page, so a filtered list is never presented as empty merely because the user was on a
later page.

A request for a page beyond the last page SHALL show the last page rather than an empty
table, and every value describing the result set — the stated range, the total, and which
page is marked current — SHALL describe the page actually shown.

#### Scenario: Range and total are reported

- **WHEN** the unfiltered list is shown on the first page
- **THEN** the footer states the visible range and the total number of results

#### Scenario: Twenty jobs are shown per page

- **WHEN** the filtered result set contains more than twenty jobs
- **THEN** the first page shows twenty of them

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

#### Scenario: Omitted pages are indicated

- **WHEN** there are more pages than the control lists individually
- **THEN** the first page, the last page, and the pages next to the current one are offered,
  and each omitted run of pages is marked as omitted

#### Scenario: A page beyond the end shows the last page

- **WHEN** the page is opened asking for a page number past the last page
- **THEN** the last page of results is shown with a range and total that describe it, rather
  than an empty table

### Requirement: Empty job list state

When the job list has nothing to show, the system SHALL show an explanatory empty state in
place of the table body, and SHALL NOT present an empty table with headers and no
explanation. The explanation SHALL distinguish the reason the list is empty, because the
remedies differ:

- **The user has no saved jobs at all.** The system SHALL tell them to run a search and
  SHALL NOT offer to clear filters, since no filter is responsible. This case SHALL be
  reported even when a filter happens to be active, because offering to clear a filter
  would not produce any jobs.
- **Filters matched none of the user's saved jobs.** The system SHALL say so and SHALL
  offer a way to clear the active filters and return to the full list.
- **The saved jobs could not be loaded.** The system SHALL say the jobs could not be
  loaded, indicate that this is usually temporary, and offer a way to retry. It SHALL NOT
  imply the user has no jobs. A failure to establish who the signed-in user is SHALL be
  reported this way and SHALL NOT be reported as an account with no jobs.

Telling the first two cases apart SHALL NOT depend on the system having loaded the user's
entire job list. Where the filtered result alone cannot distinguish them, the system SHALL
establish which case applies before choosing the message; if it cannot establish that, it
SHALL present the case that offers the user a way forward rather than telling a user who may
have saved jobs to run their first search.

#### Scenario: A user with no saved jobs is told to search

- **WHEN** a user with no saved jobs opens the page
- **THEN** an empty state telling them to run a search is shown, with no control offering
  to clear filters

#### Scenario: A user with no saved jobs who filters is still told to search

- **WHEN** a user with no saved jobs opens the page with a text filter applied
- **THEN** an empty state telling them to run a search is shown, and no control offering to
  clear filters is presented

#### Scenario: Filter matching nothing shows the empty state

- **WHEN** the user's active filters match no jobs and the user has saved jobs
- **THEN** an empty state explaining that no jobs match is shown, together with a control
  that clears the filters

#### Scenario: Clearing filters restores the list

- **WHEN** the user clears the filters from the empty state
- **THEN** the full job list is shown again from the first page

#### Scenario: A load failure is not presented as an empty account

- **WHEN** the user's saved jobs cannot be loaded
- **THEN** an empty state saying the jobs could not be loaded is shown with a retry
  control, and it does not tell the user to run their first search

#### Scenario: An unidentifiable session is reported as a load failure

- **WHEN** the page renders but the signed-in user cannot be established
- **THEN** an empty state saying the jobs could not be loaded is shown, and it does not
  tell the user to run their first search

### Requirement: Job search execution and feedback

The page SHALL present a search form with a job title field and a location field, each with
a visible label and placeholder text, plus a primary Find Jobs action. The fields SHALL
accept free text. The job title SHALL be required and the location SHALL remain optional.

Submitting the search SHALL run a real job search and, on success, SHALL reveal a summary
stating how many jobs that search found, how many of them were new to the user's list, and
how many of the new jobs were saved as strong matches. The counts SHALL describe the search
just performed, not the user's stored total. The summary SHALL be announced to assistive
technology as a status message.

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
rather than as a success or an error. A search that finds jobs, all of which are already in
the user's list, SHALL also be presented as an informational outcome, stating how many jobs
were found and that all of them were already saved, rather than as a success that added
nothing.

On success the displayed job list SHALL update to include the newly saved jobs without the
user reloading the page, and without discarding any filter, sort, or page position they had
already set.

#### Scenario: Search reveals the result summary for that run

- **WHEN** the user activates Find Jobs and the search saves new jobs
- **THEN** a summary naming the number of jobs found, the number new to the list, and the
  strong matches among the new jobs appears below the search fields

#### Scenario: A search re-finding some saved jobs reports only the new ones as new

- **WHEN** a search finds ten jobs of which three were not already saved
- **THEN** the summary reports ten found and three new

#### Scenario: A search finding only saved jobs is informational

- **WHEN** a search finds jobs and every one of them is already in the user's list
- **THEN** an informational message states how many were found and that all were already
  saved, and no success summary is shown

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
