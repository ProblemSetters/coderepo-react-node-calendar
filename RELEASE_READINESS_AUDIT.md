# Calendar release-readiness audit

This is the authoritative implementation, verification, backlog, and QuickBites-alignment report for the Calendar repository as audited on **August 29, 2026**.

## Audit summary

| Audit field | Result |
| --- | --- |
| Repository | `ProblemSetters/coderepo-react-node-calendar` |
| Branch | `solution-prod`, tracking `origin/solution-prod` |
| Current-scope confidence | **High** for the scenarios covered below |
| Release/freeze decision | **Not ready to freeze as a HackerRank assessment yet** |
| Frontend tests | **100/100 passed** in 4 suites |
| Backend tests | **54/54 passed** in 4 suites |
| Total automated tests | **154/154 passed** |
| Frontend coverage | 83.37% statements, 74.49% branches, 82.40% functions, 91.81% lines |
| Backend coverage | 91.42% statements, 77.52% branches, 91.79% functions, 93.57% lines |
| Production build | Passed; 59 modules, 295.93 kB JavaScript and 77.59 kB CSS before gzip |
| Repository-level test command | Passed end to end |
| Static diff check | Passed |
| Browser QA | Passed for the live scenarios documented below |
| Tracked Git archive | 200 kB, below the 5 MB CodeRepo limit |
| QuickBites alignment | Strong architectural alignment; assessment packaging is incomplete |

## Executive verdict

The current product is a functioning full-stack calendar, not a visual prototype. Its supported calendar views, six item types, event lifecycle, calendar organization, search, Time Insights, profile switching, guest directory, conflict checking, multi-person availability comparison, working-hours treatment, suggested times, Out of office treatment, and failure states are implemented and covered by a substantial behavioral suite.

The implemented product scope is stable enough to continue using. It should not yet be frozen as a completed HackerRank CodeRepo because the assessment branch/task packaging is unfinished, the calendar palette still disagrees with its 24-color specification, current documentation needs final contract synchronization, and clean-platform verification gates remain.

No finite test suite can prove every possible string, date, timezone, browser, dataset size, request ordering, or operating-system condition. This audit therefore uses the practical standard of covering the meaningful equivalence classes, boundaries, state transitions, failure modes, and cross-feature interactions for the implemented scope. Anything not actually exercised is identified as residual risk instead of being presented as certain.

### Corrections made during this audit

- Moved authentication account queries out of the service and into `auth.repository.js`, restoring the same controller → service → repository layering used throughout the backend.
- Changed the assessment login secret control from a native password input to the CodeRepo-safe text-input pattern with autocomplete disabled and CSS masking; its behavior is covered by the login integration test.
- Reverified the recently corrected event-editor guest search/scroll panel and main header search layering against the existing live-browser scenarios.
- Removed stale implementation comments and rechecked the application for unfinished markers, old identity data, default native selects, undeclared workspace dependencies, and whitespace errors.

## What is built now

### 1. Profile entry and switching

- Responsive, light “Who’s using Calendar?” profile picker.
- Deliberately neutral, non-gendered profile names (`River`, `Sky`, `Sage`, `Ember`, and `Nova`) with `@hackerrank.com` addresses to avoid gender, country, and religion cues in a globally distributed assessment.
- All seeded directory addresses use the `@hackerrank.com` domain.
- Distinct, stable profile/calendar colors and name-derived initials across every avatar surface.
- One password-protected assessment workspace with bcrypt password verification and expiring JWTs.
- The assessment-safe password control remains `type="text"` with autocomplete disabled and CSS text-security masking, matching the CodeRepo anti-password-manager convention without exposing the value visually.
- A workspace token permits profile discovery; switching issues a profile-scoped token used for calendar authorization.
- All five profiles remain intentionally available after login so candidates can exercise organizer and attendee workflows without separate credentials.
- Loading, empty, stale saved-profile, API failure, and retry states.
- Selected-profile persistence and a compact header profile menu.
- Switch-profile flow with menu exclusivity, Escape handling, and focus restoration.
- Direct Sign out action in the active profile menu as well as the profile chooser.
- Profile-isolated owned calendars plus visibility of events where the active profile is invited.
- Other people’s comparison events open as read-only details without Edit or Delete.

