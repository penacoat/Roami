# Antonia's tracker fixes

This branch addresses the eight items assigned to Antonia in the team's Bug Tracker, plus the reported map lag and duplicate captions. Code changes are ready for review; device validation below is still required.

## Changes

- Use Roami as the Explore heading and page names elsewhere. Match login to the app's paper/navy design while preserving password recovery, visibility, and error handling.
- Keep the native map fixed behind an overlay panel. Animate the panel's translation with the native driver instead of repeatedly resizing the map. Keep map rendering separate from text input and save feedback; debounce search.
- Remove duplicate native marker callouts, simplify map controls, and put search, filters, and results in a single scrolling list. Expand controls with larger text instead of clipping them to fixed heights.
- Keep the place-details close control available while scrolling the title, actions, and recommendations. Distinguish saving a place from saving it with an author's tip.
- Carry the selected recommendation from Postcards to Explore, show it first with a visible label, and clear that emphasis when another place is selected.
- Preserve recommendation IDs when adding scheduled stops from place details or Saved, including after a failed write and retry. Suggestion sources now persist in an optional trip field and carry into both manual stops and generated plans. Opening a stop also restores its original recommendation in Explore.

## Automated verification

The full mobile suite passes: 33 suites, 289 tests. The regression tests exercise screen navigation and fixture/API flows, including recommendation identity, saved sources, write retries, and stale navigation requests. Service tests cover persisted trip-stop and suggestion recommendation IDs using a fake Firestore implementation.

Backend TypeScript compilation, mobile formatting checks, and `git diff --check` also pass. Full mobile lint and TypeScript checks remain blocked by the existing checkout's missing `expo-image-picker` dependency, imported by upstream `tripPhotos.ts`; no other errors were reported by those checks.

## Device checks still required

Use a small iPhone and a larger device; repeat with large accessibility text and VoiceOver:

1. Sign in, sign up, reset a password, show/hide the password, and submit with the keyboard open. Check that fields, errors, and buttons remain reachable.
2. Pan and zoom the map, type a search, clear it, change categories, and expand/collapse the panel. Check responsiveness, camera position, and absence of duplicate marker captions.
3. Tap a pin with a long place name. Scroll all details and recommendations, save the place and a tip separately, and return to results.
4. Open a postcard's place. Verify that its exact recommendation is highlighted. Add it to a trip day, reopen the trip, and check the stored recommendation IDs. Repeat from Saved and after a failed write.
5. Check focus order, spoken button labels, keyboard dismissal, and bottom safe areas across the other screens. Automated tests do not prove native layout or VoiceOver behavior.

## Release requirements

Deploy the updated Firestore rules with the application after review. The optional `candidateRecommendationIds` trip field stores recommendation sources for suggestions and generated plans; existing trips without the field still load. Older deployed rules reject suggestion writes containing this new field. The rules retain owner-only writes and private trip access.

No physical-device performance, layout, or screen-reader pass is claimed. The development host has no iOS Simulator available. Its sandbox also prevents the Firestore emulator from binding a local port. The new backend CI job is configured to run the actual rules suite, but it has not run yet.

The changes are local only. Publishing a branch and opening a draft PR in the public `penacoat/Roami` repository await user authorization after automatic approval review blocked the upload. Nothing has been deployed. The eight tracker rows are marked in progress with their remaining review or device checks.
