# Where code goes (the backend runs inside the app)

Screens call `callApi('name', request)` from `mobile/src/api`. They never import Firebase.

| Folder | What goes there | May import |
|---|---|---|
| `mobile/src/api/` | `callApi`, fixtures, `ApiError` | types from `@roami/shared` |
| `mobile/src/services/` | One file per component's logic. Checks the request, calls repositories and logic, returns the response type from `shared/src/api.ts` | `../api` (for `ApiError`), repositories, logic |
| `mobile/src/repositories/` | The only code that touches Firestore. Reads and writes, and converts documents to the contract's types | `firebase/firestore`, `./firestore` |
| `mobile/src/logic/` | Pure code: search matching, the planner, validators. Plain data in, plain data out. Create this folder when you write the first piece | Nothing from Firebase |
| `mobile/src/auth/` | Sign-in. The only code that imports `firebase/auth` | |

## Replacing a fixture with real code

1. Write the Firestore reads and writes in a repository file.
2. Write a service function that takes the contract's request type and returns its response type. Throw `ApiError` with a code (`invalid-argument`, `not-found`, `aborted`, and so on) when something is wrong.
3. Add it to `registerServices()` in `mobile/src/services/index.ts`, one line per service.
4. Set `EXPO_PUBLIC_API_MODE=live` in `mobile/.env` and restart with `npx expo start --clear`. Functions with no live handler still use fixtures.

See `PlaceRepository.ts` and `PlaceService.ts` for a working example.

## Rules to remember

- Import only types from `@roami/shared` (`import type`). Runtime values from it don't work in the app.
- Security rules deny anything they don't allow. Reads and writes must match `firestore.rules`, and the rules tests must still pass.
- Queries need the filters the rules expect: saved places `where userId == me`, trips `where ownerId == me`, recommendations `where moderationStatus == 'active'`, stops `where tripId == ...`.
- Trip changes: read the trip in a transaction, compare its revision to `expectedRevision` (throw `ApiError('aborted')` if different), then write the trip with `revision + 1` and the stops in the same batch.
- `null` means unknown. Never turn a missing walking time or opening hours into `0` or closed.

## Troubleshooting

- **`auth/invalid-refresh-token` or "Fetching auth token failed" in the console:** the app still has a login from the real Firebase project, and the emulator doesn't know it. Tap Sign out, make a new account (it will appear in the Emulator UI under Authentication), and fully close and reopen Expo Go.
- **Your laptop's address changes when you switch Wi-Fi networks.** If the app can't reach the emulator, rerun `ipconfig getifaddr en0`, update `EXPO_PUBLIC_EMULATOR_HOST` in `mobile/.env`, then restart with `npx expo start --clear`.
- **Emulator data resets every restart.** Rerun `npm --prefix backend run seed`.
- **The sign-in screen appears after about 8 seconds on a white spinner:** the app could not reach the Auth emulator. Check the address above.