Status: **Complete for the authenticated assessment-workspace model.**

### 2. Calendar shell and navigation

- Google Calendar-style header, sidebar, mini calendar, and main surface.
- Today, previous, next, and direct mini-calendar navigation.
- Day, Week, and Month view selection.
- Keyboard shortcuts for core navigation, creation, and search.
- Persisted view and sidebar preferences.
- Local GMT-offset display and current-time indicator.
- Responsive sidebar overlay and backdrop on narrow screens.
- Retryable application data failures without collapsing the shell.

Status: **Complete for the supported Day/Week/Month scope.**

### 3. Day, Week, and Month rendering

- Timed, all-day, cross-midnight, and multi-day items.
- Collision layout for overlapping timed events.
- Consecutive timed cards retain a four-pixel visual gap; overlapping cards use a subtle column tone and white separator so same-calendar events never merge visually.
- Compact rendering for short events.
- Dedicated Out of office icon and visual treatment in Day, Week, Month, comparison, preview, and search surfaces.
- Working-location chip in the day header without duplicate all-day rendering.
- Collapsed empty all-day lane and full-height lane when an all-day item exists.
- Six-week Month grid with 42 cells.
- Month `+N more` opens a day popover instead of immediately navigating.
- Popover event rows open details; only the date control changes to Day view.
- Month double-click handling does not create a duplicate draft through event bubbling.

Status: **Complete for the documented views.**

### 4. Calendar item creation and lifecycle

- Event, Task, Out of office, Focus time, Working location, and Appointment schedule types.
- Creation from Create, a Day/Week slot, a day heading, Month, comparison, or a suggested time.
- Google-style date/time row with conditional end-date display.
- All 96 quarter-hour start choices.
- End-time choices across the next 24 hours with duration labels.
- Editable valid custom times in 12-hour and 24-hour formats.
- Same-day, midnight rollover, cross-day, and all-day normalization.
- Calendar, location, description, searchable guests, and event color fields.
- Required title, positive chronology, field length, valid calendar, color, and identifier validation.
- Save progress and inline mutation errors that preserve entered values.
- Preview, Edit, Cancel, Delete confirmation, and Escape handling.
- Edit replaces the preview; successful Save closes the complete flow, so no stale preview remains.

Status: **Complete for single items and core recurring series. Per-instance edit/delete exceptions remain future work. Appointment schedule is currently an item type, not a public booking product.**

### 5. Guests, conflicts, and working-hours warnings

- Shared people-directory listbox in Meet with and the event editor.
- The event-editor guest picker retains its `Add guests` search field, keeps selected chips visible, constrains results to a scrollable panel, and flips above the field when the viewport has insufficient space below.
- Debounced name/email search, stale-response protection, keyboard navigation, no-results, retry, duplicate prevention, chips, and removal.
- Canonical participant IDs/names plus backward-compatible name-only guests.
- Live busy-conflict checks while editing and a second check immediately before Save.
- Touching half-open intervals remain available; genuine overlaps are reported.
- Working-location and other non-blocking all-day metadata do not create conflicts.
- All-day and timed Out of office block availability.
- Free attendees outside their local working hours are reported separately as warnings.
- Every directory attendee has a durable `needsAction`, `accepted`, `tentative`, or `declined` response, with an optional response timestamp.
- Invitees can answer **Yes**, **Maybe**, or **No** from read-only event details without gaining organizer edit/delete permissions.
- Organizers see aggregate response counts and each guest’s current status; newly added guests start pending and retained guests keep their answer.
- Date, time, or all-day schedule changes reset responses to pending so attendees explicitly reconfirm the changed invitation.
- Pending and tentative invitations render as unfilled, color-outlined cards; accepted invitations are filled; declined invitations remain discoverable as outlined, struck-through cards in Day, Week, Month, popover, and search surfaces.
- Declined invitations no longer make that attendee appear busy, while accepted, tentative, and pending invitations continue to block conflicts.
- Response validation covers missing profile context, non-attendees, organizers, invalid statuses, malformed IDs, and concurrent invitation changes.

