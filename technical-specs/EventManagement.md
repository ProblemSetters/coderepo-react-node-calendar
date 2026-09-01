# Calendar: Event Management

## Editor interaction

- The title is followed by tabs for Event, Task, Out of office, Focus time, Working location, and Appointment schedule. Switching tabs updates the persisted `type` and applies that type's title/all-day defaults without overwriting a custom title.
- Dates use an in-app month picker. Same-day events show one date control. When the end time rolls into another day, a separate editable end date appears immediately; it disappears again when the range returns to the start day. All-day items use the same conditional range rule.
- Start time exposes all 96 quarter-hour choices in a keyboard-accessible listbox. End time exposes every 15-minute duration across the next 24 hours, calculated from the current start and labeled with its duration, including midnight rollover. Both inputs accept valid custom minutes in 12-hour or 24-hour notation and normalize to a compact lowercase 12-hour display on blur.
- Same-day editing shows one clean row containing the date followed by the start/end time range. The end date appears only when the event crosses into another day.
- Moving the start preserves the current duration. Invalid text, an empty title, a missing calendar, or a non-positive range disables Save and exposes an inline range error.
- Guests use the shared, debounced people-directory listbox used by Meet with. It supports name/email search, loading/empty/error and retry states, arrow-key selection, duplicate filtering, removable chips, and prefilled legacy participant names. Saved events send canonical names in `participants` and directory references in `participantIds`; responses expose `participantPeople` to preserve identity when directory and name-only guests are mixed.
- Invited profiles see a Google-style Going? control in the read-only preview. `accepted`, `tentative`, and `declined` map to Yes, Maybe, and No; `needsAction` maps to Awaiting response. Organizer previews show a response summary and per-directory-guest status.
- Repeat offers Does not repeat, Daily, Weekly on the selected weekday, Monthly on the ordinal weekday, Annually on the selected date, Every weekday, and Custom. Custom recurrence supports intervals, weekly day sets, monthly day/ordinal modes, and never/date/count endings in an IANA time zone. Occurrences preserve their local wall time across DST.
- Pending/tentative invitations are unfilled and outlined, accepted invitations are filled, and declined invitations are outlined and struck through. Declined occurrences are excluded from only that attendee's busy schedule. Schedule or recurrence changes reset responses; guest-list-only edits preserve retained responses and initialize new guests as pending.

## API contract

### `GET /api/v1/events`

Requires `from` and `to` ISO datetimes. Optional comma-separated `calendarIds` filters visible calendars. Returns overlapping events ordered by start and title.

### `GET /api/v1/events/search`

Accepts any non-empty combination of `what`, `who`, `where`, `exclude`, `from`, `to`, and comma-separated `calendarIds`. `what` searches title, description, location, and participants; `who` searches organizer and participants; `where` searches location; and `exclude` rejects matches across searchable event text. The frontend converts inclusive local date selections into an ISO half-open interval `[from, to)`; `from` must precede `to`. The legacy `q` parameter maps to `what`. Results are limited to 100 chronological events.

The frontend opens search in a compact field-first state. Enter submits the field as `what`; the trailing dropdown explicitly reveals scope, contained/excluded keywords, participant, location, and date filters. Escape collapses an expanded filter panel before dismissing compact search, preserving the user’s query and calendar context.

### `GET /api/v1/events/:eventId`

Returns full event details or `404 EVENT_NOT_FOUND`.

### `POST /api/v1/events`

Requires `calendarId`, `title`, `startAt`, and `endAt`. Supports `type`, `description`, `location`, `organizer`, `participants`, `participantIds`, `allDay`, and a nullable color override. Directory identifiers are validated and canonical names are stored before the event is returned. `type` is one of `event`, `task`, `outOfOffice`, `focusTime`, `workingLocation`, or `appointmentSchedule`. Returns `201`; invalid chronology returns `400 INVALID_EVENT_RANGE`, an unknown person returns `404 PEOPLE_NOT_FOUND`, and an unknown calendar returns `422 INVALID_CALENDAR`.

### `PATCH /api/v1/events/:eventId`

Accepts a non-empty partial event. Validation applies to the merged persisted event. Omitted fields are never reset.

### `PATCH /api/v1/events/:eventId/response`

Requires an authenticated profile-scoped bearer JWT and a strict body `{ "status": "accepted" | "tentative" | "declined", "scope"?: "this" | "following" | "all", "occurrenceStartAt"?: ISO datetime }`. Recurring RSVP opens a scope dialog; occurrence time is required for `this` and `following`. An exact-instance override wins over the newest applicable following override, which wins over the series default. An `all` response atomically updates the default and clears that attendee's overrides. Only a person currently present in `participantIds` may respond. Missing authentication returns `401 AUTH_REQUIRED`, a workspace session without an active profile returns `401 PROFILE_REQUIRED`, a non-attendee returns `403 NOT_EVENT_ATTENDEE`, and an event changed during the write returns `409 INVITATION_CHANGED`.

### `DELETE /api/v1/events/:eventId`

Returns `204` or `404 EVENT_NOT_FOUND`.

## Testing identifiers

| `data-testid` | Purpose |
| --- | --- |
| `create-event-button` | Open the Create menu. |
| `event-title-input` | Enter the event title. |
| `repeat-select` | Open the repeat options. |
| `save-event-button` | Save the event. |
| `people-search-input` | Search the guest directory. |
| `person-option-{personId}` | Select a guest from the results. |
| `remove-person-{personId}` | Remove a selected guest. |
| `preview-edit` | Open the editor from the event preview. |
| `preview-delete` | Delete from the event preview. |
| `preview-close` | Close the event preview. |
| `rsvp-{accepted\|tentative\|declined}` | Answer an invitation. |

## Validation

Title is 1–140 trimmed characters; description is at most 2,000; location is at most 250; end is strictly after start; referenced calendar and identifiers must be valid. Event list windows are capped at 370 days. Recurrence intervals are 1–99, counts are 1–730, weekly rules require a day, zones must be valid IANA zones, and an until date cannot precede the series. Attendee response records are unique by person and accept only `needsAction`, `accepted`, `tentative`, or `declined`.
