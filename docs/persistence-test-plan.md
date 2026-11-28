# Persistence test plan

This checks that saves, trips, and notes are still there after a refresh, a sign-out, and a connection failure. Run it on a real iPhone against the real Firebase project (see [Trying Roami](trying-roami.md) for the setup).

## How the data is stored

Everything is in Firestore. There is no copy kept on the phone, so "survives" means "the server has it and the app reads it back".

- **Saved places and notes** are written with a transaction. Offline, a transaction fails with an error.
- **Trips, checklist items, visits and rankings** are written with a plain write. Offline, a plain write does not fail: the call waits until the connection comes back. The app deliberately has no timeout on writes (a timeout could cause a duplicate when the user retries).

The second point is the one most likely to find a real bug. If a screen shows a success state, or a spinner that never ends, while the write is still waiting, that needs to be written up. If the app is closed while a write is waiting, the write is lost.

Run each test with a throwaway account. Where a step says "check Firestore", open the Firebase console, then **Firestore Database**, and look in the collection named in the step.

## Setup

1. Sign up with a new account.
2. In Explore, save **two** places (call them Place A and Place B).
3. In Saved, add a note to Place A: `note one`.
4. In Itineraries, create a trip with Place A on one day.

Check Firestore: `savedPlaces` has two documents (IDs start with your user ID), and `trips` has one.

## A. Refresh and restart

| #   | Do this                                                       | Expect                                                         | Result |
| --- | ------------------------------------------------------------- | -------------------------------------------------------------- | ------ |
| A1  | Pull down to refresh on Saved                                 | Both places and `note one` are still there                     |        |
| A2  | Pull down to refresh on Itineraries and inside the trip       | The trip and its stops are still there                         |        |
| A3  | Force-close the app (swipe it away), then reopen from Expo Go | You are still signed in; Saved and Itineraries match the setup |        |
| A4  | Switch tabs and back                                          | No data disappears or duplicates                               |        |

## B. Sign out and back in

| #   | Do this                                                           | Expect                                                           | Result |
| --- | ----------------------------------------------------------------- | ---------------------------------------------------------------- | ------ |
| B1  | Profile, then **Sign out**. Sign back in with the same account    | Saved places, `note one`, and the trip are all back              |        |
| B2  | Sign out, create a **second** account, open Saved and Itineraries | Empty. You must not see the first account's places, note or trip |        |
| B3  | Sign out of the second account, sign in to the first again        | Everything from the setup is back                                |        |

## C. Connection failures

Use Airplane Mode (Control Center) to cut the connection. Turn it off to restore it.

| #   | Do this                                                                                              | Expect                                                                                            | Result |
| --- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------ |
| C1  | Airplane Mode on. Pull to refresh Saved                                                              | An error or the existing list. Not a blank screen that looks like you lost your saves             |        |
| C2  | Airplane Mode off. Pull to refresh Saved                                                             | Everything is back                                                                                |        |
| C3  | Airplane Mode on. Save Place C from Explore                                                          | An error ("try again" style). Not a saved state                                                   |        |
| C4  | Airplane Mode on. Edit `note one` to `note two` and tap **Save note**                                | The message "Could not save your note. Please try again." The old note is still shown             |        |
| C5  | Airplane Mode off. Tap **Save note** again                                                           | The note saves. Refresh Saved to confirm `note two`                                               |        |
| C6  | Airplane Mode on. Create a new trip                                                                  | **Record what happens.** Expected: a clear error. Risk: the spinner never ends, or it looks saved |        |
| C7  | Leave the app open, turn Airplane Mode off, wait 30 seconds. Check Itineraries and Firestore `trips` | Record whether the trip from C6 appeared (the write may complete once you are back online)        |        |
| C8  | Repeat C6, then **force-close the app** before turning Airplane Mode off. Reopen and check           | Record whether the trip is missing. If it is, that is the lost-write case                         |        |
| C9  | Airplane Mode on. Add a stop to an existing trip                                                     | Same questions as C6                                                                              |        |
| C10 | Airplane Mode on. Open the app from a force-closed state while still signed in                       | You stay signed in and see an error or empty state, not the sign-in screen                        |        |

## D. Second device (optional)

| #   | Do this                                              | Expect                                           | Result |
| --- | ---------------------------------------------------- | ------------------------------------------------ | ------ |
| D1  | Sign in to the same account on another phone         | Same saves, notes and trips                      |        |
| D2  | Change `note two` on one phone, refresh on the other | The other phone shows the change after a refresh |        |

## Recording results

For any row that does not match "Expect", note the row number, what you saw, and a screenshot. File each as a bug on the project board. The most useful findings to report are C6 to C9, since those are the cases the code was not written to handle on purpose.
