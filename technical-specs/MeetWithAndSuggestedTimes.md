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
9. The user reviews and explicitly saves through the existing event endpoint. Selected local-directory guests receive an in-app pending invitation and can answer through the RSVP endpoint; no email or external message is sent. After save, the open comparison refreshes and shows the new owner busy block.

## API contract

---

### GET /api/v1/people

**Purpose:** Search the people directory by name or email.

**Auth:** Required. A profile-scoped bearer token.

**Query Parameters:**
- `q`: optional, trimmed, case-insensitive, up to 100 characters, matched **literally** against name and email so regex characters are not treated as patterns. Empty returns the directory ordered by name then email.
- `limit`: optional, 1 to 50, defaults to 20.

**Success Response (200):**
```json
{
  "data": [
    {
      "_id": "6a962265089578efdcee297a",
      "name": "Jordan Smith",
      "email": "jordan.smith@calendar.com",
      "avatarColor": "#b85c00",
      "isProfile": true,
      "timeZone": "UTC",
      "workingHours": { "startMinute": 540, "endMinute": 1020 }
    }
  ]
}
```

- `busyBlocks` is never returned here. Busy titles are private to the availability endpoints.
- The signed-in profile is excluded from its own results.

**Error Responses:**
- `400 VALIDATION_ERROR` - `limit` out of range.
- `401 AUTH_REQUIRED` - no bearer token.

---

### POST /api/v1/availability/suggestions

**Purpose:** Propose meeting slots that clash with neither the organizer nor any selected guest.

**Auth:** Required. A profile-scoped bearer token.

**Request Body:**
```json
{
  "participantIds": ["6a962265089578efdcee297a"],
  "from": "2026-09-07",
  "timeZone": "UTC",
  "days": 3,
  "durationMinutes": 30
}
```

- `participantIds`: 1 to 10 unique, existing people.
- `from`: a local `YYYY-MM-DD` calendar date.
- `timeZone`: a valid IANA time zone.
- `days`: 1 to 14.
- `durationMinutes`: 15 to 240, in 15-minute increments. The editor offers 30, 45, 60, 90, and 120.

**Success Response (200):**
```json
{
  "data": {
    "from": "2026-09-07T00:00:00.000Z",
    "to": "2026-09-10T00:00:00.000Z",
    "durationMinutes": 30,
    "timeZone": "UTC",
    "owner": {
      "name": "Alex Morgan",
      "timeZone": "UTC",
      "workingHours": { "startMinute": 540, "endMinute": 1050 },
      "workingIntervals": [
        { "startAt": "2026-09-07T09:00:00.000Z", "endAt": "2026-09-07T17:30:00.000Z" }
      ],
      "busy": [
        {
          "_id": "6a962266089578efdcee29f4",
          "title": "Team roadmap",
          "calendarId": "6a962265089578efdcee2987",
          "type": "event",
          "startAt": "2026-09-07T14:00:00.000Z",
          "endAt": "2026-09-07T15:00:00.000Z"
        }
      ]
    },
    "participants": [
      {
        "person": {
          "_id": "6a962265089578efdcee297a",
          "name": "Jordan Smith",
          "email": "jordan.smith@calendar.com",
          "avatarColor": "#b85c00",
          "workingHours": { "startMinute": 540, "endMinute": 1020 },
          "timeZone": "UTC"
        },
        "workingIntervals": [
          { "startAt": "2026-09-07T09:00:00.000Z", "endAt": "2026-09-07T17:00:00.000Z" }
        ],
        "busy": []
      }
    ],
    "suggestions": [
      { "startAt": "2026-09-07T09:00:00.000Z", "endAt": "2026-09-07T09:30:00.000Z", "attendeeCount": 2 }
    ]
  }
}
```

- At most twelve suggestions, in chronological order.
- Every interval is half-open, so a slot ending exactly when a meeting starts does not clash.
- `attendeeCount` includes the owner.
- No free slot is a `200` with an empty `suggestions` array, not an error.

**Error Responses:**
- `400 VALIDATION_ERROR` - the criteria failed validation.
- `400 INVALID_PERSON_ID` - a participant identifier is malformed.
- `401 AUTH_REQUIRED` - no bearer token.
- `401 PROFILE_REQUIRED` - a workspace token with no active profile.
- `404 PEOPLE_NOT_FOUND` - one or more people no longer exist.

---

### POST /api/v1/availability/conflicts

**Purpose:** Report which guests are busy inside a proposed window, and whether that window sits within everyone's working hours.

**Auth:** Required. A profile-scoped bearer token.

**Request Body:**
```json
{
  "participantIds": ["6a962265089578efdcee297a"],
  "startAt": "2026-09-07T13:30:00.000Z",
  "endAt": "2026-09-07T15:00:00.000Z",
  "timeZone": "UTC"
}
```

- `participantIds`: 1 to 100 unique, existing people.
- `startAt` and `endAt`: UTC ISO datetimes, `startAt` strictly before `endAt`.
- `timeZone`: optional, defaults to `UTC`.

**Success Response (200):**
```json
{
  "data": {
    "startAt": "2026-09-07T13:30:00.000Z",
    "endAt": "2026-09-07T15:00:00.000Z",
    "available": false,
    "withinWorkingHours": true,
    "conflicts": [
      {
        "person": {
          "_id": "6a962265089578efdcee297a",
          "name": "Jordan Smith",
          "email": "jordan.smith@calendar.com",
          "avatarColor": "#b85c00",
          "workingHours": { "startMinute": 540, "endMinute": 1020 },
          "timeZone": "UTC"
        },
        "busy": [
          {
            "_id": "6a962266089578efdcee29f4",
            "title": "Team roadmap",
            "startAt": "2026-09-07T14:00:00.000Z",
            "endAt": "2026-09-07T15:00:00.000Z"
          }
        ]
      }
    ],
    "workingHoursWarnings": []
  }
}
```

- Only people with at least one overlapping block appear in `conflicts`.
- Each reported block is clipped to the requested window.
- `workingHoursWarnings` lists people the window falls outside of, and warns without blocking.

**Error Responses:**
- `400 VALIDATION_ERROR` - the criteria failed validation, including `endAt` not after `startAt`.
- `400 INVALID_PERSON_ID` - a participant identifier is malformed.
- `401 AUTH_REQUIRED` - no bearer token.
- `404 PEOPLE_NOT_FOUND` - one or more people no longer exist.

---

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

## Testing identifiers

| `data-testid` | Purpose |
| --- | --- |
| `people-search-input` | Search the people directory in the sidebar. |
| `people-option-{personId}` | Select a person from the results. |
| `people-remove-{personId}` | Remove a selected person. |
| `working-window-owner` | The owner's working-hours band in the comparison column. |
| `working-window-{personId}` | A selected person's working-hours band. |
| `suggested-time-{startAtIso}` | Choose a suggested slot. |
