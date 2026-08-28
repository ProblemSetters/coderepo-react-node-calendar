# Calendar Product Requirements Document

| Document field | Value |
| --- | --- |
| Product | Calendar |
| Version | 1.0 draft |
| Product type | Desktop-first personal calendar web application |
| Initial stack | React, Node.js, Express, MongoDB |
| Future backend variants | Django and Spring Boot |
| Status | Approved baseline in active implementation |

## 1. Executive summary

Calendar is a personal scheduling application based on the interaction model users already understand from Google Calendar. It will provide the most familiar calendar workflows—viewing time, navigating dates, finding events, organizing multiple calendars, and creating and maintaining events—without attempting to reproduce Google Workspace collaboration or configuration depth.

The product must not feel like a sample or toy. Its visible interface must be complete, coherent, responsive, and backed by working behavior. Controls for unsupported functionality will not be displayed.

The first deliverable is a complete and tested React/Node solution. Candidate-task design and backend conversions are separate later activities and are not part of this product scope.

## 2. Problem statement

Users need a fast way to understand how their time is allocated and maintain upcoming commitments. A useful calendar must answer four questions immediately:

1. What is scheduled now and next?
2. What is scheduled on a particular date or across a period?
3. How can I add or change a commitment without losing context?
4. How can I separate personal and work schedules while viewing them together?

An incomplete clone that only draws a grid or stores a title does not solve this problem. Navigation, display, filtering, search, event management, persistence, validation, and feedback must work as a unified experience.

## 3. Product principles

### Familiar

Layout and interactions should follow established desktop calendar conventions. Users should not need instructions for Today, previous/next, view selection, mini-calendar navigation, calendar toggles, or event creation.

### Honest

Every interactive-looking control must work. Unsupported Google Calendar features must be omitted rather than represented by placeholders.

### Fast

Navigation and local interactions should feel immediate. Network refreshes must preserve the existing view until replacement data arrives.

### Dependable

Invalid input must never corrupt persisted events. Failed operations must provide a useful message and retain the user’s entered data.

## 4. Target user

The v1 user is a candidate using Calendar on a desktop or laptop. One authenticated assessment workspace exposes a small allow-listed set of seeded profiles so organizer, attendee, RSVP, conflict, and availability scenarios can be exercised without repeatedly entering separate credentials.

Typical needs include planning a work week, recording appointments, separating personal and work events, locating a past or future event, and checking an upcoming agenda.

## 5. Product goals

- Make the current day and upcoming commitments understandable within five seconds of opening the application.
- Support complete event creation, viewing, editing, and deletion.
- Support Day, Week, and Month views using the same underlying event data.
- Support Event, Task, Out of office, Focus time, Working location, and Appointment schedule item types.
- Support multiple user-created calendars with reliable show/hide behavior.
- Support useful event search across title, description, and location.
- Preserve all persisted changes across browser refreshes.
- Establish one stable frontend experience and API contract for later backend conversions.

## 6. Non-goals for version 1

- Production identity administration, account recovery, MFA, SSO, and cross-organization authorization. The assessment workspace does use password verification and signed, expiring sessions.
- Invitation email delivery, external contact-directory/calendar synchronization, RSVP comments, or proposed-new-time workflows.
- Calendar sharing, permissions, public calendars, or subscriptions.
- Per-instance edit/delete exceptions within recurring series.
- Google Meet or other conferencing integrations.
- Reminders and task completion workflows.
- Drag-and-drop or resize-to-change-time interactions.
- Attachments, notifications, offline sync, import/export, and print.
- Year view, four-day custom view, world clock, secondary time zones, or full settings pages.

## 7. Scope and priority

