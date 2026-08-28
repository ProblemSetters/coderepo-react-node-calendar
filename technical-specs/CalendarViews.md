# Calendar: Calendar Views

## Overview

The frontend exposes Day, Week, and Month views over one event contract. All date calculations use the browser's local timezone; API boundaries use UTC ISO datetimes. The user's view selection and sidebar state are device-local preferences.

## Behavior

- Day and Week render all-day events separately and position timed events on a 24-hour axis. The header uses an 80px local-GMT gutter, date badge, and persisted Working location chip; working-location items do not duplicate in the all-day row.
- Overlapping events are assigned collision columns by `event-layout.js`, then drawn with staggered left offsets and increasing z-order so later events layer over earlier events without hiding either event’s title and time.
- Month renders six complete weeks and limits each cell to three event rows before showing a more-events action.
- All rendered clock labels explicitly use a 12-hour AM/PM format.
- Today, Previous, Next, and the mini-calendar update the cursor without modifying calendar visibility.
- Day headings use the stable `Month D, YYYY` order so browser locale does not alter the Google Calendar-style header.

## Testing identifiers

| `data-testid` | Purpose |
| --- | --- |
| `today-button` | Return the cursor to today. |
| `view-select` | Open the Day, Week, or Month view menu. |
| `calendar-day-{YYYY-MM-DD}` | Stable date cell identifier where applicable. |

## Edge cases

Month/year boundaries, leap years, overlapping events, no visible calendars, empty periods, and API failure must retain a coherent shell and explicit state.
