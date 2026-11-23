# Antonia's tracker fixes

This branch contains Antonia's Explore fixes and related recommendation handoff work. Antonia confirmed Explore may change, while teammates' Postcards, Itineraries, and Saved layouts must be preserved apart from shared heading/navigation cleanup and pull-to-refresh. The login and trip-creation screens currently match the imported team baseline (`19aeb3f`, matching upstream `a93a067`). New passport-style login and cursive loading designs are mockups for review only; do not implement them without that review. The original eight-item tracker list is not wholly implemented in this version. Device validation below is still required.

## Changes

- Keep the bottom navigation labels and remove duplicated root-page headings. Preserve teammates' card styles, forms, content order, and page layouts. Keep the original login and trip-creation designs while the new login/loading mockups are reviewed.
- Add native pull-to-refresh to Explore's results and place details, Postcards, Itineraries, and Saved (including its visits/rankings view). Keep loaded cards visible during a pull and reload through the existing APIs. Existing explicit refresh/retry controls remain available.
- Keep the native map fixed behind an overlay panel. Animate the panel's translation with the native driver instead of repeatedly resizing the map. Keep map rendering separate from text input and save feedback; debounce search.
- Remove duplicate native marker callouts, simplify map controls, and put search, filters, and results in a single scrolling list. Expand controls with larger text instead of clipping them to fixed heights.
- Keep the place-details close control available while scrolling the title, actions, and recommendations. Distinguish saving a place from saving it with an author's tip.
- Carry the selected recommendation from Postcards to Explore, show it first with a visible label, and clear that emphasis when another place is selected.
- Preserve recommendation IDs when adding scheduled stops from place details or Saved, including after a failed write and retry. Suggestion sources now persist in an optional trip field and carry into both manual stops and generated plans. Opening a stop also restores its original recommendation in Explore.
- Resolve incoming places using `getPlace({ placeId })`, rather than searching the Seattle catalog. The optional city returned with a place updates the city filter; markers and camera focus use returned coordinates. Seattle remains only the initial city and camera fallback. Catalog loading remains available if Saved fails.
- Refresh the visible place fields, including hours, from the `getPlace` detail response instead of retaining an older list response. Hours are still catalog values, not a live external-provider lookup. Local demo hours remain labeled unverified; missing values are not interpreted as closed. Native map rendering does not populate business details.
- Hide the previous city's map when the requested city has no catalog results, and expand the results panel so the empty state is visible. The city input currently filters the catalog; it is not a geocoder. Only Seattle is seeded locally. A returned place can still open by ID and focus its own coordinates outside Seattle.
- Reduce `MapScreen.tsx` from 849 to 408 lines by separating API state in `usePlaces.ts`, results and filters in `PlaceResults.tsx`, and common styles/helpers. The existing memoized `PlaceMap.tsx` renders the native map. This checkout still registers live API handlers backed by Firestore; no replacement HTTP API is present in the imported merged code.

## Scope outside Explore

| Area | Remaining change from the imported team baseline |
| --- | --- |
| Login and trip creation | None; files restored exactly. Proposed login/loading designs are not applied. |
| Bottom navigation and shared theme | None. |
| Postcards | Pass the selected recommendation ID into Explore, remove the duplicated page heading, and add pull-to-refresh. Original cards and content layout retained. |
| Saved | Pass saved recommendation IDs to AddToItinerary, remove the duplicated page heading, and add pull-to-refresh. Original cards and content layout retained. |
| Itinerary list | Remove the duplicated page heading and add pull-to-refresh. Original trip cards and layout retained. |
| Itinerary details | Pass a stop's recommendation ID when opening Explore. Original layout retained. |
| AddToItinerary and data services | Preserve the source recommendation through save/suggestion/stop flows; show whether a tip is already attached. |

The app currently reads a separate local emulator database. Its seeded posts and places, and its account-specific saved places and trips, can differ from the team's data without any page redesign. This checkout contains the imported merged code, not teammates' unmerged work.

## Login/loading mockups and feature ownership

Antonia requested mockups before implementation. The latest loading concept is one continuous, single-color navy line: it wanders onto the screen, forms balanced lowercase cursive `roami`, loops into a location-pin outline above the `i` as part of the same stroke, then unravels offscreen and returns while loading continues. There is no separate pin, red accent, or oversized `o`. The proposed login uses a small formal ROAMI wordmark, restrained navy/ivory typography, and one compact group of fields, recovery link, Sign in button, and Create account link. No cursive, passport labels, seals, or ornamental frames belong on login. Neither design is implemented. Keep the loading duration tied to actual readiness; provide reduced-motion behavior when implemented.

The team's Bug Tracker currently assigns login design to Antonia; profiles/settings, interests, and recommendation composition to Ameli; the current-trip home page and Following feed to Rui; and feed pagination plus the places/data API for cities beyond Seattle to Brooklyn. The latter features are marked open. Sign-up already creates a basic public profile through the shared API, but this checkout has no profile editor or interests onboarding. Postcards already calls `getFeed`. The first-tab question is a design discussion only: do not change navigation order or build teammates' features based on it.

## Automated verification

