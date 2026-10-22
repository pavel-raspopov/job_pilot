## ADDED Requirements

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

## REMOVED Requirements

### Requirement: Job list presentation

**Reason**: Its rows were inert by design until the job details page existed, and its scenario "Rows do not navigate" now contradicts the product. OpenSpec cannot drop a single scenario from a modified requirement, so the requirement is replaced as a whole.

**Migration**: Replaced by "Job list presentation and row navigation", which keeps every other sentence and scenario unchanged and adds row navigation, keyboard access and the list-view round trip.
