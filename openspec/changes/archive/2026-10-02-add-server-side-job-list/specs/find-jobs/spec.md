## MODIFIED Requirements

### Requirement: Job list presentation

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

A row SHALL show a hover state indicating it is the unit of interest. In this change a row
SHALL NOT be a link and SHALL NOT navigate anywhere — the job details page does not exist
yet, and the system SHALL NOT present a control that leads to a missing page.

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

#### Scenario: Rows do not navigate

- **WHEN** the user clicks a job row
- **THEN** the page does not navigate and no job details view is opened

#### Scenario: Narrow viewport keeps the page body stable

- **WHEN** the list is wider than a narrow viewport
- **THEN** the list scrolls horizontally inside its own container while the page body does
  not scroll horizontally

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