| Priority | Capability | Reason |
| --- | --- | --- |
| P0 | Application shell and responsive layout | Establishes the complete calendar workspace. |
| P0 | Today and date-range navigation | Core calendar orientation. |
| P0 | Mini-calendar date navigation | Familiar direct-date selection. |
| P0 | Day, Week, and Month views | Covers immediate, weekly, and monthly planning. |
| P0 | Typed calendar items | Provides the six creation workflows required by the Google Calendar-style Create menu. |
| P0 | Event create, view, edit, and delete | Core scheduling lifecycle. |
| P0 | Timed and all-day events | Required for common appointments and date-level commitments. |
| P0 | Multiple calendars and visibility filtering | Required schedule organization. |
| P0 | Persistent database state and deterministic seed | Required for a credible full-stack product. |
| P1 | Event search | Makes a populated calendar useful. |
| P1 | Calendar create, rename, recolor, and delete | Completes calendar organization. |
| P1 | Keyboard shortcuts | Improves desktop usability after core flows are stable. |
| P1 | Time Insights | Makes the day’s allocation understandable at a glance. |
| P1 | Meet with people and suggested times | Finds conflict-free meeting times across local participant schedules. |

P0 and P1 are both included in the solution baseline. Priority controls implementation order, not final inclusion.

## 8. Information architecture

### Top application bar

- Menu button to collapse or expand the left sidebar.
- Calendar identity.
- Today button.
- Previous and next date-range controls.
- Current date or date-range heading.
- Search button and search field state.
- View menu containing only Day, Week, and Month with keyboard hints.

- Compact active-profile menu with Switch profile and Sign out actions.

No Settings, Help, or application launcher controls are shown because their corresponding workflows are excluded.

### Left sidebar

- Primary Create button.
- Mini-calendar with month navigation and selected/today indicators.
- “Meet with…” people search, selected-attendee chips, and Suggested times action.
- “My calendars” list with visibility checkboxes, color markers, and contextual management actions.
- Add-calendar action.

### Main content

- Active calendar view.
- Loading, empty, error, and search-result states.
- Current-time indicator in Day and Week views.
- Event preview and event editor overlays.

## 9. Detailed feature requirements

### F1. Application startup

On successful startup, Calendar opens the persisted preferred view centered on today. The sidebar and calendar definitions load before event rendering. Seed data must place events near the actual current date so the first screen is meaningful regardless of when the repository is run.

If the API is unavailable, the shell remains visible and shows a retryable service error. It must not show an empty calendar that could be mistaken for valid data.

**Acceptance criteria**

- Refreshing the browser preserves persisted calendars and events.
- The selected view and sidebar state persist in local browser preferences.
- Initial loading uses a visible progress state without layout collapse.
- API failure shows a retry action and no false success state.

### F2. Today and period navigation

Today centres the active view on the current local date. Previous and Next move exactly one unit of the active view: one day, one week, or one month. The heading always describes the displayed period.

**Acceptance criteria**

- Date transitions handle month/year boundaries and leap years.
- Today works from every view.
- Navigation retains calendar visibility and search-independent preferences.
- Current day has a consistent visual highlight.

### F3. Mini-calendar

The mini-calendar displays one month, Monday-to-Sunday weekday headings, overflow dates required to complete its weeks, previous/next month controls, today, and the selected date.

Selecting a date updates the main view without changing its type. Month navigation in the mini-calendar alone does not change the main view until a date is selected.

**Acceptance criteria**

- Selecting a date navigates Day to that day, Week to its week, and Month to its month.
- Today and selected date remain visually distinguishable.
- Keyboard users can navigate and select dates.

### F4. Day view

Day view uses a rounded white calendar surface over the light application shell. Its header contains an 80-pixel local GMT-offset gutter, a left-aligned weekday/date badge, and the day’s persisted Working location chip. Working location opens its item preview and does not duplicate in the all-day row. The app header uses the stable `Month D, YYYY` date order. Below it, Day contains an all-day row and a 24-hour time grid. Timed events are positioned according to their local start/end times. Concurrent events use layered, staggered cards with increasing z-order so the collision remains visible and every event can be selected. A current-time line appears when today is displayed.

Selecting an empty time opens event creation prefilled with that date and time. Selecting an event opens its preview.

### F5. Week view

Week view contains seven columns, an all-day row, a shared 24-hour axis, overlap handling, and the current-time line. It follows the same event placement and selection rules as Day view.

### F6. Month view

Month view renders complete calendar weeks containing the active month. Each cell shows its date, all-day events, and compact timed-event rows in chronological order. Overflow is represented by a “N more” action that opens that date’s event list.

