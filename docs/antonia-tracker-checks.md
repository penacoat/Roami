# Antonia's tracker fixes

This branch addresses the eight items assigned to Antonia in the team's Bug Tracker, plus the reported map lag and duplicate captions. Code changes are ready for review; device validation below is still required.

## Changes

- Keep the bottom navigation labels and remove duplicate headings from Explore, Postcards, Itineraries, and Saved, following the updated direction from Antonia and Yuki. Keep meaningful titles on detail and creation screens. Match login to the app's paper/navy design while preserving password recovery, visibility, and error handling.
- Keep the native map fixed behind an overlay panel. Animate the panel's translation with the native driver instead of repeatedly resizing the map. Keep map rendering separate from text input and save feedback; debounce search.
- Remove duplicate native marker callouts, simplify map controls, and put search, filters, and results in a single scrolling list. Expand controls with larger text instead of clipping them to fixed heights.
- Keep the place-details close control available while scrolling the title, actions, and recommendations. Distinguish saving a place from saving it with an author's tip.
- Carry the selected recommendation from Postcards to Explore, show it first with a visible label, and clear that emphasis when another place is selected.
- Preserve recommendation IDs when adding scheduled stops from place details or Saved, including after a failed write and retry. Suggestion sources now persist in an optional trip field and carry into both manual stops and generated plans. Opening a stop also restores its original recommendation in Explore.
- Resolve incoming places using `getPlace({ placeId })`, rather than searching the Seattle catalog. The optional city returned with a place updates the city filter; markers and camera focus use returned coordinates. Seattle remains only the initial city and camera fallback. Catalog loading remains available if Saved fails.
- Refresh the visible place fields, including hours, from the `getPlace` detail response instead of retaining an older list response. Hours are still catalog values, not a live external-provider lookup. Local demo hours remain labeled unverified; missing values are not interpreted as closed. Native map rendering does not populate business details.
- Reduce `MapScreen.tsx` from 849 to 385 lines by separating API state in `usePlaces.ts`, results and filters in `PlaceResults.tsx`, and common styles/helpers. The existing memoized `PlaceMap.tsx` renders the native map. Current main still registers live API handlers backed by Firestore; no replacement HTTP API is present in the merged code.

## Automated verification

The full mobile suite passes: 33 suites, 292 tests. The regression tests exercise screen navigation and fixture/API flows, including recommendation identity, saved sources, write retries, stale navigation requests, a place outside Seattle, and independent catalog/Saved failures.

All six backend suites pass: 128 tests, including real Firestore rules and integration tests against the local emulator. Backend test TypeScript library definitions now include ES2022 to support upstream itinerary code using `Array.at` on Node 24. Backend compilation, mobile lint, TypeScript, formatting, and `git diff --check` also pass. The missing `expo-image-picker` package is installed at the lockfile version. The iOS development bundle returns HTTP 200 from the LAN server.

## Local Expo test

Use the isolated checkout's `mobile` directory and Node 24. The ignored `.env.local` points to this Mac's Auth/Firestore emulators in live API mode; preview mode is off. Firestore is seeded with 50 places and 75 sample recommendations. Create a local test account in the app. These records do not modify the team's production database.

Scan the local Expo QR on the same Wi-Fi. The current address is `exp://192.168.1.71:8081`; the address must be refreshed if the Mac changes networks. Metro runs with `CI=1` because native file watching exceeds this host's limit; source changes require restarting Metro. The local Auth emulator runs on 9099 and Firestore on 8080. Neither requires a deployment for this test.

Expo CLI and Expo Go must use the same Expo account (`neeyuh`). Signing into Expo is separate from creating a local test account inside Roami. Keep the Mac awake while testing. Startup requires Node 24, the installed mobile/backend dependencies, local Auth/Firestore emulators, and the ignored local mobile environment configuration. The local seed command is `npm --prefix backend run seed`; do not seed a production database.

## Device checks still required

Use a small iPhone and a larger device; repeat with large accessibility text and VoiceOver:

1. Sign in, sign up, reset a password, show/hide the password, and submit with the keyboard open. Check that fields, errors, and buttons remain reachable.
2. Pan and zoom the map, type a search, clear it, change categories, and expand/collapse the panel. Check responsiveness, camera position, and absence of duplicate marker captions.
3. Tap a pin with a long place name. Scroll all details and recommendations, save the place and a tip separately, and return to results.
4. Open a postcard's place. Verify that its exact recommendation is highlighted. Add it to a trip day, reopen the trip, and check the stored recommendation IDs. Repeat from Saved and after a failed write.
5. Check focus order, spoken button labels, keyboard dismissal, and bottom safe areas across the other screens. Automated tests do not prove native layout or VoiceOver behavior.

## Release requirements

For any future release, the updated Firestore rules must accompany the application. No release is authorized. The optional `candidateRecommendationIds` trip field stores recommendation sources for suggestions and generated plans; existing trips without the field still load. Older deployed rules reject suggestion writes containing this new field. The rules retain owner-only writes and private trip access.

No physical-device performance, layout, or screen-reader pass is claimed. The development host has no iOS Simulator available. The emulators and Expo server are available for phone testing. The backend CI job is configured but has not run remotely.

The user explicitly directed that all code stay local. Do not push, publish, open a PR, or deploy. The eight tracker rows were previously marked in progress; no additional shared tracker updates were made during this local testing pass.
