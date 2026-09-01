# Time Insights technical specification

## Contract

`GET /api/v1/insights/daily?from=<ISO>&to=<ISO>&calendarIds=<comma-separated ObjectIds>` returns a server-computed insight snapshot for the half-open interval `[from, to)`. The frontend sends local-day boundaries as ISO instants, keeping timezone conversion at the browser edge.

The response includes the planning-day capacity, total scheduled minutes, meeting minutes and count, trailing seven-day average meeting minutes, remaining minutes, fixed type categories, and populated calendar breakdowns. Invalid ranges or identifiers return the standard `VALIDATION_ERROR` envelope.

## Aggregation rules

- Events are included when they overlap the requested interval and belong to a requested visible calendar.
- Timed durations are clipped to interval boundaries.
- `event` and `appointmentSchedule` contribute to Meetings.
- `focusTime`, `task`, and `outOfOffice` contribute to independent categories.
- All-day Out of office contributes 480 minutes; Working location and other all-day metadata contribute zero.
- Remaining time is never negative and uses an eight-hour, 480-minute planning day.
- The meeting average uses the selected day and preceding six days, including zero-meeting days.

## Frontend behavior

The sidebar refreshes the endpoint on date changes, visible-calendar changes, and successful event mutations. The detail drawer uses the same snapshot for type and calendar views, renders a CSS conic-gradient chart without a charting dependency, supports Escape and scrim dismissal, and opens typed Focus time creation from its action.

## Verification

Backend integration tests cover category math, calendar breakdowns, ignored working locations, range validation, and identifier validation. Frontend behavioral tests cover summary formatting, drawer grouping, focus-time action, and Google-style day-event width.

## Testing identifiers

| `data-testid` | Purpose |
| --- | --- |
| `more-insights` | Open the Time Insights drawer. |
| `schedule-focus-time` | Create focus time from the drawer. |