Selecting empty cell space creates an event for that date. Selecting the date number switches to Day view for that date.

### F7. Calendar item types

Create opens an anchored menu containing Event, Task, Out of office, Focus time, Working location, and Appointment schedule. Every option opens the editor with appropriate title and all-day defaults and persists its type through create, edit, list, search, and preview flows.

The calendar visually distinguishes tasks, out-of-office blocks, focus time, and working locations while retaining the selected calendar color.

### F8. Event creation

Users can start creation from a typed Create-menu option, an empty Day/Week time slot, or a Month date. Creation opens a modal with:

- Title, required.
- Calendar-item type tabs.
- Start date and time.
- End date and time.
- All-day toggle.
- Calendar selection.
- Location, optional.
- Guests, optional, selected from the people directory by name or email.
- Description, optional.
- Event color, optional override.
- Save and Cancel.

Create defaults to the selected date. Dates use an in-app month picker. Time fields offer 15-minute choices, accept valid custom minutes in 12-hour or 24-hour notation, and normalize to 12-hour display. Changing the start preserves the current duration. A grid-originated creation uses the selected time and a one-hour duration. Create-button creation uses the next available half-hour and a one-hour duration.

Guest selection reuses the Meet-with directory picker. Search results show names and email addresses, support keyboard navigation, filter already-selected people, and become removable attendee chips. Event persistence stores directory identities in `participantIds` and canonical names in `participants`; responses also provide `participantPeople` so directory guests and legacy name-only guests cannot be misaligned when an event is reopened.

**Validation**

- Title is required after trimming and limited to 140 characters.
- End must be later than start.
- Calendar must exist.
- Description is limited to 2,000 characters.
- Location is limited to 250 characters.
- All-day events use date boundaries and appear in all-day areas.

**Acceptance criteria**

- Save stays disabled while a required field is invalid or a save is active.
- API errors appear in the modal and preserve input.
- Successful creation closes the modal and displays the event without browser refresh.
- Cancel or Escape discards unsaved input after confirmation when changes exist.

### F8A. Invitation responses

Every directory guest begins with an Awaiting response state. An invited profile can open the organizer-owned event and answer **Yes**, **Maybe**, or **No** without receiving Edit/Delete access. The preview updates in place, and the organizer sees aggregate counts plus each guest’s current response.

Responses use the durable values `needsAction`, `accepted`, `tentative`, and `declined`. Retained guests keep their response when the guest list changes, newly added guests start pending, and a date/time/all-day change resets all invited guests to pending. Pending and tentative invitations are outlined, accepted invitations are filled, and declined invitations remain outlined and struck through without blocking that attendee’s availability.

### F8B. Recurring events

Events can repeat daily, weekly, monthly, annually, every weekday, or through a custom interval/day/ending rule. Calendar reads expand one durable series record into stable occurrence identities while preserving local wall time across daylight-saving transitions. Recurring RSVP requires an explicit scope—this event, this and following events, or all events—and applies exact-instance, following, and series responses in that precedence order.

Pending/tentative invitations are white with a calendar-colored outline, accepted invitations use a filled calendar color, and declined invitations are outlined and struck through. Search, insights, guest conflicts, and suggested-time busy calculations consume the same generated occurrences and response resolution.

**Acceptance criteria**

- Only a currently invited profile may respond; organizer and non-attendee attempts fail without changing the event.
- Each response records a server timestamp, can be changed later, and survives refresh/profile switching.
- Invalid statuses and malformed event IDs use the standard API error envelope.
- Failed responses leave the preview open, preserve the last saved answer, and show one contextual error.
- The controls are keyboard-accessible, expose pressed state, and remain usable at phone widths.

### F9. Event preview, editing, and deletion

Selecting an event opens a compact preview showing title, date/time, calendar, location, description, and Edit/Delete actions. Edit opens the full event form. Delete requires explicit confirmation containing the event title.

**Acceptance criteria**

- Edit uses the same validation rules as creation.
- Successful changes update every view immediately.
- Failed changes preserve the previous persisted event and editor input.
- Successful deletion removes the event from every view and search result.
- Cancelled deletion makes no change.

### F10. Calendar visibility

