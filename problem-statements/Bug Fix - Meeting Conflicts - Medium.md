# Bug Fix: Meeting Conflicts

`Medium`

## Overview

**Skills:** Node.js (Intermediate), Scheduling Logic
**Recommended Duration:** 60 mins

This backend question evaluates Node.js, bug fixing, and date-range reasoning, and suits mid-level roles. The task is to repair the availability checks in a calendar app so that busy guests are actually reported as busy.

Calendar is a scheduling app where a team keeps their calendars and invites each other to meetings. While you pick a time, the event editor checks the guests you invited and warns you about anyone already busy, and Suggested times proposes slots that clash with nobody. The availability layer behind both is returning wrong answers.

## Issue Summary

Several users report that the app tells them everyone is free when they are not.

- Guests who are already busy are shown as available. This covers a guest whose meeting falls inside the time being planned, a guest who has not answered an invitation or answered "Maybe", and a guest who is out of office all day.
- A repeating meeting only blocks its first week. Every week after that shows as free.
- Suggested times proposes slots the organizer already has a meeting in.
- Reported busy blocks run past the window that was asked about, instead of being trimmed to it.

Your task is to fix the availability flow on the backend.

## Steps to Reproduce

- Sign in as **Alex Morgan**. Every demo user signs in with their own address and the same password.
  ```
  Email: alex.morgan@calendar.com
  Password: password123
  ```
- Find the **Team roadmap** event on the calendar. Expand its guest list. One guest accepted and the other answered "Maybe", so both are busy for that hour. Note the day and time, then close the event.
  ![Team roadmap guest list showing one yes and one maybe](ps-images/01-team-roadmap-guest-list.png)
- Click the calendar grid on the same day, 30 minutes before Team roadmap starts, and set the end time to 30 minutes after it ends. Add **Jordan Smith**, who accepted it.
- Observe that the editor reports "All guests are available", although Team roadmap falls inside this window and she did not decline it.
  ![Editor reporting all guests available while the guest is busy](ps-images/02-all-guests-available.png)
- Discard that event. In the sidebar, add **Jordan Smith** under **Meet with**, then click **Suggested times**. Set the starting date to the day Team roadmap falls on.
- Scroll the list of best available times. Observe that it offers the slots Team roadmap occupies, although Alex Morgan is already in that meeting.
  ![Suggested times offering a slot the organizer has already booked](ps-images/03-suggested-times-offers-booked-slot.png)
- **Weekly product planning repeats every Tuesday at 10:00 AM, and Jordan Smith accepted it.** Go back to the Tuesday of last week, click the grid at 10:00 AM, and add her as a guest. The clash is reported correctly.
  ![Editor reporting the clash on the week the repeating meeting starts](ps-images/04-repeat-blocks-first-week.png)
- Discard that event and repeat exactly the same steps on a Tuesday two or three weeks ahead. The meeting still repeats on that day, but now the editor reports no clash at all.
  ![Editor reporting all guests available on a later week of the same repeating meeting](ps-images/05-repeat-free-in-later-weeks.png)
- **Jordan Smith is out of office all day on the second Friday from today.** Create an event on that Friday and add her as a guest. Observe that she is reported as available.
  ![Editor reporting a guest available while they are out of office](ps-images/06-out-of-office-guest-available.png)

## Expected Behavior

- A guest is busy when a meeting genuinely overlaps the proposed window, and overlap is judged on the whole window rather than only its start.
- A guest counts as busy unless they declined. Not answering and answering "Maybe" both still mean busy.
- An all-day out of office makes that guest busy for the day. Other all-day items, such as a working location, leave them free.
- Every occurrence of a repeating meeting blocks time, not only the first.
- Reported busy blocks are trimmed to the window that was asked about.
- Suggested times never proposes a slot that clashes with the organizer or any guest, and never proposes one outside working hours.

**Note:** The calendar always displays in UTC, whatever your machine is set to, so the times you see match the screenshots. The demo data is generated relative to today, so the exact dates move.

**Note:** Review `technical-specs/MeetingConflicts.md` for the complete contract, including the busy rules and the request and response shapes for both availability endpoints.

**Note:** The acceptance criteria for this task require your solution to pass all predefined test cases. Use the failing tests to guide debugging.
