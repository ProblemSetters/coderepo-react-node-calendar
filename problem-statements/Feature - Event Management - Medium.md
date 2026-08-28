# Feature: Event Management

`Medium`

## Overview

**Skills:** React, Node.js, MongoDB (Intermediate), Code Repository
**Recommended Duration:** 75 minutes

Implement the complete calendar-item lifecycle using the shared editor and API.

## Product Requirements

- Create all six supported calendar item types.
- Support editable quarter-hour choices, custom times, all-day ranges, and cross-midnight end dates.
- Search and select directory guests while preserving legacy name-only guests.
- Let directory guests answer Yes, Maybe, or No while preserving organizer-only edit/delete permissions.
- Preview, update, delete, and validate persisted items with useful failure states.

## Steps to Test Functionality

- Create each item type from Create and an empty calendar slot.
- Exercise same-day, cross-midnight, and multi-day ranges.
- Add guests, save, reopen as an invitee, change RSVP state, verify the organizer summary, edit, and delete the item.

**Note:** Review `technical-specs/EventManagement.md` for the complete contract.