Each calendar has a checkbox and color marker. Disabling it removes its items from Day, Week, Month, and search results. Visibility is a persisted calendar preference and survives navigation, view changes, and browser refreshes.

At least one calendar may be visible, but showing none is allowed and produces an explanatory empty state.

### F11. Calendar management

Users create secondary calendars in a focused dialog with a required unique name, optional description, IANA time zone, and accessible color palette. The submit action is disabled until the name is valid, exposes an in-progress state, preserves all entered values after an API failure, and adds a successful calendar to the visible sidebar immediately. A secondary calendar can be renamed, recolored, or deleted. The seeded primary calendar can be renamed/recolored but cannot be deleted.

Calendar names are unique without regard to letter case. The API enforces field limits and time-zone validity, and persistence includes a case-insensitive unique index to prevent concurrent duplicate creation.

Each calendar’s overflow button opens an anchored menu with Display this only, Settings and sharing, 24 named preset colors, and a custom color picker. Display this only persists one bulk visibility change and immediately refreshes the event view. Preset and custom colors persist immediately. Settings and sharing reuses the full calendar editor with existing values prefilled.

Deleting a secondary calendar containing events is blocked with a count and instructions to delete or move those events first. This prevents silent data loss.

### F12. Search

Opening search replaces the period controls with a focused Search header and a compact Google Calendar-style search field over the current calendar. Advanced filters remain hidden until the trailing dropdown control is selected. Users can submit a quick keyword search directly with Enter, or expand the panel to search active or all calendars and combine contained keywords, participant/organizer, location, excluded keywords, and inclusive from/to dates. Text matching is case-insensitive. Results are ordered by start time and grouped into Past and Upcoming.

Selecting a result opens its event preview. Modify search reopens the panel with every submitted criterion preserved. Reset clears the panel. Closing search returns to the previous view and date without losing context.

**Acceptance criteria**

- Search runs only when submitted and accepts any non-empty combination of advanced filters.
- Loading, no-results, and failure states are distinct.
- Active-calendar scope excludes hidden-calendar events; all-calendar scope searches every calendar.
- Search parameters are safely encoded, bounded, and validated; the from date cannot be after the to date.

### F13. Keyboard and accessibility

- `c` opens event creation when focus is not inside a form field.
- `t` returns to Today.
- `d`, `w`, and `m` select Day, Week, and Month.
- `/` opens event search.
- `Escape` closes the active overlay following unsaved-change rules.
- All controls have accessible names, visible focus, and logical keyboard order.
- Modals trap focus and restore it to the triggering control on close.
- Colour is never the only indicator of calendar or event identity.

### F14. Time Insights

The left sidebar shows a collapsible daily Time Insights summary for the selected date. It reports meeting time, a trailing seven-day daily meeting average, and meeting load against an eight-hour planning day. “More insights” opens a right-side responsive drawer with a visual time-allocation chart and selectable By type and By calendar breakdowns.

Insight calculations are performed by the API from events in currently visible calendars. Event and appointment-schedule duration contributes to meetings; Focus time, Tasks, and Out of office have distinct categories; Working location is contextual metadata and contributes no duration. Timed events are clipped to the selected day. All-day Out of office contributes one working day, while other all-day metadata contributes no scheduled minutes.

**Acceptance criteria**

- Changing the selected date or calendar visibility refreshes insights from persisted data.
- Creating, editing, or deleting an item refreshes both the grid and its insight totals.
- The drawer can switch between type and calendar breakdowns and closes by button, scrim, or Escape.
- Schedule focus time opens a preconfigured Focus time editor.
- Loading, unavailable, zero-data, and over-capacity days remain readable and usable.

### F15. Meet with people and suggested times

The left sidebar contains a “Meet with…” directory search. It searches the seeded local people directory by name or email, supports keyboard listbox navigation, allows up to ten unique selections, and displays removable attendee chips. Each selection immediately opens a Day comparison containing You and every selected person. Columns share a time axis, show working-hours shading and busy blocks, and become horizontally scrollable as attendees are added. Clicking an open 15-minute comparison slot opens a meeting editor prefilled with all selected people. Selecting Suggested times opens a responsive right-side drawer without discarding the current calendar context.

