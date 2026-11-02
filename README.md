# Roami

Roami is an iOS app for social travel discovery and planning, aimed at university students exploring an unfamiliar city. Users can search for something specific, explore recommendations on a map, and save places. They can then turn those places into an itinerary. Recommendations show who suggested a place and what they liked about it, and that context stays attached as places move into a trip.

The MVP covers Pike Place Market and nearby downtown Seattle.

## Status (November 1, 2026)

The app runs in Expo Go. Every screen gets its data through one API layer, `callApi`. That layer returns realistic sample data ("fixtures") until a real service replaces each function. Real services read and write Cloud Firestore.

| Use case | Status |
|---|---|
| Create an account, sign in, stay signed in, sign out | **Operational** against Firebase Authentication (or the Auth emulator) |
| Discover places that match an interest (search, map) | In progress. Place list is live from Firestore. Search and the map screen run on fixtures. |
| Save a place for later | In progress. Runs on fixtures. Security rules for saves are done. |
| Create an itinerary | In progress. Runs on fixtures. Security rules for trips and stops are done. |
| Adjust an existing itinerary | In progress. Runs on fixtures, including the stale-edit check. |
| Share a recommendation collection | Not started |
| Rank and recommend a visited place | Not started. Writing recommendations needs new security rules first. |

The only screens so far are sign-in/sign-up and a temporary "Load places" check (`mobile/src/dev/PlacesCheck.tsx`) that proves the data layer works.

## Architecture: no Cloud Functions (decided October 2026)

Roami's backend logic runs inside the app. The app talks to Firebase Authentication and Cloud Firestore directly. There is no server.

**Why.** The budget is $0, and the app has to keep working after the demo without anyone's laptop running a backend. Deploying Cloud Functions requires Firebase's paid Blaze plan. Authentication and Firestore have free quotas on the Spark plan that are well above what we need: about 50,000 reads and 20,000 writes per day, 1 GiB of storage, and 50,000 monthly active users.

**How a request flows.**

```
Screen → callApi('name', request) → service → repository → Firestore
```

- **Screens** call only `callApi`. They never import Firebase.
- **Services** (`mobile/src/services/`) check the request, call repositories and pure logic, and return the response type from the contract. They throw `ApiError` with a code (`invalid-argument`, `not-found`, `aborted`, ...).
- **Repositories** (`mobile/src/repositories/`) are the only code that reads or writes Firestore.
- **Pure logic** (`mobile/src/logic/`, created with the first piece) holds search matching, the itinerary planner, and validators. Plain data in, plain data out, no Firebase imports.
- **The contract** (`shared/src/api.ts`, `views.ts`, `models.ts`) defines every call's request and response, and every Firestore document.
- **`firestore.rules`** is the only server-side enforcement. It checks identity, ownership, document IDs, field shapes, and that each trip change raises the trip's `revision` by exactly one.

**Trade-offs we accepted.**

- **Some checks live only in the app.** The rules cannot run the planner, count stops per day, or check that a stop's place exists, so a modified app could skip those checks.
- **Nothing in the app is secret.** Anything shipped in the app can be read. Only use API keys we are comfortable exposing, or fetch data ahead of time with an admin script.
- **Free-tier ceilings.** Search should cache results to stay under the daily read quota.
- **Moderation is manual.** Reviewing reports and removing content happens through an admin script.

**Still open.**

- **App distribution.** Expo Go is free but needs someone's laptop running `npx expo start`. A standalone app through TestFlight needs the paid Apple Developer Program (about $99 per year).
- **Profile privacy.** Rules cannot hide individual fields, so profile documents must never hold private data such as email. The rules reject an `email` field.

## Repository layout

