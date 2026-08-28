# Meet With and Suggested Times

## Product flow

1. The sidebar directory field requests `GET /api/v1/people?q=&limit=20` after a short input delay.
2. Results can be selected by pointer, Tab, or Arrow keys plus Enter. Selected people are unique and removable.
3. Every selection immediately switches the main surface to Day comparison mode and requests one day of availability.
4. Comparison renders You and every selected person in equal-width schedule columns. Additional columns increase the surface width and use one shared horizontal scrollbar and vertical time axis.
5. Busy blocks retain attendee colors without decorative non-working-hour hatching. Clicking an open comparison slot opens the Event editor on a 15-minute boundary with every selected participant prefilled.
6. Suggested times opens a right-side modal drawer with the current calendar date and a 30-minute default duration.
7. The drawer requests `POST /api/v1/availability/suggestions` whenever its date, duration, or selected people change.
8. Selecting a free slot opens the standard Event editor with participant names and the returned UTC interval prefilled.
9. The user reviews and explicitly saves through the existing event endpoint. No invitations or external messages are sent. After save, the open comparison refreshes and shows the new owner busy block.

## Directory API

`GET /api/v1/people?q=<text>&limit=<1-50>`

- `q` is optional, trimmed, case-insensitive, limited to 100 characters, and matched literally against name and email.
- Empty `q` returns the directory ordered by name and email.
- Busy blocks are excluded from this response.

## Suggestion API

`POST /api/v1/availability/suggestions`

```json
{
  "participantIds": ["personObjectId"],
  "from": "2026-08-27",
  "timeZone": "Asia/Kolkata",
  "days": 5,
  "durationMinutes": 30
}
```

Constraints:

- 1–10 unique, valid, existing people.
- 1–14 search days.
- 15–240-minute duration in 15-minute increments.
- `from` is a local `YYYY-MM-DD` calendar date and `timeZone` is a valid IANA timezone.
- The frontend offers the curated 30, 45, 60, 90, and 120-minute options.

The response contains the clipped owner and participant busy blocks plus at most twelve chronological suggestions. Every suggestion uses a half-open interval and includes the owner in `attendeeCount`.

Calendar-day iteration is timezone-aware rather than a fixed 24-hour increment, so local working hours remain stable through daylight-saving transitions.

## Conflict API

`POST /api/v1/availability/conflicts` accepts 1–100 unique `participantIds` and a proposed UTC `startAt`/`endAt` interval. It returns `available` plus only the people and clipped busy blocks that overlap the half-open interval. The editor debounces this check while values change and repeats it immediately before save; conflicts warn but do not block an intentional save.

## Availability rules

- Owner hours are 9:00 AM–5:30 PM local time.
- Each person has a persisted local working-hours window.
- Candidate hours use the intersection of every attendee’s window.
- Candidate starts use 30-minute increments.
- Weekends and elapsed intervals are skipped.
- Owner events of every blocking item type are considered across all calendars, regardless of UI visibility.
- Working locations and non-blocking all-day metadata do not consume availability; all-day Out of office does.
- Participant busy titles are used only in the private availability response and are never returned from directory search.

## Failure and concurrency behavior

- Invalid criteria return `VALIDATION_ERROR`.
- Malformed IDs return `INVALID_PERSON_ID`.
- Missing people return `PEOPLE_NOT_FOUND`.
- No valid free slot returns a successful response with an empty `suggestions` array.
- UI requests are sequence-protected so stale search or availability responses cannot replace newer criteria.
- Failed requests retain every selected person and filter value and expose a retry action.
- Removing the last selected person restores the ordinary Day view; switching to Week or Month exits comparison mode.
