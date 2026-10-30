# Trip creation demo

From `mobile/`, run `npm install` and `npm start`, then open the app in Expo Go.
Use the existing Firebase environment configuration described in `firebase-setup.md`
and sign in. The trip creation screen replaces the signed-in welcome placeholder.

1. Enter a destination or tap a suggested city.
2. Tap a departure date and a return date in the calendar. Use the arrows for
   other months. Tap the same date twice for a day trip.
3. Keep the default daily hours or enter new times in 24-hour format.
4. Tap **Create my trip** to see the saved-trip confirmation.
5. Tap **Plan another trip** to reset the form.

Trips use the shared `Trip` type and save to AsyncStorage under
`roami:trip:<ownerId>:<tripId>`. The screen confirms success only after storage
finishes and retains the form for retry if storage fails. This is device-only demo
storage; trip listing, backend sync, place search, and itinerary generation are
outside this screen's scope. Replace `src/trips/localTrips.ts` with the trip API
integration when available.

Checks (from `mobile/`):

```sh
npx tsc --noEmit
npx expo lint
npx jest --preset jest-expo --runInBand --watchman=false
```
