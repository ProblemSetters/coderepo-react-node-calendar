# Calendar: Event Management

## Editor interaction

- The title is followed by tabs for Event, Task, Out of office, Focus time, Working location, and Appointment schedule. Switching tabs updates the persisted `type` and applies that type's title/all-day defaults without overwriting a custom title.
- Dates use an in-app month picker. Same-day events show one date control. When the end time rolls into another day, a separate editable end date appears immediately; it disappears again when the range returns to the start day. All-day items use the same conditional range rule.
- Start time exposes all 96 quarter-hour choices in a keyboard-accessible listbox. End time exposes every 15-minute duration across the next 24 hours, calculated from the current start and labeled with its duration, including midnight rollover. Both inputs accept valid custom minutes in 12-hour or 24-hour notation and normalize to a compact lowercase 12-hour display on blur.
- Same-day editing shows one clean row containing the date followed by the start/end time range. The end date appears only when the event crosses into another day.
- Moving the start preserves the current duration. Invalid text, an empty title, a missing calendar, or a non-positive range disables Save and exposes an inline range error.
- Guests use the shared, debounced people-directory listbox used by Meet with. It supports name/email search, loading/empty/error and retry states, arrow-key selection, duplicate filtering, removable chips, and prefilled legacy participant names. Saved events send canonical names in `participants` and directory references in `participantIds`; responses expose `participantPeople` to preserve identity when directory and name-only guests are mixed.

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

### `DELETE /api/v1/events/:eventId`

Returns `204` or `404 EVENT_NOT_FOUND`.

## Testing identifiers

| `data-testid` | Purpose |
| --- | --- |
| `create-event-button` | Open event creation. |
| `event-title-input` | Enter or edit the event title. |
| `save-event-button` | Persist a valid event. |

## Validation

Title is 1–140 trimmed characters; description is at most 2,000; location is at most 250; end is strictly after start; referenced calendar and identifiers must be valid.
