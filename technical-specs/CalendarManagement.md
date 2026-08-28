# Calendar: Calendar Management

## API contract

- `GET /api/v1/calendars` returns primary-first calendars.
- `POST /api/v1/calendars` creates a visible secondary calendar with a unique case-insensitive name, hex color, optional description, and valid IANA time zone. Description defaults to an empty string and time zone defaults to `UTC` for backward compatibility.
- `POST /api/v1/calendars/:calendarId/display-only` makes the target visible, hides every other calendar, and returns the complete primary-first calendar list.
- `PATCH /api/v1/calendars/:calendarId` updates name, description, time zone, color, or visibility.
- `DELETE /api/v1/calendars/:calendarId` deletes an empty secondary calendar.

The primary calendar cannot be deleted (`409 PRIMARY_CALENDAR`). A secondary calendar with events cannot be deleted (`409 CALENDAR_NOT_EMPTY`) and includes `eventCount` in error details. Duplicate names return `409 CALENDAR_NAME_CONFLICT`.

Visibility is persisted on the calendar and is applied consistently to range queries and search by sending only visible calendar identifiers.

## Testing identifiers

| `data-testid` | Purpose |
| --- | --- |
| `calendar-toggle-{calendarId}` | Show or hide a calendar. |
| `calendar-name-input` | Enter the new calendar name. |
| `create-calendar-submit` | Submit calendar creation. |

The per-calendar overflow menu exposes Display this only, Settings and sharing, 24 accessible named color presets, and a custom color input. It closes on successful actions, outside pointer interaction, or `Escape`; failed operations remain open with an inline error.

## Data safety

Calendar deletion never cascades to events. Users must move or delete events explicitly before deleting the calendar. A case-insensitive database unique index and service-level conflict translation protect against concurrent duplicate-name writes.
