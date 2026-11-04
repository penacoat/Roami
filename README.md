# Roami

Roami is an iOS app built with React Native for social travel discovery and planning, aimed at university students exploring an unfamiliar city. Users can search for something specific, explore recommendations on a map, and save places for later. The current demo is focused on Seattle.

**Contents:** [Operational use cases](#operational-use-cases) · [Prerequisites](#prerequisites) · [Build](#build) · [Test](#test) · [Run](#run) · [Quick start](#quick-start) · [Troubleshooting](#troubleshooting) · [Architecture](#architecture) · [Repository layout](#repository-layout) · [Version control/bug tracking/CI](#version-control-bug-tracking-and-ci) · [Team](#team)

## Operational use cases

These are the user flows wired from the app to Firebase. Follow the [Run](#run) steps to exercise them on an iOS Simulator or iPhone.

| Use case                                                               | Status                                                                                                                                                                                                                 | How to see it work                                                                                                     |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Sign up/sign in, persist the session, and sign out                     | **Operational.** The auth screen uses Firebase Authentication. Sign-up calls `ensureProfile` through `callApi`; the registered profile service writes through its repository to Firestore, subject to Firestore rules. | Start the local emulators and app below, create an account, and check Authentication and Firestore in the Emulator UI. |
| Explore Seattle places, search recommendations, and open place details | **Operational.** The Explore map calls the live place, search, and details services; they read the seeded Firestore data through repositories.                                                                         | In Explore, pan/zoom the map, tap a pin, open the places panel, and search (for example, `jazz`).                      |
| Save and unsave a place or recommendation                              | **Operational.** Explore reads and writes saved places using the registered save services, Firestore repositories, and rules.                                                                                          | Save a place or a recommendation from its details, then use the Saved filter; unsave it to remove it.                  |
| Edit a profile or saved-place note                                     | **Not exposed in the app.** The API handlers are registered and their services write to Firestore, but there is no user-facing editor.                                                                                 | No app screen currently exercises these flows.                                                                         |
| Browse a recommendation feed                                           | **Connected.** The Postcards tab uses `getFeed`; See place opens the matching Explore details.                                                                | Open Postcards, flip a card, then tap See place to inspect or save its place in Explore.                                                                             |
| Create a recommendation                                                | **Not operational as an app flow.** The real handler and repository path exist and have integration tests, but no contribution screen calls it.                                                                        | No contribution screen currently exists.                                                                               |
| Create, view, or edit trips and itinerary stops                        | **Trip creation is connected.** The New trip tab saves city, dates, and daily planning hours. Viewing existing trips or adding/editing/reordering itinerary stops is not exposed.                                                                                                          | Use New trip to create a trip and view its confirmation; itinerary editing is not available.                                                                                           |
| Share collections                                                      | **Not operational as an app flow.** There is no collection API call or app flow for sharing.                                                                                                                           | Not available in the app.                                                                                              |

### API registration and screen call sites

All 20 functions in the shared API contract have real handlers registered by `registerServices()`. Registration alone does not make a use case operational: the screen must also be reachable and call the handler. “Developer check only” refers to `backendCheck.ts`, which is not presented by the running app. `PlacesCheck` has no route from the app. Expo Router connects Explore, Postcards, and New trip after sign-in; sign-out removes access to all three tabs.

| API call                | Real service registered? | Screen/component call site       |
| ----------------------- | -----------------------: | -------------------------------- |
| `ensureProfile`         |                      Yes | Auth screen and app root         |
| `getProfile`            |                      Yes | Developer check only             |
| `updateProfile`         |                      Yes | Developer check only             |
| `listPlaces`            |                      Yes | Explore map                      |
| `getPlace`              |                      Yes | Place details shown from Explore |
| `getFeed`               |                      Yes | Postcards tab |
| `searchRecommendations` |                      Yes | Explore map                      |
| `createRecommendation`  |                      Yes | None                             |
| `savePlace`             |                      Yes | Explore map/place details        |
| `listSavedPlaces`       |                      Yes | Explore map                      |
| `updateSavedNote`       |                      Yes | Developer check only             |
| `removeSavedPlace`      |                      Yes | Explore map/place details        |
| `createTrip`            |                      Yes | New trip tab             |
| `listTrips`             |                      Yes | Developer check only             |
| `getTrip`               |                      Yes | Developer check only             |
| `addCandidate`          |                      Yes | Developer check only             |
| `removeCandidate`       |                      Yes | None                             |
| `addStop`               |                      Yes | Developer check only             |
| `moveStop`              |                      Yes | Developer check only             |
| `removeStop`            |                      Yes | Developer check only             |

The local seed contains **2 users, 50 places, and 75 recommendations**. These counts are asserted in seed tests. Coordinates are approximate demo pins, opening hours are unknown, and recommendation text is illustrative rather than user-submitted reviews.

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

Expo bundles the app when it runs; there is no separate mobile compile script. The backend build compiles the TypeScript seed/tooling sources.

## Test

### Mobile checks

These are the checks run by the mobile CI workflow:

```bash
npm --prefix mobile run lint
npm --prefix mobile run format:check
npm --prefix mobile run typecheck
npm --prefix mobile run test:ci
```

Expected: **19 suites, 161 tests passing**.

### Backend unit tests without emulators

The seed-data, seed-search, and seed-safety tests do not need a running Firebase emulator:

```bash
npm --prefix backend run test:rules -- --runInBand test/seedData.test.ts test/seedSearch.test.ts test/seedSafety.test.ts
```

Expected: **3 suites, 22 tests passing**.

### Backend emulator tests

Expected: **6 suites, 124 tests passing** (about 20 seconds). The suite includes 98 Firestore Rules tests, 3 recommendation-service integration tests, 1 seed integration test, and the 22 no-emulator unit tests listed above. The first 102 tests require local Auth and Firestore emulators; Java 21 or newer is required:

```bash
npx --yes firebase-tools emulators:exec --only auth,firestore "npm --prefix backend run test:rules -- --runInBand"
```

The `PERMISSION_DENIED` console warnings are expected. They come from tests that check the rules reject unauthorized writes.

## Run

The app's live flows use local Firebase Authentication and Firestore emulators. Emulator data is local and is cleared when an emulator is restarted.

1. **Start only the emulators the app uses.** From the repository root, leave this terminal running:

   ```bash
   npx --yes firebase-tools emulators:start --only auth,firestore
   ```

   Firebase config assigns Auth port **9099** and Firestore port **8080**. The Emulator UI defaults to `http://127.0.0.1:4000`. The Functions emulator is configured in `firebase.json`, but the app flow does not need it.

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

   `mobile/.env.example` also lists the optional real-Firebase configuration keys: `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`, `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`, `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, and `EXPO_PUBLIC_FIREBASE_APP_ID`. The complete set of source-read variables is those four plus `EXPO_PUBLIC_FIREBASE_API_KEY`, `EXPO_PUBLIC_FIREBASE_PROJECT_ID`, `EXPO_PUBLIC_API_MODE`, and `EXPO_PUBLIC_EMULATOR_HOST`.

4. **Start Expo.** From the repository root:

   ```bash
   npm --prefix mobile start -- --clear
   ```

   Press `i` for the iOS Simulator, or scan the QR code with the iPhone Camera app to open Expo Go. Use a Mac with Xcode for the Simulator.

5. **Exercise the operational flows.** Create an account, then use the Explore, Postcards, and New trip tabs. In Postcards, flip a card and tap See place to open its Explore details; save it, close details, and use Saved. Tabs retain the current screen state; See place clears conflicting map filters and opens the Seattle catalog. Search and save/unsave also work directly in Explore. New trip uses Athena Bao’s existing trip-creation UI (from `setup-ci` at `f83515c`) adapted to call the shared `createTrip` service. Choose a city, start/end dates, and daily hours; submit to save a trip. This does not add the saved place to that trip or schedule any stops. In the Emulator UI, inspect Authentication and Firestore to confirm the writes.

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

The iOS Simulator uses `127.0.0.1`; a physical phone needs the Mac's reachable network IP in `.env`.

## Troubleshooting

| Symptom                                                  | Fix                                                                                                                                                                                                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Firebase CLI says Java is too old or cannot find Java 21 | Install JDK 21+, set `JAVA_HOME=$(/usr/libexec/java_home -v 21)`, open a new terminal, and check `java -version`.                                                                                                                     |
| Sign-in reports `auth/invalid-refresh-token`             | Sign out and sign in again to refresh the persisted session. If the stale session remains, clear Expo Go's app storage and sign in again.                                                                                             |
| Sign-in spins, or the app reports a network error        | Confirm Auth and Firestore emulators are running on 9099 and 8080. Confirm `EXPO_PUBLIC_EMULATOR_HOST` is reachable from the device. Restart Expo with `--clear`.                                                                     |
| Expo Go says the project needs a newer version           | Update Expo Go from the App Store, then restart the project with `npm --prefix mobile start -- --clear`.                                                                                                                              |
| Works in Simulator but not on an iPhone                  | `127.0.0.1` points to the phone itself. Set `EXPO_PUBLIC_EMULATOR_HOST` to the Mac's current Wi-Fi/LAN IP, ensure both devices share a network that permits peer connections, and restart Expo. Re-check the IP after changing Wi-Fi. |
| Explore shows fixture/demo data or saves are temporary   | Check `EXPO_PUBLIC_API_MODE=live` and that the file is exactly `mobile/.env`; restart Expo with `--clear`.                                                                                                                            |
| Seattle places are missing                               | Restarting the emulator clears its data. Run `npm --prefix backend run seed` again.                                                                                                                                                   |
| Port 8080 or 9099 is already in use                      | Stop the other emulator process, then restart the emulator command.                                                                                                                                                                   |
| `npm` reports a missing lockfile/package after pulling   | From the repository root, run `npm --prefix mobile ci` and `npm --prefix backend ci` again. Do not run `npm ci` at the repository root; it has no root package manifest.                                                              |

## Architecture

The app uses Firebase Authentication and Cloud Firestore directly through the Firebase client SDK. There is no separate HTTP application server in the app request path. `backend/` contains the seed script, tests, and TypeScript tooling; `firebase.json` also has a Functions emulator configuration, but the app's local flows and instructions here use only Auth and Firestore.

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

ESLint checks the intended layering; see [docs/coding-guidelines.md](docs/coding-guidelines.md). More developer references: [where code goes](docs/where-code-goes.md), [shared models](docs/shared-models.md), [Firebase setup](docs/firebase-setup.md), and [mobile setup](docs/mobile-app-setup.md).

Native map tiles, gestures, keyboard behavior, and tab/panel layout still need an iPhone or simulator check. Browser review uses a labeled map substitute. The catalog is Seattle-only; a Los Angeles search is empty. Trip list/itinerary editing and recommendation contribution screens are not wired. Other limitations include no in-app moderation, and some itinerary validation living in client code. Values bundled into a mobile app (including Firebase client configuration) are public; access control belongs in Firestore rules. Search caches each city's data for 60 seconds.

## Repository layout

```text
Roami/
├── mobile/
│   ├── App.tsx
│   ├── src/
│   │   ├── app/                 # Protected sign-in and Explore/Postcards/New trip routes
│   │   ├── api/                 # API client and fixture handlers
│   │   ├── auth/                # Authentication UI and Firebase Auth
│   │   ├── components/          # Recommendation UI components
│   │   ├── dev/                 # Developer checks (not mounted in the app)
│   │   ├── logic/               # Pure search and trip logic
│   │   ├── repositories/        # Firestore data access
│   │   ├── screens/             # Explore map and map subcomponents
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
- **CI:** [`.github/workflows/mobile-ci.yml`](.github/workflows/mobile-ci.yml) runs on pushes to `main` and pull requests targeting `main`. It uses Node 24 and runs `npm ci`, mobile lint, Prettier format check, TypeScript typecheck, and `npm run test:ci`. It does **not** run the backend build or emulator-backed backend tests; run those locally as documented above.

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