Status: **Complete for local-directory invitation responses and conflict-aware RSVP behavior. Email delivery and external-calendar synchronization are not implemented.**

### 6. Meet with, comparison, and suggested times

- Search, select, and remove up to ten unique people.
- You plus selected people in equal Day comparison columns.
- Horizontally scrollable multi-person comparison without body overflow.
- Per-person, timezone-aware working windows and striped non-working treatment.
- Different persisted working hours and DST-aware zones.
- Owner striped time remains schedulable.
- Another person’s striped time is blocked with “You can’t schedule events for this calendar.”
- The blocked-action notice is manually dismissible and auto-dismisses after three seconds.
- Busy events open details instead of creating through them.
- Owner events remain editable; participant events are read-only.
- Open comparison slots snap to 15-minute boundaries and prefill all selected guests.
- Suggested Times supports 30, 45, 60, 90, and 120 minutes.
- Suggestions intersect everyone’s working hours and exclude owner/participant conflicts, elapsed time, and weekends.
- Loading, stale request, API failure, retry, fully booked, and editor-handoff states.

Status: **Complete for the current comparison and suggestion contract.**

### 7. Calendar management and color behavior

- Multiple calendars with persisted visibility.
- Create, rename, description, timezone, recolor, show/hide, and Display this only.
- Case-insensitive unique names, trimming, defaults, and validation.
- Primary-calendar and non-empty-calendar deletion protection.
- Immediate preset/custom color persistence and Default reset.
- Distinct seeded profile/calendar colors and readable foreground contrast.

Status: **Functionally complete, but the UI has 12 presets while the current specification requires 24.**

### 8. Search

- Compact search independent from advanced filters.
- Quick search on Enter.
- Active-calendar and all-calendar scope.
- Contained text, participant/organizer, location, exclusion, and inclusive local-date filters.
- Safe URL encoding and literal handling of regular-expression characters.
- Past and Upcoming grouping.
- Loading, empty, error, retry/modify, reset, and close states.

Status: **Complete for the current search API.**

### 9. Time Insights

- Daily sidebar summary, meeting duration, seven-day average, working-day load, and zero state.
- Responsive detailed drawer.
- By type and By calendar breakdowns.
- Cross-boundary clipping and an eight-hour cap for all-day Out of office.
- Working location contributes no duration.
- Loading, failure, retry, drawer close, Escape, and Schedule focus time flow.
- Refresh after date, visibility, event create, update, and delete changes.

Status: **Complete for daily insights.**

### 10. Backend, persistence, and operations

- Express API with MongoDB/Mongoose persistence.
- Deterministic, date-relative seed data and seed-signature startup flow.
- The seed contains 50 durable calendar items across five profiles: all six item types, 11 recurring series, 18 invitations, varied RSVP states, working-location patterns, realistic conflicts, and past/current/upcoming activity. Every seed run validates ownership, chronology, all-day boundaries, participant identity alignment, RSVP alignment, and recurrence definitions before writing.
- Feature folders for authentication, calendars, events, insights, people, and availability.
- Controller, service, repository, routes, and models in each relevant feature.
- Profile-context middleware and profile-aware data access.
- Zod validation and stable success/error envelopes.
- Validation, conflict, not-found, malformed ID, unknown route, and CORS behavior.
- Timezone/DST-aware date arithmetic and graceful server shutdown.
- Bun workspaces, allowed ports, Vite API proxy, hot reload, environment examples, and VS Code debugger configuration.

Current API surface:

