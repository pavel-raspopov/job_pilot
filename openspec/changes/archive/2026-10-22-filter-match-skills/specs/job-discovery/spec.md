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

Both skill lists SHALL be checked against the skills listed in the user's profile before a
listing is saved, whatever the model returned. Only entries in the profile's skill list
count as the user's skills. Industries, job titles sought, the current title and
work-history text do not. Two skills SHALL be treated as the same when they are equal
ignoring letter case, spacing and punctuation other than `+` and `#`. A matched skill that
is not one of the user's skills SHALL be removed, and a kept matched skill SHALL be shown
as the profile spells it, at most once. A missing skill that is one of the user's skills
SHALL be removed. Removing entries SHALL NOT change the listing's score or reason, and
each list SHALL hold at most six entries after removal.

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

#### Scenario: A matched skill the user does not have is not saved

- **WHEN** the scoring model names as matched a skill missing from the user's profile
  skills, an industry from the profile, or a job title the user is seeking
- **THEN** the saved listing's matched skills do not include it
- **AND** the listing's score and reason are saved as the model returned them

#### Scenario: A skill the user has is never saved as missing

- **WHEN** the scoring model names as missing a skill the user's profile lists, written
  in different letter case or punctuation, such as "nodejs" for "Node.js"
- **THEN** the saved listing's missing skills do not include it
- **AND** if the model also named it as matched, it is saved once, as matched, in the
  profile's spelling

#### Scenario: A profile with no skills gets no matched skills

- **WHEN** a user whose profile lists no skills but has a current title searches
- **THEN** every scored listing has an empty matched-skills list
- **AND** its missing skills are saved as the model returned them
