// Loads sample data into the Firestore EMULATOR. Refuses to run against a real project.
// Sample data only: names are real Seattle places, but hours, descriptions, and
// authors are made up. Run it with: npm --prefix backend run seed
import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is not set. This script only seeds the emulator.");
}

initializeApp({projectId: "roami-7c0bd"});
const db = getFirestore();

const NOW = "2026-10-01T12:00:00Z";
const CITY = "Seattle";

const USERS = [
  {id: "u-maya", name: "Maya", bio: "Exchange student. Loves live music.", interests: ["jazz", "food"]},
  {id: "u-jonas", name: "Jonas", bio: "Local. Coffee and parks.", interests: ["coffee", "parks"]},
];

// id, name, latitude, longitude, category, openingHours (null means unknown)
const PLACES: Array<[string, string, number, number, string, string | null]> = [
  ["p-pike", "Pike Place Market", 47.6097, -122.3425, "market", "09:00-18:00"],
  ["p-sam", "Seattle Art Museum", 47.6073, -122.3381, "museum", "10:00-17:00"],
  ["p-kerry", "Kerry Park", 47.6295, -122.3599, "viewpoint", null],
  ["p-jazz", "Jazz Alley", 47.6139, -122.3417, "music venue", "18:00-23:00"],
  ["p-cafe", "Corner Coffee", 47.6149, -122.319, "cafe", "07:00-17:00"],
  ["p-park", "Discovery Park", 47.6573, -122.4058, "park", null],
  ["p-chihuly", "Chihuly Garden and Glass", 47.6205, -122.3509, "museum", "10:00-19:00"],
];

// id, authorId, placeId, description, tags
const RECS: Array<[string, string, string, string, string[]]> = [
  ["r1", "u-maya", "p-jazz", "Small room, great trio on weekends. Go early to get a table near the stage.", ["jazz", "live music", "nightlife"]],
  ["r2", "u-jonas", "p-kerry", "Best skyline view in the city, especially at sunset. Free.", ["views", "sunset", "free"]],
  ["r3", "u-maya", "p-pike", "Go before 10 to beat the crowds. Get a pastry and walk the lower levels.", ["food", "market", "morning"]],
  ["r4", "u-jonas", "p-cafe", "Used to have jazz nights, but it no longer has jazz. Still good coffee and quiet for studying.", ["cafe", "coffee", "study"]],
  ["r5", "u-maya", "p-sam", "Free first Thursday evenings. The Pacific Northwest gallery is the highlight.", ["museum", "art", "free"]],
  ["r6", "u-jonas", "p-park", "Big loop trail with water views. Bring a jacket, it gets windy.", ["parks", "hiking", "views"]],
  ["r7", "u-maya", "p-chihuly", "Worth it for the glasshouse. Book ahead in summer.", ["art", "museum"]],
  ["r8", "u-jonas", "p-jazz", "Dinner and a show. Pricey but the sound is great.", ["jazz", "live music", "dinner"]],
];

async function main(): Promise<void> {
  const batch = db.batch();

  for (const u of USERS) {
    batch.set(db.doc(`users/${u.id}`), {...u, createdAt: NOW});
  }

  for (const [id, name, latitude, longitude, category, openingHours] of PLACES) {
    batch.set(db.doc(`places/${id}`), {
      id,
      name,
      city: CITY,
      latitude,
      longitude,
      category,
      openingHours,
      missingFields: openingHours === null ? ["openingHours"] : [],
      source: {provider: "manual", providerId: null, retrievedAt: NOW},
      updatedAt: NOW,
    });
  }

  for (const [id, authorId, placeId, description, tags] of RECS) {
    batch.set(db.doc(`recommendations/${id}`), {
      id,
      authorId,
      placeId,
      description,
      tags,
      visitDate: null,
      sourceLinks: [],
      moderationStatus: "active",
      createdAt: NOW,
    });
  }

  await batch.commit();
  console.log(`Seeded ${USERS.length} users, ${PLACES.length} places, ${RECS.length} recommendations.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