```
Roami/
├── mobile/                      # The iOS app (Expo + React Native + TypeScript)
│   ├── App.tsx                  # Entry point: sign-in gate, then the app
│   ├── src/
│   │   ├── api/                 # callApi, ApiError, fixture data and handlers
│   │   ├── services/            # One file per component's logic (PlaceService so far)
│   │   ├── repositories/        # Firestore reads and writes (PlaceRepository so far)
│   │   ├── auth/                # AuthService, AuthProvider, AuthScreens, Firebase setup
│   │   └── dev/                 # Temporary developer checks (PlacesCheck)
│   ├── __tests__/               # Jest tests for the app
│   └── .env.example             # Environment variables the app needs
├── shared/src/                  # The contract: api.ts, views.ts, models.ts (types only)
├── backend/                     # Not a server: rules tests, seed script, leftover placeholder function
│   ├── test/                    # Security rules tests (run against the Firestore emulator)
│   └── src/scripts/seed.ts      # Loads sample data into the emulator
├── docs/                        # Setup and developer guides
├── firestore.rules              # Security rules
├── firestore.indexes.json       # Firestore indexes
├── firebase.json                # Firebase and emulator configuration
└── .github/workflows/           # CI (runs the mobile tests)
```

`backend/` keeps its name for now, but do not add Cloud Functions to it. `backend/src/index.ts` holds an unused `healthCheck` placeholder.

## Getting started

You need a Mac, an iPhone, Node 20 or newer, and Git.

1. Install **Expo Go** on your iPhone (latest version; the project uses Expo SDK 58) and create a free Expo account.
2. Clone the repo and install the app's dependencies:

   ```bash
   git clone https://github.com/penacoat/Roami.git
   cd Roami/mobile
   npm install
   ```

3. Copy `mobile/.env.example` to `mobile/.env` and fill in the Firebase values (ask the team or see the living document). Never commit `.env`.
4. Start the app and scan the QR code with your iPhone camera:

   ```bash
   npx expo start
   ```

With `EXPO_PUBLIC_API_MODE` left empty, every API call returns sample data, so no backend setup is needed to build screens. Full setup steps and troubleshooting are in [docs/mobile-app-setup.md](docs/mobile-app-setup.md) and [docs/firebase-setup.md](docs/firebase-setup.md).

## Working on the data layer (emulators)

Backend work runs against the **Firebase emulators**, so nothing touches real data. You also need Java 21 or newer and the Firebase CLI. Install the backend tools once with `npm --prefix backend install`.

Use three terminal tabs from the repo root:

| Tab | Command | Notes |
|---|---|---|
| 1 | `firebase emulators:start` | Leave running. Emulator UI at http://127.0.0.1:4000 |
| 2 | `npm --prefix backend run seed` | Loads sample places and recommendations. Rerun after every emulator restart. |
| 3 | `cd mobile && npx expo start --clear` | Leave running. |

To use real services instead of fixtures, add these lines to `mobile/.env` and restart Expo with `--clear`:

```
EXPO_PUBLIC_API_MODE=live
EXPO_PUBLIC_EMULATOR_HOST=<your laptop's address>
```

Find your address with `ipconfig getifaddr en0`. It changes when you switch Wi-Fi networks, and your phone and laptop must be on the same network. In live mode, sign-in goes to the Auth emulator, so create a new test account there.

Functions with no real service yet still use fixtures, so fixtures can be replaced one at a time. [docs/where-code-goes.md](docs/where-code-goes.md) explains how, using `PlaceRepository.ts` and `PlaceService.ts` as the example.

## Running tests

```bash
# App tests (Jest + jest-expo); these also run in CI on every pull request
npm --prefix mobile test

# Security rules tests (65 tests). Stop any running emulators first; they need port 8080.
firebase emulators:exec --only firestore "npm --prefix backend run test:rules"
```

CI (`.github/workflows/mobile-ci.yml`) runs only the app tests. The rules tests are run locally.

## Team workflow

- **Never commit to `main`.** Work on a branch, open a pull request, and get a review.
- **Branch names:** `<github-username>/<short-description>`, for example `penacoat/place-slice` or `bhelle/trips`.
- **Changes to `shared/`** get their own small pull request, and the whole team reviews them. Prefer adding fields to renaming or removing them.
- **Import shared types with `import type`.** A normal import from `@roami/shared` crashes the app. See [docs/shared-models.md](docs/shared-models.md).
- **`null` means unknown.** Never turn a missing walking time or opening hours into `0` or "closed."
- **Never commit** `.env`, service account keys, `node_modules/`, `backend/lib/`, or debug logs. Don't run `npm audit fix --force`.
- **Style:** Google's TypeScript guide and Airbnb's React guide. See [docs/coding-guidelines.md](docs/coding-guidelines.md).

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
