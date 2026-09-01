# Calendar: Meeting Conflicts

## Overview

Calendar warns you when a guest you invited is already busy, and proposes meeting slots that clash with nobody. Both features are served by the availability layer, and both are returning wrong answers. Your task is to repair that layer so a busy guest is reported as busy.

Everything you need to change lives under `backend/src/features/availability/`. No frontend change is required.

---

## What counts as busy

These are the rules the availability layer must enforce.

1. **Overlap is judged across the whole window.** A meeting clashes when it starts before the proposed end and ends after the proposed start. Comparing only the window's start misses a meeting that begins inside it.
2. **Intervals are half-open.** A meeting that ends exactly when the proposed slot begins does not clash, and neither does one that begins exactly when the slot ends.
3. **Not declining means busy.** A guest is busy unless they declined. `needsAction` and `tentative` both still block. A person is also busy for events on a calendar they own, whatever their response.
4. **Per-occurrence replies win.** For a repeating meeting, a reply scoped to one occurrence overrides a reply scoped to the series.
5. **Every occurrence blocks.** A repeating meeting blocks time on each of its occurrences, not only the first.
6. **All-day items split two ways.** An all-day `outOfOffice` blocks the day. Every other all-day item, including `workingLocation`, leaves the person free.
7. **`workingLocation` never blocks**, all-day or not.
8. **Reported blocks are clipped** to the window that was asked about, so a block never extends past it.

---

## API contract

---

### POST /api/v1/availability/conflicts

**Purpose:** Report which of the selected people are busy inside a proposed window, and whether that window sits inside everyone's working hours.

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
- `timeZone`: optional IANA zone, defaults to `UTC`.

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

- `available` is `true` only when `conflicts` is empty.
- Only people with at least one overlapping block appear in `conflicts`.
- Each reported block is clipped to the requested window.
- `workingHoursWarnings` lists people the window falls outside of. It warns, it does not block.

**Error Responses:**
- `400 VALIDATION_ERROR` - criteria failed validation, including `endAt` not after `startAt`.
- `400 INVALID_PERSON_ID` - a participant identifier is malformed.
- `401 AUTH_REQUIRED` - no bearer token.
- `404 PEOPLE_NOT_FOUND` - one or more people no longer exist.

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
- `days`: 1 to 14.
- `durationMinutes`: 15 to 240, in 15-minute increments.

**Success Response (200):** the owner's and each participant's working intervals and clipped busy blocks, plus the suggestions.

```json
{
  "data": {
    "from": "2026-09-07T00:00:00.000Z",
    "to": "2026-09-10T00:00:00.000Z",
    "durationMinutes": 30,
    "timeZone": "UTC",
    "owner": { "name": "Alex Morgan", "timeZone": "UTC", "workingHours": { "startMinute": 540, "endMinute": 1050 }, "workingIntervals": [], "busy": [] },
    "participants": [{ "person": {}, "workingIntervals": [], "busy": [] }],
    "suggestions": [
      { "startAt": "2026-09-07T09:00:00.000Z", "endAt": "2026-09-07T09:30:00.000Z", "attendeeCount": 2 }
    ]
  }
}
```

A suggestion is only offered when **all** of these hold:

1. The slot clashes with nothing on the **organizer's** own calendars.
2. The slot clashes with nothing for any selected guest.
3. The slot sits inside the organizer's working hours **and** every guest's working hours.
4. The slot has not already passed.

Further rules:

- At most twelve suggestions, in chronological order.
- Candidate starts step every 30 minutes.
- Weekends are skipped.
- `attendeeCount` includes the organizer.
- No free slot is a `200` with an empty `suggestions` array, not an error.

**Error Responses:**
- `400 VALIDATION_ERROR` - criteria failed validation.
- `400 INVALID_PERSON_ID` - a participant identifier is malformed.
- `401 AUTH_REQUIRED` - no bearer token.
- `401 PROFILE_REQUIRED` - a workspace token that has not selected a profile.
- `404 PEOPLE_NOT_FOUND` - one or more people no longer exist.

---

## Additional information

1. Busy titles are private to these two endpoints. `GET /api/v1/people` never returns `busyBlocks`.
2. Calendar-day iteration is time-zone aware rather than a fixed 24-hour step, so local working hours stay correct across daylight-saving transitions.
3. The editor debounces the conflict check while values change, and repeats it immediately before save. A conflict warns but never blocks an intentional save.
4. Your solution must pass every test in `backend/__tests__/task1/`.
