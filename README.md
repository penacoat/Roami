# Roami

Roami is an iOS app for social travel discovery and planning, aimed at university students exploring an unfamiliar city. Users can search for something specific, explore recommendations on a map, and save places. They can then turn those places into an itinerary. Recommendations show who suggested a place and what they liked about it, and that context stays attached as places move into a trip.

The MVP covers Pike Place Market and nearby downtown Seattle.

**Contents:** [Status](#status) · [Prerequisites](#prerequisites) · [Build](#build) · [Test](#test) · [Run](#run) · [Architecture](#architecture) · [Repository layout](#repository-layout) · [Bug tracking](#bug-tracking) · [Team workflow](#team-workflow)

## Status

_Explore-only demo branch; native device validation is pending._

| Use case | Status |
|---|---|
| Create an account, sign in, stay signed in, sign out | **Operational.** Signing up also creates the user's public profile in Firestore (`ensureProfile`, `getProfile`, `updateProfile`). |
| Discover places that match an interest (search, map) | In progress. The data layer is live: search, the place list, place details, and the feed (`searchRecommendations`, `listPlaces`, `getPlace`, `getFeed`). Search matches tags and written text, including synonyms and prefixes, skips negations such as "no longer has jazz", and explains each match. Explore now connects search, catalog pins, and place details. |
| Save a place for later | In progress. The data layer is live (`savePlace`, `listSavedPlaces`, `updateSavedNote`, `removeSavedPlace`): one entry per place, each recommendation that led to it kept as a source, and a personal note. Explore includes a Saved filter and save/unsave controls; note editing is not exposed. |
| Create an itinerary | In progress. The data layer is live: creating, listing, and opening trips, and adding candidates and stops (`createTrip`, `listTrips`, `getTrip`, `addCandidate`, `addStop`). No trip screens yet. |
| Adjust an existing itinerary | In progress. The data layer is live: moving and removing stops (`moveStop`, `removeStop`), with out-of-date edits refused. No trip screens yet. |
| Share a recommendation collection | Not started. Rules now support owner-managed collections; the app flow is not wired yet. |
| Rank and recommend a visited place | In progress. `createRecommendation` now writes through the live API; visit/ranking flows and contribution UI are not wired yet. |

**The operational use case touches every major component.** Signing up goes from the sign-up screen to Firebase Authentication, then through the API layer (`callApi('ensureProfile')`) to a service, a repository, and Cloud Firestore, where the security rules check the write.

**To see the rest of the backend working,** sign in and tap **Run backend check** on the home screen. It exercises profiles, places, feed, search, saved places, and trips through the same API layer the screens use, and shows PASS or FAIL for each step. All 20 API calls now have live handlers, including `createRecommendation`; there is not yet a contribution screen or backend-check step for creating recommendations.
**This branch demonstrates Explore only:** existing sign-in → Explore → sign-out. It replaces the developer checklist with the map, without adding navigation tabs or trip screens. The checklist remains in `mobile/src/dev/PlacesCheck.tsx`; backend services and login UI are unchanged.

## Prerequisites

| Tool | Needed for | Check |
|---|---|---|
| [Node.js](https://nodejs.org) 24.x, at least 24.12 (tested: 24.22.2) | Everything | `node -v` |
| Git | Getting the code | `git --version` |
| Java 21 or newer | The Firebase emulators (running the app locally, rules tests) | `java -version` |
| A Mac with Xcode, **or** an iPhone with [Expo Go](https://apps.apple.com/app/expo-go/id982107779) (latest version) | Running the app | |

The Firebase CLI doesn't need a global install: the commands below run it with `npx firebase-tools`. A Firebase account is not needed to build, test, or run the app locally.

Get the code:

```bash
git clone https://github.com/penacoat/Roami.git
cd Roami
```

## Build

Expo bundles the app when it runs, so there is no separate compile step for the app. These commands install the dependencies and check that everything compiles. Run them from the repository root:

```bash
npm --prefix mobile ci            # install the app's dependencies
npm --prefix mobile run typecheck # compile-check the app (TypeScript)
npm --prefix backend ci           # install the emulator tools, seed script, and rules tests
npm --prefix backend run build    # compile the seed script
```

## Test

**App tests** (no setup or Firebase account needed). These run the real services against an in-memory database that imitates the security rules:

```bash
npm --prefix mobile test
```

**Lint, formatting, and type checks:**

```bash
npm --prefix mobile run lint
npm --prefix mobile run format:check
npm --prefix mobile run typecheck
```

**Firestore rules and recommendation integration tests** (101 tests, run against the Firestore and Auth emulators; needs Java 21). Stop any running emulators first, because these need ports 8080 and 9099:

```bash
npx firebase-tools emulators:exec --only auth,firestore "npm --prefix backend run test:rules -- --runInBand"
```

**Continuous integration.** GitHub Actions (`.github/workflows/mobile-ci.yml`) runs lint, the formatting check, the typecheck, and the app tests on every pull request to `main` and every push to `main`. The rules tests are run locally.

## Run

The app runs in Expo Go against the **Firebase emulators** on your computer. This needs no Firebase account or keys, and uses sample data that a seed script loads.

**1. Start the emulators.** After the [Build](#build) steps, in a terminal at the repository root (leave it running):

```bash
npx firebase-tools emulators:start
```

Wait for "All emulators ready." The Emulator UI is at http://127.0.0.1:4000. Warnings about apphosting, hosting, pubsub, and other emulators not running are expected.

**2. Load the sample data.** In a second terminal at the repository root (rerun after every emulator restart):

```bash
npm --prefix backend run seed
```

It prints the seeded counts (2 users, 50 places, and 75 recommendations) and the emulator host. The seed script refuses non-local emulator hosts and uses stable document IDs, so it can safely be rerun. Venue coordinates are approximate demo map pins, hours are unknown, and recommendation text is illustrative guide copy rather than user-submitted reviews or claims of personal experience.

**3. Point the app at the emulators.** Create a file named `mobile/.env` with these four lines:

```
EXPO_PUBLIC_FIREBASE_API_KEY=demo-api-key
EXPO_PUBLIC_FIREBASE_PROJECT_ID=roami-7c0bd
EXPO_PUBLIC_API_MODE=live
EXPO_PUBLIC_EMULATOR_HOST=127.0.0.1
```

The API key can be any text, because the emulators don't check it. Keep the project ID as shown, because the emulators and seed data use it.

- **On the iOS Simulator** (Mac with Xcode), keep `127.0.0.1`.
- **On an iPhone,** replace `127.0.0.1` with your computer's address on the network, from `ipconfig getifaddr en0`. The phone and computer must be on the same Wi-Fi.

**4. Start the app.** In a third terminal:

```bash
cd mobile
npx expo start --clear
```

Press `i` to open the iOS Simulator, or scan the QR code with an iPhone's Camera app to open the app in Expo Go.

**5. Use it.** Tap **New to Roami? Create an account**, then sign up with any name, any email, and a password of 6 or more characters. The account is created in the Auth emulator, and appears in the Emulator UI under Authentication. In Explore:

- Pan/zoom and tap a pin for details. Pull up the places panel for the list; search or use catalog-derived category chips. Seattle has seeded records; other cities may be empty.
- Save a place or recommendation, close details, and select **Saved**. **Saved ✓ · Unsave** removes that saved entry and its recommendation sources/note; the place can be saved again.
- The seven seeded places and eight recommendations are demo content. Coordinates, hours, and recommendation text are unverified; missing source links stay missing. Saves use the local Firestore emulator when `EXPO_PUBLIC_API_MODE=live`.

Before a native demo, check map tiles, pinch/pan, pins, panel dragging, keyboard search, and save/unsave on an iPhone or simulator. Component tests and browser substitutes do not verify native gestures.

### Troubleshooting

| What you see | Fix |
|---|---|
| A spinner for about 8 seconds, then the sign-in screen, or "Network error" on sign-up | The app can't reach the emulators. Check that they're running and that `EXPO_PUBLIC_EMULATOR_HOST` matches `ipconfig getifaddr en0` (it changes when you switch Wi-Fi). Then restart with `npx expo start --clear` and fully close Expo Go. |
| "Demo data · temporary saves" in Explore | `mobile/.env` wasn't picked up. Check it's in the `mobile/` folder, then restart with `npx expo start --clear`. |
| No catalog places for Seattle after clearing filters | The emulators restarted and lost the sample data. Rerun step 2. |
| "Port already in use" when starting the emulators | Another copy is still running. Stop it with Ctrl+C in its terminal. |
| The app doesn't load at all on an iPhone | Some networks block devices from reaching each other. Connect the computer to the phone's Personal Hotspot and use the new address from `ipconfig getifaddr en0`. |

### Team members: using the real Firebase project

To run against the team's Firebase project instead of the emulators, copy `mobile/.env.example` to `mobile/.env`, and fill in the Firebase values from the living document. Leave `EXPO_PUBLIC_EMULATOR_HOST` empty. Never commit `.env`. With `EXPO_PUBLIC_API_MODE` empty, every call returns sample data ("fixtures"), which is useful for building screens.

## Architecture

Roami's backend logic runs inside the app, and the app talks to Firebase Authentication and Cloud Firestore directly. There is no server and no Cloud Functions: the budget is $0, deploying Cloud Functions needs Firebase's paid Blaze plan, and Authentication and Firestore are free at our size (decided October 2026).

Every request follows the same path:

```
Screen → callApi('name', request) → service → repository → Firestore
```

- **Screens** call only `callApi`. They never import Firebase.
- **`callApi`** (`mobile/src/api/`) checks every call against the contract. In live mode it runs the real service; functions without one yet return sample data.
- **Services** (`mobile/src/services/`) check the request, call repositories and pure logic, and return the contract's response type. They throw `ApiError` with a code such as `invalid-argument`, `not-found`, or `aborted`.
- **Repositories** (`mobile/src/repositories/`) are the only code that reads or writes Firestore.
- **Pure logic** (`mobile/src/logic/`) holds search matching and trip validation. Plain data in, plain data out, no Firebase.
- **The contract** (`shared/src/`) defines every call's request and response, and every Firestore document, as TypeScript types.
- **`firestore.rules`** is the only server-side enforcement. It checks identity, ownership, document IDs, field shapes, and that each trip change raises the trip's `revision` by exactly one.

ESLint enforces these layers (see [docs/coding-guidelines.md](docs/coding-guidelines.md)).

**Trade-offs we accepted.**

- **Some checks live only in the app.** The rules can't count stops per day or run the itinerary planner, so a modified app could skip those checks.
- **Nothing in the app is secret.** Anything shipped in the app can be read, including the Firebase web configuration. Data is protected by the security rules.
- **Free-tier limits.** Search caches each city's data for 60 seconds to stay under the daily read quota.
- **Moderation is manual,** through an admin script.
- **Profiles are public.** Rules can't hide individual fields, so profile documents never hold private data such as email.

**Still open:** app distribution. Expo Go is free but needs a computer running `npx expo start`. A standalone app through TestFlight needs the paid Apple Developer Program.

## Repository layout

```
Roami/
├── mobile/                      # The iOS app (Expo + React Native + TypeScript)
│   ├── App.tsx                  # Entry point: sign-in, then the home screen
│   ├── src/
│   │   ├── api/                 # callApi, ApiError, sample data
│   │   ├── services/            # Logic for each component (profiles, places, search, saves, trips)
│   │   ├── repositories/        # Firestore reads and writes
│   │   ├── logic/               # Pure code with no Firebase (search matching, trip validation)
│   │   ├── auth/                # Sign-in: AuthService, AuthProvider, AuthScreens
│   │   └── dev/                 # Temporary developer screen (Load places, Run backend check)
│   ├── __tests__/               # Jest tests
│   ├── test-utils/              # In-memory Firestore for tests, following the security rules
│   └── .env.example             # Environment variables
├── shared/src/                  # The contract: api.ts, views.ts, models.ts (types only)
├── backend/                     # Not a server: rules tests and the seed script
│   ├── test/                    # Security rules tests
│   └── src/scripts/seed.ts      # Loads sample data into the emulator
├── docs/                        # Developer guides
├── firestore.rules              # Security rules
├── firestore.indexes.json       # Firestore indexes
├── firebase.json                # Firebase and emulator configuration
└── .github/workflows/           # CI
```

`backend/src/index.ts` holds an unused `healthCheck` placeholder from before the Cloud Functions decision. Don't add Cloud Functions to it.

## Bug tracking

Bugs are tracked in [GitHub Issues](https://github.com/penacoat/Roami/issues). Each bug report includes:

- **Steps to reproduce** the bug
- **Expected and actual behavior**
- **Labels** for severity (critical to minor) and area (frontend or backend)

The pull request that fixes a bug says which bug it fixes, for example `Fixes #12`, so the issue closes when the fix merges.

## Team workflow

- **Never commit to `main`.** Work on a branch, open a pull request, make sure CI passes, and get a review.
- **Branch names:** `<github-username>/<short-description>`, for example `bhelle/trips`.
- **Before opening a pull request,** run `npm run format` and `npm run lint` in `mobile/`.
- **Changes to `shared/`** get their own small pull request that the whole team reviews. Prefer adding fields to renaming or removing them.
- **Import shared types with `import type`.** A normal import from `@roami/shared` crashes the app. See [docs/shared-models.md](docs/shared-models.md).
- **`null` means unknown.** Never turn a missing walking time or opening hours into `0` or "closed."
- **Never commit** `.env`, service account keys, `node_modules/`, or debug logs. Don't run `npm audit fix --force`.

More guides: [where code goes](docs/where-code-goes.md) (adding a new service), [coding guidelines](docs/coding-guidelines.md), [shared models](docs/shared-models.md).

## Team

| Name | Role |
|---|---|
| Antonia Kwan | Project Manager, UI and frontend |
| Ameli Graff | UI and frontend |
| Athena Bao | UX research, frontend |
| Rui Chu | Scrum Master, backend |
| Penelope Coates | Backup Scrum Master, backend |
| Brooklyn Helle | Backend |

Living document (requirements, design, and process): https://docs.google.com/document/d/1Kz8SdI8w7-ivWgA3terH4hSaZwHyNAZs51WpcsMWDO0/edit?usp=sharing