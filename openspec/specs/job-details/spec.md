# Job Details Specification

## Purpose

Lets a signed-in user open one of their saved jobs and see everything JobPilot knows about
it on one page: the posting's facts, how and why it matched their profile, the provider's
description, and a place for company research, with a way to apply and a way back to the
list they came from.

## Requirements

### Requirement: A job's details are shown only to its owner

The system SHALL show a job's details page at the job's own address only to the signed-in
user who saved that job. A visitor who is not signed in SHALL be sent to sign in, as for
every other authenticated page.

An address whose job identifier is malformed, names no saved job, or names a job saved by
a different user SHALL produce the same not-found page, with nothing to distinguish the
three cases. The not-found page SHALL offer a way back to the job list.

A failure to read the job or the session SHALL NOT be presented as not found. It SHALL be
presented as a temporary failure to load, with a way to try again.

#### Scenario: The owner sees their job

- **WHEN** a signed-in user opens the details address of a job they saved
- **THEN** that job's details page is shown

#### Scenario: A visitor who is not signed in is sent to sign in

- **WHEN** a visitor who is not signed in opens a job details address
- **THEN** they are sent to the sign-in page and no job data is shown

#### Scenario: Another user's job is not found

- **WHEN** a signed-in user opens the details address of a job saved by a different user
- **THEN** the not-found page is shown, identical to the page for a job that does not exist

#### Scenario: A malformed address is not found

- **WHEN** a signed-in user opens a job details address whose identifier is not a valid
  job identifier
- **THEN** the not-found page is shown, and no error is shown to the user

#### Scenario: A load failure is not reported as not found

- **WHEN** the job cannot be read because of a temporary failure
- **THEN** the user is told the job could not be loaded and is offered a way to try again
- **AND** they are not told the job does not exist

### Requirement: The job's header and key facts

The page SHALL show a link back to the job list, then a header with a company placeholder
mark, the role title, the company name, the match score, and a link to view the job post.
Below the header it SHALL show four facts: the salary estimate, the location, the job type,
and how long ago the job was found, in relative terms.

The match score SHALL be shown as a percentage, banded by the same thresholds and colour
tokens as the job list's score bar, so a job shown as a strong match here is exactly one
the list's High Match filter keeps. A job with no match score SHALL be shown as not scored,
never as zero.

A fact the job does not have SHALL be shown as not provided, both visibly and to assistive
technology. It SHALL NOT be left blank or shown as zero. A fact too long for its space
SHALL remain available in full.

The Back to Jobs link SHALL return to the list view the user opened the job from, as
carried in the details page's address. Missing or invalid view values SHALL fall back to
the list's defaults, and the link SHALL only ever lead to the job list.

#### Scenario: A scored job shows its banded percentage

- **WHEN** a job with a match score of 85 is shown
- **THEN** the header shows "85% Match Score" in the success band

#### Scenario: An unscored job is not shown as zero

- **WHEN** a job with no match score is shown
- **THEN** the header shows it as not scored and shows no percentage

#### Scenario: Missing facts are shown as not provided

- **WHEN** a job has no salary estimate and no job type
- **THEN** those two facts are shown as not provided, both visibly and to assistive
  technology

#### Scenario: Back to Jobs restores the list view

- **WHEN** the user opened the job from page 3 of the list sorted oldest first
- **THEN** Back to Jobs returns to page 3 of the list sorted oldest first

#### Scenario: A tampered view falls back to the default list

- **WHEN** the details address carries an unknown sort value, a negative page, or an
  address outside the application where a view value is expected
- **THEN** Back to Jobs leads to the job list with default values for anything invalid,
  and never to another address

### Requirement: The match assessment is shown as one snapshot

The page SHALL show the model's written reason for the match, the user's skills the job
asks for ("You have"), and the skills the job asks for that the user lacks ("Gap skills").
It SHALL state that this assessment reflects the user's profile when the job was found. It
SHALL NOT recompute the score, the reason or either list against the current profile.

Matched skills SHALL use the success badge tokens and gap skills SHALL use the accent
badge tokens, per the design system. Each list SHALL be identifiable without relying on
colour.

Each part SHALL have its own empty presentation: a scored job with no recorded reason, an
empty "You have" list, and an empty "Gap skills" list. A job that has not been scored
SHALL say so, and SHALL say that it will be scored the next time a search finds it, in
place of the reason and the skill lists.

#### Scenario: A scored job shows its reason and both lists

- **WHEN** a scored job with a reason, matched skills and gap skills is shown
- **THEN** the reason, the matched skills as success badges and the gap skills as accent
  badges are all shown, under labels naming each list

#### Scenario: An empty "You have" list has an empty state

- **WHEN** a scored job lists no matched skills
- **THEN** the "You have" list says that none of the user's profile skills were matched,
  rather than rendering nothing

#### Scenario: An unscored job explains itself

- **WHEN** a job with no match score is shown
- **THEN** the reason and skill sections say the job has not been scored yet and will be
  scored the next time a search finds it

#### Scenario: The assessment is labelled as a snapshot

- **WHEN** the match assessment is shown
- **THEN** it is captioned as reflecting the user's profile when the job was found

### Requirement: The job description

The page SHALL show the description the provider supplied, preserving its line breaks. As
the provider supplies a preview rather than the full posting, the page SHALL say so, and
when the job has a usable link it SHALL point the user to the full posting. A job with no
description SHALL show an empty state.

#### Scenario: The provider's preview is shown and labelled

- **WHEN** a job with a description and a usable link is shown
- **THEN** the description is shown with a note that it is a preview, linking to the full
  posting

#### Scenario: A job with no description has an empty state

- **WHEN** a job with no description is shown
- **THEN** the description section says no description was provided

### Requirement: The company research card before research exists

The page SHALL show a Company Research card. Until company research is available, the card
SHALL show an empty state that says no research exists yet. It SHALL NOT present a control
that starts research, and its copy SHALL NOT instruct the user to use one.

#### Scenario: The research card shows an empty state without an action

- **WHEN** a job's details page is shown
- **THEN** the Company Research card says no research exists yet
- **AND** it contains no button and no instruction to click one

### Requirement: Links to the posting are safe and explicit

The View Job Post link and the Apply Now action SHALL open the job's stored application
address in a new browsing context that cannot reach back into the page. Each SHALL tell
assistive technology that it opens a new tab. Apply Now SHALL name the company when the
company is known.

The system SHALL render these links only for an address using the `http` or `https`
scheme. For any other address, or none, it SHALL render neither link, and SHALL say in
place of Apply Now that no application link was provided.

#### Scenario: Apply Now opens the posting in a new tab

- **WHEN** a job with an `https` application address at "Insight Global" is shown
- **THEN** an "Apply Now at Insight Global" action opens that address in a new tab

#### Scenario: An unsafe address renders no link

- **WHEN** a job's stored application address uses the `javascript` scheme
- **THEN** neither View Job Post nor Apply Now is rendered
- **AND** the page says no application link was provided

### Requirement: Provider attribution on the details page

The details page SHALL show the visible "Jobs by Adzuna" credit, as every view of a job
listing does under the provider's API terms.

#### Scenario: The credit is shown with the job

- **WHEN** a job's details page is shown
- **THEN** a visible "Jobs by Adzuna" credit is shown on the page
