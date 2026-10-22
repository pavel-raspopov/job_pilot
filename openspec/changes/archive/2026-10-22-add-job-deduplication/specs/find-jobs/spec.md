## MODIFIED Requirements

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