The drawer combines the owner’s persisted events with each selected person’s working hours and busy blocks. Users choose a starting date and a 30, 45, 60, 90, or 120-minute duration. The API searches up to five working days in 30-minute increments and returns only slots inside everyone’s shared working-hours window with no overlapping busy event. Past slots, weekends, working-location metadata, and non-blocking all-day metadata are excluded.

The drawer shows a daily availability visualization, ranked free slots, the number of available attendees, and distinct loading, unavailable, and no-times states. Selecting a suggestion closes the drawer and opens the standard event editor with the title, attendees, start, and end prefilled. The event is persisted only through the existing Save action.

**Acceptance criteria**

- People search safely handles case, email characters, empty queries, no results, request failures, and stale responses.
- Duplicate people cannot be selected and a maximum of ten attendees is enforced by both UI and API.
- Comparison adds and removes schedule columns immediately, remains horizontally navigable with many attendees, and refreshes the owner schedule after Save.
- Arrow keys and Enter navigate and select directory results; Escape closes transient UI.
- Suggestion results never overlap the owner or any selected attendee and respect shared working hours.
- Changing date or duration refreshes availability without an older response replacing the latest result.
- A fully booked range shows a useful empty state rather than an error.
- Selecting a result pre-fills but does not automatically save or send an invitation.
- The full flow remains usable without horizontal overflow on a 390-pixel viewport.

## 10. Cross-feature states

| State | Required product behavior |
| --- | --- |
| Loading | Preserve shell and view geometry; show progress in the data region. |
| Empty period | State that no events are scheduled and offer Create. |
| No visible calendars | Explain that calendars are hidden and link attention to sidebar toggles. |
| API unavailable | Show retryable error; do not present missing data as a valid empty state. |
| Mutation in progress | Disable repeated submission and show action-level progress. |
| Mutation failed | Keep overlay/input open and show a specific, actionable error. |
| Search has no results | Show the query and offer Clear search. |
| Narrow screen | Collapse sidebar; retain navigation, view selection, and event CRUD. |

## 11. Data requirements

### Calendar entity

| Field | Requirement |
| --- | --- |
| `id` | Server-generated immutable identifier. |
| `name` | Required, unique per profile ignoring case, 1–80 characters. |
| `color` | Required six-digit hex color. |
| `visible` | Persisted boolean, default `true`. |
| `isPrimary` | Server-managed boolean. Exactly one primary calendar. |
| timestamps | Server-managed creation and update timestamps. |

### Event entity

| Field | Requirement |
| --- | --- |
| `id` | Server-generated immutable identifier. |
| `calendarId` | Required reference to an existing calendar. |
| `title` | Required trimmed string, 1–140 characters. |
| `description` | Optional string, maximum 2,000 characters. |
| `location` | Optional string, maximum 250 characters. |
| `startAt`, `endAt` | Required UTC instants; end strictly after start. |
| `allDay` | Required boolean. |
| `color` | Optional event-specific color override. |
| `participants` | Canonical display names, including backward-compatible name-only guests. |
| `participantIds` | Unique references to directory people used for visibility, conflicts, and RSVP authorization. |
| `attendeeResponses` | Unique directory-person responses with `status` and nullable `respondedAt`. |
| timestamps | Server-managed creation and update timestamps. |

MongoDB stores UTC datetimes. The frontend displays them in the browser’s local timezone. Availability requests also send the selected local calendar date and browser IANA timezone so working-hour and weekend calculations remain correct across UTC offsets and daylight-saving transitions. Cross-timezone event editing is not included in v1.

### Person entity

| Field | Requirement |
| --- | --- |
| `id` | Server-generated immutable identifier. |
| `name` | Required trimmed display name, maximum 120 characters. |
| `email` | Required unique lowercase email, maximum 254 characters. |
| `avatarColor` | Required six-digit accessible avatar color. |
| `workingHours` | Local start/end minutes defining the person’s available workday. |
| `busyBlocks` | Private busy intervals used by the availability engine; omitted from directory search results. |

## 12. Required API surface

