## MODIFIED Requirements

### Requirement: Failures are reported without discarding usable results

The system SHALL distinguish a provider failure from an internal failure in what it tells
the user, since the two imply different retry decisions. A failure to score SHALL NOT
discard listings that were successfully discovered: the new jobs SHALL still be saved
without scores and the search SHALL still report success, because the listings remain
useful. A later search that returns those listings again SHALL score them, so repeating
the search recovers a failed scoring rather than leaving the jobs unscored for good.

When the provider answers that it is momentarily unavailable, the system SHALL ask it
again before reporting a provider failure. It SHALL make at most two further requests,
each after a short randomised wait, and all requests together SHALL stay within the
search's existing provider time limit. When the provider answers that its request quota
is used up, the system SHALL NOT ask again, since a retry within seconds cannot succeed
and would spend more of the shared quota. A search that one of these further requests
recovers SHALL behave exactly like a search that succeeded on its first request.

#### Scenario: Provider failure is reported as a provider problem

- **WHEN** the provider returns an error, times out, or is unreachable
- **THEN** the user is told job search is unavailable and to try again
- **AND** the run is recorded as failed with no jobs saved

#### Scenario: A momentary unavailability is recovered by asking again

- **WHEN** the provider answers a search's first request that it is momentarily
  unavailable, and accepts a further request a moment later
- **THEN** the search succeeds and saves and reports its listings as usual
- **AND** it consumes exactly one unit of the user's hourly allowance

#### Scenario: A persistent unavailability still fails cleanly

- **WHEN** the provider answers every request of a search that it is momentarily
  unavailable
- **THEN** no more than three requests are made, all within the provider time limit
- **AND** the user is told job search is unavailable and to try again
- **AND** the run is recorded as failed with no jobs saved, and the attempt does not
  count against the user's hourly allowance

#### Scenario: A used-up quota is not retried

- **WHEN** the provider answers that its request quota is used up
- **THEN** no further request is made for that search
- **AND** the user is told job search is unavailable and to try again

#### Scenario: Missing provider credentials surface as unavailability

- **WHEN** the provider credentials are absent or rejected
- **THEN** the user is told job search is unavailable, without exposing the cause
- **AND** the condition is logged for the operator

#### Scenario: Scoring failure still saves the discovered jobs

- **WHEN** discovery succeeds but scoring fails entirely
- **THEN** every new listing is saved with no score and the search reports success
- **AND** the run is recorded as completed with the jobs saved

#### Scenario: Repeating the search recovers a failed scoring

- **WHEN** a search saved listings without scores, and the user repeats the search and
  scoring now succeeds
- **THEN** those listings gain scores, and no second copy of any of them is saved

#### Scenario: Saving failure is reported as an internal problem

- **WHEN** discovered jobs cannot be saved
- **THEN** the user is told the search could not be completed
- **AND** the run is recorded as failed
