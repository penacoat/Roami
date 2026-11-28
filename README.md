# Roami

Roami is an iOS mobile app built with React Native and Expo for social travel discovery and planning, aimed at university students exploring an unfamiliar city. Users can search for places, explore recommendations on a map, save places, and plan trips. Seattle is the seeded demo city; trusted catalog editors can trigger imports of other cities from OpenStreetMap in Explore.

**Want to try the app on an iPhone?** See [Trying Roami](docs/trying-roami.md) for install and sign-in instructions. To check that saves, trips, and notes persist, see the [persistence test plan](docs/persistence-test-plan.md).

**Contents:** [Operational use cases](#operational-use-cases) · [Prerequisites](#prerequisites) · [Build](#build) · [Test](#test) · [Run](#run) · [Quick start](#quick-start) · [Troubleshooting](#troubleshooting) · [Architecture](#architecture) · [Repository layout](#repository-layout) · [Version control/bug tracking/CI](#version-control-bug-tracking-and-ci) · [Team](#team)

## Operational use cases

These are the user flows wired from the app to Firebase. Follow the [Run](#run) steps to exercise them on an iOS Simulator or iPhone.

| Use case                                                       | Status                                                                                                                                                                                                                                                                                                   | How to see it work                                                                                                     |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Sign up/sign in, persist the session, and sign out             | **Operational.** The auth screen uses Firebase Authentication. Sign-up calls `ensureProfile` through `callApi`; the registered profile service writes through its repository to Firestore, subject to Firestore rules.                                                                                   | Start the local emulators and app below, create an account, and check Authentication and Firestore in the Emulator UI. |
| Explore places, search recommendations, and open place details | **Operational.** Explore loads the shared catalog, ranks search results, and supports category and saved-only filters. Importing or refreshing OSM cities is restricted to accounts with the trusted `catalogEditor` claim; all signed-in users can read seeded/imported places. Place details include active recommendations. | In Explore, search for a place or recommendation (for example, `jazz`), change category/saved filters, and open a pin. |
| Save and unsave a place or recommendation                      | **Operational.** Explore and Saved use live Firestore-backed save services. Personal saved-place notes are not editable in the UI.                                                                                                                                                                       | Save a place or recommendation from Explore, then open Saved. Unsave from either screen.                               |
| Browse recommendation postcards                                | **Operational.** The Postcards tab reads the live feed for the selected city; cards can be flipped and “See place” opens the matching Explore details. Saving a recommendation is available from the details view.                                                                                       | Open Postcards, choose a city, flip a card, tap See place, then inspect or save the recommendation.                    |
| Follow contributors and browse their recommendations           | **Operational.** Signed-in users can follow/unfollow postcard authors; the Following feed includes only followed contributors' recommendations for the selected city. Users cannot follow themselves.                                                                                                    | Open Postcards, select Following, then follow or unfollow a contributor from a card.                                   |
| Create trips and manage itineraries                            | **Operational.** Create and open trips; add places or fixed activities; view by day, calendar, or map; generate and compare itinerary options; set times; move/reorder or remove stops; archive and restore trips. Legacy trips without preferences remain supported.                                    | Create a trip from Itineraries, add catalog places, create a fixed activity, and archive/restore a trip.               |
| Set trip starting point and walking preference                 | **Operational as stored preferences.** Trip creation accepts a label-only starting location and a maximum walking distance or duration; the itinerary displays them. Optional coordinates are supported by the model/API, not collected in UI. Walking routes and limits are not calculated or enforced. | Create a trip with a starting location and/or walking preference, then view its itinerary.                             |
| View current/upcoming trip dashboard                           | **Operational.** Home shows the user's current or next trip, dates, today's stops, and upcoming activities, with empty, loading, error, and retry states.                                                                                                                                                | Open the Home tab and use Open itinerary.                                                                              |
| Record visits and personal place rankings                      | **Operational.** Users can mark a place visited and maintain their own category rankings from place details, itinerary stops, and the Saved journal. These are personal records, not a global leaderboard.                                                                                               | Open place details or Saved, then use the visit/journal controls.                                                      |
| Edit a profile                                                 | **API service only.** `getProfile` and `updateProfile` are registered, but the Profile tab currently exposes sign-out only. Sign-up creates a basic profile.                                                                                                                                             | Profile editing is not available in the app.                                                                           |
| Add, edit, or clear a private saved-place note                 | **Operational.** Saved uses the live `updateSavedNote` service; notes are private to the owner under Firestore rules.                                                                                                                                                                                    | Open Saved, add or edit a note, then clear it by saving an empty note.                                                 |
| Create a recommendation                                        | **API service only.** `createRecommendation` writes through its registered service, but there is no contribution screen.                                                                                                                                                                                 | No contribution flow is available.                                                                                     |
| Other social features                                          | **Not available as app features.** Likes, comments, collections, blocks, and reports have models and/or Firestore rules but no corresponding app flows.                                                                                                                                                  | Not available in the app.                                                                                              |

### API registration and screen call sites

Every app API call used in live mode has a registered handler in `registerServices()`. Registration alone does not make a use case operational: a screen must call the handler. “Developer check only” refers to `backendCheck.ts`, which is not presented by the running app. Expo Router connects Home, Explore, Postcards, Itineraries, and Saved after sign-in; trip creation and itinerary details are protected routes.

| API call                                                        | Real service registered? | Screen/component call site                           |
| --------------------------------------------------------------- | -----------------------: | ---------------------------------------------------- |
| `ensureProfile`                                                 |                      Yes | Sign-up and app root                                 |
| `getProfile`, `updateProfile`                                   |                      Yes | Developer check only                                 |
| `resolveCity`, `listPlaces`, `searchRecommendations`            |                      Yes | Explore                                              |
| `getPlace`                                                      |                      Yes | Explore place details                                |
| `getFeed`                                                       |                      Yes | Postcards (Everyone or Following)                    |
| `getFollowing`, `followUser`, `unfollowUser`                    |                      Yes | Postcards                                            |
| `createRecommendation`                                          |                      Yes | No contribution screen                               |
| `savePlace`, `listSavedPlaces`, `removeSavedPlace`              |                      Yes | Explore, place details, and Saved                    |
| `updateSavedNote`                                               |                      Yes | Saved                                                |
| `createTrip`                                                    |                      Yes | Itineraries                                          |
| `listTrips`, `getTrip`                                          |                      Yes | Itineraries, trip details, and Add to itinerary      |
| `addStop`                                                       |                      Yes | Add to itinerary from Explore/place details or Saved |
| `deleteTrip`, `setTripArchived`                                 |                      Yes | Itineraries and trip details                         |
| `moveStop`, `removeStop`, `updateStopTime`, `updateStopDetails` |                      Yes | Itinerary details                                    |
| `addFixedActivity`, `applyItinerary`                            |                      Yes | Itinerary details                                    |
| `addCandidate`                                                  |                      Yes | Add to itinerary                                     |
| `removeCandidate`                                               |                      Yes | Developer check only                                 |
| `listPreparation`, `savePreparation`, `removePreparation`       |                      Yes | Itinerary preparation checklist                      |
| `getPlaceJournal`, `markVisited`, `saveRanking`                 |                      Yes | Place details, itinerary, and Saved journal          |

Starting locations are label-only in the trip-creation UI; coordinates are optional in the shared model but not collected there. Walking preferences are persisted and displayed only; no routing, walking-time calculation, or enforcement is implemented.

The local seed contains **2 users, 50 places, and 75 recommendations**. Coordinates are approximate sample pins; opening hours and walking times are unknown; recommendation text is illustrative, not user-submitted reviews. Sample postcards use illustrative photos. Seattle is the seeded catalog; other cities can be imported from OpenStreetMap. Fixture mode keeps app data in memory; use live mode with Firebase for persistence.

## Prerequisites

| Tool                | Needed for                            | Version/setup                                                                                                                                                |
| ------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Node.js and npm     | Install, build, test, and run         | Use Node **24.x**. `backend/package.json` declares Node 24 and CI uses Node 24. There is no root `.nvmrc`; `mobile/package.json` does not declare an engine. |
| Java JDK            | Firebase Auth and Firestore emulators | **Java 21 or newer.** The Firebase CLI used here no longer supports Java versions below 21.                                                                  |
| Git                 | Clone and contribute                  | Current Git                                                                                                                                                  |
| macOS with Xcode    | iOS Simulator                         | Install Xcode and its command-line tools. Not required when using a physical iPhone with Expo Go.                                                            |
| iPhone with Expo Go | Run on a physical iOS device          | Install the current Expo Go app from the App Store.                                                                                                          |

On macOS, install a Java 21 JDK (for example, [Eclipse Temurin 21](https://adoptium.net/temurin/releases/?version=21)). In a new terminal, set and verify `JAVA_HOME`:

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
java -version
echo "$JAVA_HOME"
```

If that works, add the `JAVA_HOME` export to your shell profile (for example, `~/.zshrc`) so new terminals also use Java 21. A Firebase account or global Firebase CLI install is not required for local build, tests, or emulator use; `npx` downloads the CLI when needed.

Clone the repository:

```bash
git clone https://github.com/penacoat/Roami.git
cd Roami
```

## Build

Run from the repository root. Each app/package has its own lockfile; there is no root `package.json`.

```bash
npm --prefix mobile ci
npm --prefix backend ci
npm --prefix mobile run typecheck
npm --prefix backend run build
```

Expo bundles the app when it runs. To build and launch the native iOS app in the Simulator, use `npm --prefix mobile run ios` on a Mac with Xcode; for Expo Go, use the [Run](#run) steps instead. The backend build compiles the TypeScript seed/tooling sources.

## Test

### Mobile checks

These are the checks run by the mobile CI workflow:

```bash
npm --prefix mobile run lint
npm --prefix mobile run format:check
npm --prefix mobile run typecheck
npm --prefix mobile run test:ci
```

Expected: **50 suites, 451 tests passing**.

### Backend unit tests without emulators

The seed-data, seed-search, and seed-safety tests do not need a running Firebase emulator:

```bash
npm --prefix backend run test:rules -- --runInBand test/seedData.test.ts test/seedSearch.test.ts test/seedSafety.test.ts
```

Expected: **3 suites, 22 tests passing**.

### Backend emulator tests

Expected: **7 suites, 173 tests passing**. The complete suite includes Firestore rules, recommendation/seed integration, and seed unit tests. It runs against local Auth and Firestore emulators; Java 21 or newer is required:

```bash
npx --yes firebase-tools@15.37.0 emulators:exec --only auth,firestore "npm --prefix backend run test:rules -- --runInBand --testTimeout=60000"
```

The `PERMISSION_DENIED` console warnings are expected. They come from tests that check the rules reject unauthorized writes.

## Run

The app's live flows use local Firebase Authentication and Firestore emulators. Emulator data is local and is cleared when an emulator is restarted.

1. **Start only the emulators the app uses.** From the repository root, leave this terminal running:

   ```bash
   npx --yes firebase-tools emulators:start --only auth,firestore
   ```

   Firebase config assigns Auth port **9099** and Firestore port **8080**. The Emulator UI defaults to `http://127.0.0.1:4000`.

2. **Seed demo data.** In another repository-root terminal, run after each emulator restart:

   ```bash
   npm --prefix backend run seed
   ```

   The package script builds the seed code and sets `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` for the seed process, so no manual export is needed. The seed script refuses non-local emulator addresses. It uses deterministic IDs, so rerunning it replaces the same documents rather than duplicating them.

3. **Configure the mobile app.** Create `mobile/.env` (do not commit it). For the local emulator demo, use:

   ```dotenv
   EXPO_PUBLIC_FIREBASE_API_KEY=demo-api-key
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=roami-7c0bd
   EXPO_PUBLIC_API_MODE=live
   EXPO_PUBLIC_EMULATOR_HOST=127.0.0.1
   ```

   The local emulator demo needs those four values. The demo API key is not a secret and is not validated by the emulators. The project ID must match the emulator/seed configuration. `EXPO_PUBLIC_EMULATOR_HOST` is used for both Auth (`9099`) and Firestore (`8080`).

   For an iOS Simulator on the same Mac, keep `127.0.0.1`. For a physical iPhone, set the host to the Mac's current network IP (on many Macs, `ipconfig getifaddr en0`) and keep the phone and computer on the same Wi-Fi. The address can change when Wi-Fi changes; update `.env` and restart Expo when it does.

   `mobile/.env.example` also lists the Firebase configuration keys used when connecting to a real Firebase project: `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`, `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`, `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, and `EXPO_PUBLIC_FIREBASE_APP_ID`. The app also reads `EXPO_PUBLIC_FRONTEND_PREVIEW`; set it to `true` to bypass sign-in and Firebase and use fixture data only. Do not enable preview mode for emulator-backed persistence.

4. **Start Expo.** From the repository root:

   ```bash
   npm --prefix mobile start -- --clear
   ```

   Press `i` for the iOS Simulator, or scan the QR code with the iPhone Camera app to open Expo Go. Use a Mac with Xcode for the Simulator.

5. **Exercise the operational flows.** Create an account, then use Explore, Postcards, Itineraries, and Saved. In Postcards, flip a card and tap See place to open its Explore details; save it or add it to an itinerary. Explore and Saved also expose Add to itinerary for catalog places. Create an itinerary, choose a day and optionally a visit time for the place, then open the itinerary to view stops by day, set/change/clear times, move stops between days, or remove them. Saving and unsaving work in Explore and Saved. In the Emulator UI, inspect Authentication and Firestore to confirm the writes.

   To test importing a city that is not already in the catalog, first create a user, copy its UID from the Auth Emulator UI, then grant the editor claim in another repository-root terminal:

   ```bash
   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
     ROAMI_ADMIN_PROJECT_ID=roami-7c0bd \
     npm --prefix backend run set-catalog-editor -- <user-uid> grant
   ```

   Sign out and back in so the app receives the updated token. Do not grant catalog editor access broadly in a real project; see [the city import guide](docs/city-import.md).

To run against the team's real Firebase project instead, copy `mobile/.env.example` to `mobile/.env`, fill in its Firebase values from the team's [living document](https://docs.google.com/document/d/1Kz8SdI8w7-ivWgA3terH4hSaZwHyNAZs51WpcsMWDO0/edit?usp=sharing), leave `EXPO_PUBLIC_EMULATOR_HOST` empty, and use the intended API mode. Never commit `.env`.

## Quick start

After cloning, installing dependencies, and configuring Java 21+, use three terminals from the repository root:

```bash
# Terminal 1
npx --yes firebase-tools emulators:start --only auth,firestore
```

```bash
# Terminal 2 (after the emulators are ready; repeat after emulator restarts)
npm --prefix backend run seed
```

Create `mobile/.env` with the four demo values shown in [Run](#run), then:

```bash
# Terminal 3
npm --prefix mobile start -- --clear
```

The iOS Simulator uses `127.0.0.1`; a physical phone needs the Mac's reachable network IP in `.env`. Keep the phone and computer on the same Wi-Fi and allow Expo Go to access the local network.

## Troubleshooting

| Symptom                                                  | Fix                                                                                                                                                                                                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Firebase CLI says Java is too old or cannot find Java 21 | Install JDK 21+, set `JAVA_HOME=$(/usr/libexec/java_home -v 21)`, open a new terminal, and check `java -version`.                                                                                                                     |
| Sign-in reports `auth/invalid-refresh-token`             | Sign out and sign in again to refresh the persisted session. If the stale session remains, clear Expo Go's app storage and sign in again.                                                                                             |
| Sign-in spins, or the app reports a network error        | Confirm Auth and Firestore emulators are running on 9099 and 8080. Confirm `EXPO_PUBLIC_EMULATOR_HOST` is reachable from the device. Restart Expo with `--clear`.                                                                     |
| Expo Go says the project needs a newer version           | Update Expo Go from the App Store, then restart the project with `npm --prefix mobile start -- --clear`.                                                                                                                              |
| Works in Simulator but not on an iPhone                  | `127.0.0.1` points to the phone itself. Set `EXPO_PUBLIC_EMULATOR_HOST` to the Mac's current Wi-Fi/LAN IP, ensure both devices share a network that permits peer connections, and restart Expo. Re-check the IP after changing Wi-Fi. |
| Explore shows fixture/demo data or saves are temporary   | Check `EXPO_PUBLIC_API_MODE=live`, ensure `EXPO_PUBLIC_FRONTEND_PREVIEW` is not `true`, and confirm the file is exactly `mobile/.env`; restart Expo with `--clear`.                                                                   |
| Seattle places are missing                               | Restarting the emulator clears its data. Run `npm --prefix backend run seed` again.                                                                                                                                                   |
| Port 8080 or 9099 is already in use                      | Stop the other emulator process, then restart the emulator command.                                                                                                                                                                   |
| `npm` reports a missing lockfile/package after pulling   | From the repository root, run `npm --prefix mobile ci` and `npm --prefix backend ci` again. Do not run `npm ci` at the repository root; it has no root package manifest.                                                              |

## Architecture

The app uses Firebase Authentication and Cloud Firestore directly through the Firebase client SDK. There is no separate HTTP application server in the app request path. `backend/` contains the seed script, tests, and TypeScript tooling. The project does not use Cloud Functions; the local flows and instructions here use only the Auth and Firestore emulators.

The intended data path is:

```text
Screen → callApi(name, request) → registered service → repository → Firestore
```

- **Screens** use `callApi` for app data calls; authentication uses Firebase Authentication.
- **`callApi`** checks calls against the contract in `shared/src/api.ts`. In `live` mode it invokes a registered handler; an unregistered handler falls back to fixtures.
- **Services** in `mobile/src/services/` validate requests and coordinate repositories and pure logic.
- **Repositories** in `mobile/src/repositories/` access Firestore.
- **Pure logic** in `mobile/src/logic/` contains search matching and trip validation.
- **Shared types** in `shared/src/` define API requests/responses and data models.
- **`firestore.rules`** enforces server-side access and write constraints.

ESLint checks the intended layering; see [docs/coding-guidelines.md](docs/coding-guidelines.md). More developer references: [where code goes](docs/where-code-goes.md), [shared models](docs/shared-models.md), and [city import and catalog editor setup](docs/city-import.md). The setup guides in `docs/mobile-app-setup.md` and `docs/firebase-setup.md` contain stale SDK, Node, or Functions instructions; use this README for current installation, emulator, and run steps.

Native map tiles, gestures, keyboard behavior, and tab/panel layout still need an iPhone or simulator check; browser review uses a labeled map substitute. Seattle is the seeded demo city; other cities rely on OpenStreetMap imports. Walking preferences are stored but do not produce or constrain routes. Profile editing, recommendation contribution, likes, comments, collections, blocks, and reports are not exposed as app features. Visits, personal place rankings, and private saved-place notes are available. Some itinerary validation lives in client code. Values bundled into a mobile app (including Firebase client configuration) are public; access control belongs in Firestore rules. Search caches each city's data for 60 seconds.

## Repository layout

```text
Roami/
├── mobile/
│   ├── App.tsx
│   ├── src/
│   │   ├── app/                 # Protected sign-in, tabs, trip creation, and itinerary details
│   │   ├── api/                 # API client and fixture handlers
│   │   ├── auth/                # Authentication UI and Firebase Auth
│   │   ├── components/          # Recommendation and itinerary UI components
│   │   ├── dev/                 # Developer checks (not mounted in the app)
│   │   ├── logic/               # Pure search and trip logic
│   │   ├── repositories/        # Firestore data access
│   │   ├── screens/             # Home, Explore, Saved, Postcards, and itinerary screens
│   │   └── services/            # Registered live API handlers
│   ├── __tests__/               # Jest tests
│   ├── test-utils/              # In-memory Firestore test helper
│   ├── package.json
│   └── .env.example
├── backend/
│   ├── src/scripts/             # Seed data and emulator seed command
│   ├── test/                    # Rules and integration/unit tests
│   ├── package.json
│   └── tsconfig.json
├── shared/src/                  # API contract, models, and views
├── docs/                        # Setup and contributor guides
├── .github/workflows/           # GitHub Actions CI
├── firestore.rules
├── firestore.indexes.json
└── firebase.json
```

The generated backend build output is not source and is omitted from this tree.

## Version control, bug tracking, and CI

- **Version control:** Work on a branch; do not commit directly to `main`. Use a branch such as `<github-username>/<short-description>` (for example, `bhelle/trips`) and open a pull request for review. The README documents this team practice; no claim is made here about GitHub branch-protection settings.
- **Bug tracking:** Report defects in [GitHub Issues](https://github.com/penacoat/Roami/issues), including reproduction steps and expected/actual behavior. Link the fixing pull request to its issue (for example, `Fixes #12`).
- **Build and testing:** Follow the [Build](#build) and [Test](#test) commands. Run formatting and lint checks before opening a pull request.
- **CI:** [`.github/workflows/mobile-ci.yml`](.github/workflows/mobile-ci.yml) runs on pushes to `main` and pull requests targeting `main`. It uses Node 24 and runs `npm ci`, mobile lint, Prettier format check, TypeScript typecheck, and `npm run test:ci`. A separate backend job installs both dependency trees, builds the backend, and runs its Jest and Firestore rules tests with Java 21 and the Auth/Firestore emulators.

Contributor notes: import shared types with `import type`; prefer additive changes to shared contracts; represent unknown values as `null` rather than `0` or “closed”; and never commit `.env`, service-account keys, `node_modules/`, or debug logs. Do not run `npm audit fix --force`.

## Team

| Name            | Role                             |
| --------------- | -------------------------------- |
| Antonia Kwan    | Project Manager, UI and frontend |
| Ameli Graff     | UI and frontend                  |
| Athena Bao      | UX research, frontend            |
| Rui Chu         | Scrum Master, backend            |
| Penelope Coates | Backup Scrum Master, backend     |
| Brooklyn Helle  | Backend                          |

Living document (requirements, design, and process): [Google Docs](https://docs.google.com/document/d/1Kz8SdI8w7-ivWgA3terH4hSaZwHyNAZs51WpcsMWDO0/edit?usp=sharing).