- `GET /api/v1/health`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/session`
- `POST /api/v1/auth/switch-profile`
- `POST /api/v1/auth/logout`
- `GET /api/v1/profiles`
- `GET|POST /api/v1/calendars`
- `POST /api/v1/calendars/:calendarId/display-only`
- `PATCH|DELETE /api/v1/calendars/:calendarId`
- `GET|POST /api/v1/events`
- `GET /api/v1/events/search`
- `GET|PATCH|DELETE /api/v1/events/:eventId`
- `PATCH /api/v1/events/:eventId/response`
- `GET /api/v1/insights/daily`
- `GET /api/v1/people`
- `POST /api/v1/availability/suggestions`
- `POST /api/v1/availability/conflicts`

Status: **Functionally strong; authentication, profile authorization, event ownership, and existence queries respect the middleware/service/repository/database boundaries.**

## Verification evidence

### Automated commands

| Check | Result |
| --- | --- |
| `npm test` at the repository root | Passed: frontend then backend |
| Frontend `npm test` | 4 suites, 100 tests passed |
| Backend `npm test` | 4 suites, 54 tests passed |
| Frontend `npm run test:coverage` | Passed; 83.37% statements, 74.49% branches, 82.40% functions, 91.81% lines |
| Backend `npm run test:coverage` | Passed; 91.42% statements, 77.52% branches, 91.79% functions, 93.57% lines |
| Frontend `npm run build` | Passed; 59 modules transformed |
| `git diff --check` | Passed |
| `npm ls --workspaces --depth=0` | Passed; declared workspace packages resolve |
| Live authentication/API smoke | Health, login, session, and profiles returned `200`; five profiles were visible |
| Seed/profile smoke | Every profile token loaded its own calendars plus invited events; every returned item had a non-empty title and positive chronology |
| JUnit output | `output/frontend.xml` and `output/results.xml` generated |
| Tracked archive size | 200 kB at `HEAD` |

The backend suite uses MongoDB Memory Server and was run with local-port permission. Node prints an experimental VM Modules warning during Jest startup; the suites themselves pass.

The read-only seeded-data smoke returned River `3 calendars / 18 events`, Sky `2 / 38`, Sage `2 / 17`, Ember `2 / 48`, and Nova `2 / 48` inside the audited date window. Higher counts for invitees are expected because profile-scoped event visibility includes events they own and events to which they are invited.

### Edge and failure partitions covered automatically

| Area | Verified scenarios |
| --- | --- |
| Profiles | load, selection, switch, persistence, stale ID, empty list, API failure, retry, exclusive menus, Escape, focus restoration |
| Navigation | Day/Week/Month, Today, previous/next, leap year, cross-month/year, Monday week boundary, mini-calendar independence, preference persistence |
| Date/time editor | 96 starts, full-day end choices, valid custom minutes, invalid text, native events, duration preservation, midnight rollover, end-date show/hide, all-day normalization |
| Item lifecycle | six types, blank title, invalid range, disabled Save, save progress, create/edit/delete success, cancel confirmation, backend failure preservation, preview/editor closure |
| Rendering | timed, short, overlapping, all-day, multi-day, cross-midnight, working location, Out of office, Month overflow, double-click propagation |
| Calendars | create, defaults, trim, duplicate name, invalid metadata, update, display-only, preset/custom/default colors, failure, deletion protections, malformed/missing IDs |
| Search | compact/advanced entry, every filter, active/all scope, local inclusive dates, invalid range, special characters, loading, empty, failure, retry |
| Insights | type/calendar aggregation, clipping, all-day cap, ignored metadata, empty day, drawer controls, retry, focus scheduling |
| People | name/email, literal special characters, sorting, limits, keyboard selection, duplicates, removal, no results, failure, retry |
| RSVP | pending/Yes/Maybe/No transitions, organizer summaries, response timestamps, retained/new guests, schedule resets, declined busy exclusion, unauthorized/invalid responses, failure preservation |
| Recurrence | daily/weekly/monthly/yearly/weekday rules, custom intervals/days/endings, range expansion, DST wall-time preservation, occurrence keys, this/following/all RSVP precedence, invalid zone/end rejection |
| Availability | shared hours, different local hours, DST zone, owner/participant busy data, persisted invited events, weekends, elapsed intervals, full calendars, touching boundaries, invalid duration/range/IDs, missing/duplicate people |
| Comparison | owner plus participants, working windows, owner out-of-hours creation, blocked participant out-of-hours creation, three-second notice, busy-event selection, API retry, 15-minute draft boundaries |
| API/client resilience | malformed/missing IDs, invalid payloads, unknown routes, CORS, empty delete response, malformed/non-JSON response, network failure |

### Live browser verification

- Desktop 1440×900: no document/body horizontal overflow.
- Tablet 840×900: no document/body horizontal overflow.
- Mobile 390×844 Month: 42 cells, no page overflow, compact event controls remained accessible.
- Mobile sidebar: rendered as a 280-pixel overlay inside the viewport.
- Month overflow: opened a compact 292-pixel dialog listing all seven populated items for the current date while leaving the Month view in place.
- Month popover event: opened the correct Out of office details with Edit/Delete for the owner.
- Meet with search: located and selected a neutral profile by directory name/email.
- The selected-person chip, search result, comparison header, suggested-times avatars, and profile controls share one initials formatter, so every neutral profile name renders consistently across the application.
- Comparison: rendered You and each selected person with one working window per column.
- Thirty-minute comparison items rendered in a single centered row with `clientHeight === scrollHeight` (30 pixels), proving the title/time content is no longer clipped against the bottom edge.
- Four-column comparison at 390 pixels: internal surface width was 840 pixels while the body remained 390 pixels, confirming internal horizontal scrolling without page overflow.
- Mobile 390×844 event editor: the complete editor remained inside the document width, retained readable date/time controls, and closed cleanly without leaving a dialog behind.
- Event-editor guest directory: the search field remained present, filtering worked, results were internally scrollable, and constrained layouts used the upward-opening panel without covering the fixed action footer.
- Main application search: the header Search control opened the quick-search row above the calendar surface and retained keyboard entry after the guest-picker layering changes.
- Invitee event preview: rendered accessible **Yes**, **Maybe**, and **No** controls; each selection persisted in place without exposing Edit/Delete.
- Invitation cards: pending rendered white with the calendar-colored outline, accepted rendered filled, and declined retained the outline with struck-through title and time.
- Recurrence editor: live desktop QA exposed every Google-style preset and the custom interval, frequency, weekday, monthly, and ending controls without saving test data.
- Organizer event preview: immediately displayed `1 no` plus the responding guest’s identity, HackerRank email, and status.
- Mobile 390×844 RSVP dialog: measured 358 pixels wide, remained fully inside the viewport, and needed no internal scrolling (`clientHeight === scrollHeight`).
- Another person at 8:00 AM: creation was blocked with the expected message, which disappeared after three seconds.
- Browser diagnostics: no application runtime warnings or errors during the final recorded checks.

The live audit persisted an RSVP transition and restored the demonstration invitation to **Yes** afterward. Event Save/Delete behavior remains covered by frontend orchestration tests and backend API integration tests.

## What remains before freezing the current scope

### P0 — complete CodeRepo branch and task packaging

- `solution-prod` exists and tracks the correct GitHub remote.
- No local or remote `base-prod` branch exists yet.
- The five assessment features are not organized into independent `task1`…`task5` test directories.
- Root `test:taskN` scripts do not exist.
- XML is aggregate (`frontend.xml`, `results.xml`) instead of task-level (`taskN.xml`).
- The two local `2429661-*` reference directories and `Coderepo_Guidelines.txt` are intentionally excluded from the application commit and must remain outside every assessment branch.

Required action: finalize independent task boundaries, create matching tests on both branches, add per-task commands/XML, create `base-prod` without merging it with `solution-prod`, introduce only the intended task defects, and verify the final branch diff contains business-logic changes only.

### P1 — reconcile the calendar color palette

- Code currently defines 12 named colors.
- `PRD.md` and `technical-specs/CalendarManagement.md` require 24.
- The provided Google Calendar reference also shows a larger palette.

Required action: either implement and test 24 accessible, visually distinct colors across calendar creation/settings/seed/contrast behavior, or explicitly revise the approved specification to 12. Do not leave code and assessment contract inconsistent.

### P1 — synchronize documentation with the implemented product

Current drift includes:

- The PRD now describes the authenticated workspace at product level, but a dedicated authentication/profile-selection technical specification and assessment-scope declaration are still needed.
- `/api/v1/profiles`, profile-scoped authorization details, invited-event visibility, read-only participant events, working-hour warnings, and current Out of office behavior need fuller technical-contract coverage.
- Meet with technical spec says comparison has no non-working-hour hatching and all open slots can create; the app now deliberately stripes and blocks another person’s non-working time.
- The Calendar Views spec lists `calendar-day-{YYYY-MM-DD}`, but that identifier is not implemented.
- There is no dedicated profile-selection problem statement/technical specification or an explicit declaration that it is non-assessment scaffolding.
- `PROJECT_STATUS.md` contains older test counts and now-resolved working-hours gaps.

Required action: update the PRD, specs, test-ID tables, API/data contracts, and assessment scope before producing `base-prod`.

### Completed — authenticated assessment workspace

- Login credentials are verified against a bcrypt password hash; plaintext passwords are never stored or returned.
- Workspace and profile sessions use signed, expiring JWTs with issuer, audience, account, and profile validation.
- Authentication persistence queries pass through a dedicated repository, preserving the controller → service → repository boundary used by the other backend features.
- Calendar APIs require a profile-scoped bearer token and no longer trust a caller-selected profile header in production.
- Profile selection remains intentionally open across the account's allow-list, preserving the assessment's fast multi-person testing flow.
- Signing out clears client credentials. Access-token revocation before expiry, account administration, recovery, MFA, and SSO remain production-platform concerns outside this assessment.

### P1 — complete clean-platform verification

- Clean `bun install` from an empty dependency directory was not performed because it would destructively replace the user’s current workspace installation.
- `solution-prod` and the not-yet-created `base-prod` have not both been uploaded and exercised on HackerRank.
- The tracked `HEAD` archive is 200 kB, but the latest working-tree changes must be committed before the final downloadable archive represents this exact implementation.

Required action: after curation, run a clean install/start/task-test/build on both branches and perform HackerRank platform verification.

### P2 — add deterministic formatting enforcement

A Prettier config exists, but Prettier is not installed and no format-check script exists. QuickBites also lacks a root formatting command, but the CodeRepo guideline requires consistent Prettier-only formatting.

Required action: add a pinned Prettier development dependency and a non-mutating `format:check` command, then format both branches identically before defects are introduced.

### P2 — add the remaining high-value test partitions

- Database-level simultaneous duplicate calendar creation against the unique index.
- Migration behavior for an older calendar document without `defaultColor`.
- Exact 24-color uniqueness/contrast once the palette decision is implemented.
- Ten-person comparison and selection-limit UX.
- Large Month/search datasets and the 100-result UI boundary.
- Complete focus-trap coverage for event/calendar editors.
- Browser QA in Chromium, Firefox, and WebKit-equivalent engines.
- Accessibility audit with automated rules plus keyboard-only/manual screen-reader passes.
- Performance/load tests for dense event ranges and concurrent API traffic.
- Startup behavior when configured ports are already occupied. During this audit, an existing process held port 3000, so Vite correctly fell back to 3001; a clean HackerRank run should confirm the intended 3000/8000 pairing.

## QuickBites and CodeRepo comparison

The Calendar codebase is **similar in architecture**, but it is not yet equivalent in assessment curation.

### Aligned

| Pattern | Calendar result |
| --- | --- |
| Repository naming | Correct `coderepo-react-node-calendar` convention |
| Stack | React/Vite, Node/Express, MongoDB/Mongoose |
| Monorepo | Root npm workspaces for frontend and backend |
| Runtime | Bun lockfile and Bun-oriented install/start scripts |
| Frontend structure | Feature folders plus shared API/components/utilities |
| Backend structure | Feature folders with controller/service/repository/routes/model |
| Backend repository discipline | Authentication, event ownership, and calendar existence queries flow through repositories |
| State and HTTP | React built-ins and native `fetch`; no Redux, Axios, or query framework |
| Ports | Frontend 3000 and backend 8000, both allowed |
| Networking | Both servers bind for hosted access; Vite proxies `/api` |
| Environment/setup | Example env files, MongoDB check, deterministic seeding, setup script |
| Curation folders | `problem-statements`, `technical-specs`, and `output/.gitkeep` |
| Protected paths | Tests, seed, database config, Jest config, and Vite config in `hackerrank.yml` |
| Debugger | VS Code launch configuration |
| Behavioral testing | User-flow frontend tests and real API/test-database backend tests |
| Archive hygiene | Generated dependencies/build/coverage/env/XML excluded; archive well below 5 MB |

### Different or incomplete

| Area | QuickBites | Calendar | Decision/action |
| --- | --- | --- | --- |
| Branches | Reference repository includes assessment branch history | Only `solution-prod` is available | Create the independent `base-prod` flow |
| Test organization | `task1`…`task8` behavior suites | Four frontend suites and four aggregate backend suites | Split by the five independent assessment tasks |
| Root test scripts | One command and XML file per task | Aggregate `test` and `test:coverage` only | Add `test:task1`…`test:task5` |
| Frontend decomposition | Pages/components/services/hooks/contexts inside features | Flatter feature components; `App.jsx` owns orchestration | Current size is manageable; extract a workspace hook/reducer if orchestration grows |
| UI stack | Tailwind/Shadcn-style components and dark presentation | Custom CSS and light Google-style design | Intentional user-approved product deviation; do not convert blindly |
| Authentication | JWT/password flow | Bcrypt workspace login plus expiring workspace/profile JWTs | Aligned while retaining assessment-friendly access to every allowed profile |
| Database reset | Seed signature preserves normal work in both references | Same seed-signature behavior | This matches QuickBites but differs from the guideline’s reset-on-restart wording; document the approved policy |
| Test identifiers | Task-oriented tests drive stable selectors | Accessible roles plus 11 explicit `data-testid`s | Reconcile identifiers with final technical specs |

QuickBites should be treated as a structural and curation reference, not copied file for file. Calendar adopts its relevant password/JWT boundary while retaining the user-approved Google-style light UI and avoiding unrelated food-delivery dependencies or routing.

## Future product backlog after the current scope is frozen

These features are not complete and should not be represented as complete Google Calendar parity:

1. Per-instance recurrence edit/delete exceptions and edit/delete-this-and-following behavior. Core recurring creation, display, search, availability, insights, and scoped RSVP are complete.
2. Invitation email delivery, external directory/calendar synchronization, RSVP comments, and organizer handling for proposed new times.
3. Calendar sharing permissions, subscriptions, public calendars, and holiday feeds.
4. Google Meet or other conferencing integration.
5. Reminders, notifications, attachments, and task completion/status.
6. Drag-and-drop and resize-to-change-time.
7. Import/export, print, and offline synchronization.
8. Year, Schedule, four-day, and custom views.
9. World clock, secondary timezone display, and event timezone editing.
10. User-editable working hours, work week, and working-location schedules.
11. Weekly/historical Time Insights and productivity trends.
12. Real appointment booking pages, availability rules, and public booking links.
13. Production identity administration, account recovery, MFA/SSO, refresh-token rotation, and early access-token revocation if the product leaves assessment/demo use.
14. Django and Spring Boot variants after the Node solution and assessment branches are frozen.

## Recommended order of work

1. Freeze the current product behavior and update PRD/specs/test IDs to match it.
2. Decide and complete the 24-color palette contract.
3. Add the remaining high-value regression partitions.
4. Define five independent candidate tasks and create per-task commands/XML.
5. Create `base-prod` from the correct phase flow without merging it with `solution-prod`.
6. Add formatting enforcement and perform clean install/start/test/build checks.
7. Validate both branches and task scoring on HackerRank.
8. Only after those gates pass, begin the next product feature set.

## Reproduction commands

From the repository root:

```bash
cd /Users/mahadevan/Documents/coderepo-react-node-calendar
npm test
cd frontend && npm run test:coverage && npm run build
cd ../backend && npm run test:coverage
cd .. && git diff --check
```

The normal application command remains:

```bash
cd /Users/mahadevan/Documents/coderepo-react-node-calendar
bun start
```