All endpoints use `/api/v1`, JSON, and a consistent success/error envelope. Detailed schemas belong in the subsequent technical specification; this table locks the product capability contract.

| Method | Endpoint | Product purpose |
| --- | --- | --- |
| GET | `/health` | Confirm API and database availability. |
| POST | `/auth/login` | Verify the assessment workspace password and issue an expiring workspace JWT. |
| GET | `/auth/session` | Restore and validate an existing workspace or profile session. |
| POST | `/auth/switch-profile` | Verify that a profile is allow-listed and issue a profile-scoped JWT. |
| POST | `/auth/logout` | Complete the sign-out protocol; the client then removes its local credentials. |
| GET | `/profiles` | List only profiles available to the authenticated workspace. |
| GET | `/calendars` | Load all calendars and visibility preferences. |
| POST | `/calendars` | Create a secondary calendar. |
| POST | `/calendars/:calendarId/display-only` | Persist an exclusive calendar visibility selection. |
| PATCH | `/calendars/:calendarId` | Rename, recolor, or show/hide a calendar. |
| DELETE | `/calendars/:calendarId` | Delete an empty secondary calendar. |
| GET | `/events?from=&to=&calendarIds=` | Load events overlapping a view range. |
| GET | `/events/search?what=&who=&where=&exclude=&from=&to=&calendarIds=` | Search events using combinable advanced filters. |
| GET | `/events/:eventId` | Load complete event details. |
| POST | `/events` | Create an event. |
| PATCH | `/events/:eventId` | Edit an event. |
| DELETE | `/events/:eventId` | Delete an event. |
| GET | `/insights/daily?from=&to=&calendarIds=` | Aggregate a selected day by meeting, item type, and calendar. |
| GET | `/people?q=&limit=` | Search the local people directory without exposing busy details. |
| POST | `/availability/suggestions` | Find conflict-free shared working-hour slots for selected people. |
| POST | `/availability/conflicts` | Check a proposed interval against selected people immediately before save. |

Success uses `{ "data": ... }`. Failure uses `{ "error": { "code", "message", "details?" } }`. Except for health and login, workspace endpoints require an `Authorization: Bearer <JWT>` header; calendar data requires a profile-scoped token. The API must distinguish authentication, authorization, validation, unknown resource, conflict, and unexpected server errors.

## 13. Success criteria

The solution baseline is complete only when:

- Every included feature passes its acceptance criteria in all applicable views.
- No unsupported control appears interactive.
- A clean install has one install command, one start command, and a deterministic seed.
- All event and calendar mutations persist after refresh.
- Automated backend tests cover every endpoint, validation path, and conflict.
- Automated frontend behavioral tests cover navigation, all three views, filtering, search, event lifecycle, calendar lifecycle, and failure states.
- Production build, behavioral tests, and XML test reporting pass.
- Manual UI review finds no overflow, overlapping-control, inaccessible modal, console-error, or dead-action defect at supported widths.

## 14. Delivery plan

### Phase 0 — Approval

Review this PRD feature by feature. Change and then freeze scope. No implementation baseline is accepted before approval.

### Phase 1 — Product foundation

Application shell, seed/reset, date utilities, Today/navigation, mini-calendar, loading/error infrastructure.

### Phase 2 — Calendar views

Day, Week, Month, event placement, overlap behavior, current-time indicator, view preferences, and 12-hour clock formatting.

### Phase 3 — Event management

Typed item create/preview/edit/delete, timed/all-day behavior, validation, persistence, behavioral and API tests.

### Phase 4 — Calendar organization and search

Visibility, calendar lifecycle, search, shortcuts, responsive/accessibility pass.

### Phase 5 — Quality freeze

Full automated suite, clean-machine startup verification, visual QA, problem statements, technical specifications, and solution freeze.

Only after Phase 5 will the single candidate task be curated. Django and Spring Boot conversions follow task review.

## 15. Research basis

Feature curation follows the familiar Calendar workflows documented by Google: users navigate with arrows, Today, and the mini-calendar; choose calendar views; create events from empty calendar space or Create; manage timed/all-day events; and show/hide multiple calendars. Advanced Workspace collaboration and settings were intentionally removed from this baseline.
