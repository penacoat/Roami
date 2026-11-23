# Places for any city (OpenStreetMap import)

The Explore map can open any city. Places come from OpenStreetMap (OSM), which
is free and needs no API key. The app stores them in Firestore so each city is
downloaded from OSM about once a month, not once per user.

## What happens when someone opens a city

1. They type a name and choose a GeoNames suggestion with its region/country.
   After selection, `resolveCity` asks OSM's geocoder (Nominatim) once and
   matches the nearby boundary. Distant namesakes are rejected. Each city
   gets an ID such as `osm-relation-186579`, used by Explore and Postcards.
2. `listPlaces({ city, cityId })` checks `cityImports/{cityId}`.
   - **No record:** the city is imported now. Sights (landmarks, museums,
     parks) download first; food and shops download second, and only if the
     sights didn't already fill the 400-place limit. Places are kept best
     first, written to `places`, and the `cityImports` record is written last.
     If the sights download fails, nothing is saved and the user sees an
     error. If only the food download fails (public OSM servers sometimes time
     out), the sights are saved and shown but the city isn't marked done. The
     next visit, at least 10 minutes later, downloads only the food and then
     finishes the import. First loads can take several minutes if both provider servers need retries.
     The UI allows 450 seconds for a first import, shows a slow-load message,
     and keeps map controls available. Normal refreshes retain an 8-second timeout.
   - **Imported in the last 30 days:** the stored places are shown. OSM isn't contacted.
   - **Older than 30 days:** the stored places are shown right away, and the
     city is re-imported in the background. Places still in OSM are
     rewritten; new ones are added.
3. A place the latest refresh didn't find again (closed or removed from OSM)
   is hidden from the map and search, but not deleted, so saved places, trips
   and recommendations that point to it keep working.

The hand-made Seattle places (`provider: 'manual'`, no `cityId`) are always
shown for Seattle and never changed. An imported place with the same name
within 75 m of a hand-made one is skipped, so nothing appears twice.

## Where the code is

| What | File |
|---|---|
| Overpass query, OSM tags → categories, ranking, 30-day rule, duplicates | `mobile/src/logic/osmPlaces.ts` |
| Calls to Nominatim and Overpass (User-Agent, 1 request/second, fallback server) | `mobile/src/repositories/OsmRepository.ts` |
| Writing places in batches | `mobile/src/repositories/PlaceRepository.ts` |
| `cityImports` records | `mobile/src/repositories/CityImportRepository.ts` |
| Import and refresh flow | `mobile/src/services/PlaceService.ts` |
| Autocomplete and confirmed city selection | `mobile/src/cities/CityPicker.tsx`, `resolvePlaceCity.ts` |
| Catalog requests, slow-load message, attribution | `mobile/src/screens/map/usePlaces.ts`, `PlaceResults.tsx`, `PlaceDetails.tsx` |
| Rules | `firestore.rules` (places and cityImports) |

To change the refresh period, change `REFRESH_DAYS` in `osmPlaces.ts` **and**
`duration.value(30, 'd')` in `firestore.rules`.

## Rules and their limits

Signed-in users can create OSM places and `cityImports` records with a strict
shape (OSM-style IDs, known categories, short names, valid coordinates, server
timestamp). They can rewrite one only once it is older than 30 days, and can't
move a place to another city. Nobody can delete places or change hand-made ones.

The rules can't check that a place really exists in OSM, so a signed-in user
with their own script could add a made-up place. A Cloud Function import would
close that gap but needs the Blaze (billing) plan. A future admin script could
re-check a city against OSM and remove anything that doesn't match.

## Usage limits

- Nominatim: at most one request a second, no search-as-you-type, identifying
  User-Agent. The app asks only after a city suggestion is selected.
- Overpass: up to two stages per city, each with a fallback server.
- Firestore free tier: 20,000 writes a day. One city import writes at most 401
  documents.
- OSM data is © OpenStreetMap contributors (ODbL). The map shows this credit
  whenever it shows imported places. Keep it.

## Testing

- Unit and service tests: `npm --prefix mobile run test:ci`.
- Rules tests (need the Firestore emulator):
  `npx --yes firebase-tools emulators:exec --only firestore "npm --prefix backend run test:rules -- --runInBand"`
- On a phone: use the local emulator setup, set `EXPO_PUBLIC_API_MODE=live`,
  open Explore, tap the city chip in the drawer, and select a new city such as
  Portland. Live production testing requires the matching rules to be released
  separately by the team.