The full mobile suite passes: 34 suites, 297 tests. The regression tests exercise screen navigation and fixture/API flows, including recommendation identity, saved sources, write retries, stale navigation requests, a place outside Seattle, hiding the stale map for an unsupported city, independent catalog/Saved failures, and pull-to-refresh success/error recovery.

All six backend suites pass: 128 tests, including real Firestore rules and integration tests against the local emulator. Backend test TypeScript library definitions now include ES2022 to support upstream itinerary code using `Array.at` on Node 24. Backend compilation, mobile lint, TypeScript, formatting, and `git diff --check` also pass. The missing `expo-image-picker` package is installed at the lockfile version. The iOS development bundle returns HTTP 200 from the LAN server.

## Local Expo test

Use the isolated checkout's `mobile` directory and Node 24. The ignored `.env.local` points to this Mac's Auth/Firestore emulators in live API mode; preview mode is off. Firestore is seeded with 50 places and 75 sample recommendations. The local-only `demo@roami.test` account has three saved places, one Seattle trip, and two scheduled stops. These records do not modify the team's production database. Reads of all five collections were verified after signing into this account through the client SDK and actual Firestore rules.

### How local data and the shared API fit together

Explore calls `callApi('listPlaces', { city })` and `callApi('getPlace', { placeId })`. In live mode, the registered PlaceService reads PlaceRepository, which reads whichever Firestore instance the environment selects. With `EXPO_PUBLIC_EMULATOR_HOST` set, those reads and account writes go to the local emulator. Fixture mode is a separate frontend-only source; it is not the current Expo configuration.

Local emulator records do not automatically upload or merge into a team database when configuration changes. The seed script refuses any destination except loopback Firestore on port 8080. A future provider integration can replace the registered handler's implementation while preserving the shared request/response types and screen code. This checkout does not yet contain such an HTTP/provider replacement. Missing hours remain unknown until that source supplies them; native map tiles do not provide these fields to the app.

The API client currently falls back to fixtures if a live handler is unregistered. All current place handlers are registered, and a failed live request does not fall back. Before a production handoff, the team should make unsupported operations explicit rather than rely on that development fallback. Do not change shared API behavior, connect production, or upload demo records as part of local UI testing.

Antonia can implement Explore's map presentation, API integration, city selection UI, loading/empty/error states, details, refresh, and accessibility using representative contract-shaped test data. Provider credentials, supported-city lookup, canonical city IDs, external hours, caching, and any changed API contract need coordination with Brooklyn. Firestore security rules still apply while the current implementation reads Firestore from the client; having an API abstraction alone does not replace those rules.

Scan the local Expo QR on the same Wi-Fi. The current address is `exp://192.168.1.71:8081`; the address must be refreshed if the Mac changes networks. Metro runs with `CI=1` because native file watching exceeds this host's limit; source changes require restarting Metro. The local Auth emulator runs on 9099 and Firestore on 8080. Neither requires a deployment for this test.

Expo CLI and Expo Go must use the same Expo account (`neeyuh`). Signing into Expo is separate from creating a local test account inside Roami. Keep the Mac awake while testing. Startup requires Node 24, the installed mobile/backend dependencies, local Auth/Firestore emulators, and the ignored local mobile environment configuration. The local seed command is `npm --prefix backend run seed`; do not seed a production database.

Roami restores a saved Firebase session, so reopening the app may skip the sign-in page. Use Sign out at the top right of Explore to see it. For `auth/invalid-refresh-token` during emulator testing, sign out of Roami, create/sign into a local test account, and reopen Expo Go. Use a throwaway test password in the local emulator. The production login sends passwords to Firebase Authentication; Firestore profile writes contain only id, name, bio, interests, and createdAt.

## Device checks still required

Use a small iPhone and a larger device; repeat with large accessibility text and VoiceOver:

1. Sign in to the local test account using the team's original login screen.
2. Pan and zoom the map, type a search, clear it, change categories, and expand/collapse the panel. Check responsiveness, camera position, and absence of duplicate marker captions.
3. Tap a pin with a long place name. Scroll all details and recommendations, save the place and a tip separately, and return to results.
4. Open a postcard's place. Verify that its exact recommendation is highlighted. Add it to a trip day, reopen the trip, and check the stored recommendation IDs. Repeat from Saved and after a failed write.
5. Check focus order, spoken button labels, keyboard dismissal, and bottom safe areas across the other screens. Automated tests do not prove native layout or VoiceOver behavior.
6. Pull down at the top of each tab's scrollable list, including empty lists, and inside Explore's place details. Confirm fresh data, a stopping refresh indicator, and recovery after a connection failure. Dragging the map itself should continue to pan the map.

## Release requirements

For any future release, the updated Firestore rules must accompany the application. No release is authorized. The optional `candidateRecommendationIds` trip field stores recommendation sources for suggestions and generated plans; existing trips without the field still load. Older deployed rules reject suggestion writes containing this new field. The rules retain owner-only writes and private trip access.

No physical-device performance, layout, or screen-reader pass is claimed. The development host has no iOS Simulator available. The emulators and Expo server are available for phone testing. The backend CI job is configured but has not run remotely.

The user explicitly directed that all code stay local. Do not push, publish, open a PR, or deploy. The eight tracker rows were previously marked in progress; no additional shared tracker updates were made during this local testing pass.
