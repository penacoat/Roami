/**
 * Loads deterministic demo data into the local Firestore emulator only.
 * Requires FIRESTORE_EMULATOR_HOST to point to a loopback emulator on port 8080.
 */
import { initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import {
  SEED_CITY,
  SEED_PLACES,
  SEED_PROJECT_ID,
  SEED_RECOMMENDATIONS,
  SEED_TIMESTAMP,
  SEED_USERS,
} from "./seedData";

export function requireFirestoreEmulatorHost(
  env: Record<string, string | undefined> = process.env,
): string {
  const host = env.FIRESTORE_EMULATOR_HOST?.trim();
  if (!host) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST is not set. Start the local Firebase emulator, then run npm --prefix backend run seed.",
    );
  }

  if (!/^(localhost|127\.0\.0\.1):8080$|^\[::1\]:8080$/i.test(host)) {
    throw new Error(
      `Refusing to seed Firestore at "${host}". Only the local Firestore emulator on port 8080 is supported.`,
    );
  }

  return host;
}

export function buildSeedRecords() {
  const users = SEED_USERS.map((user) => ({
    ...user,
    createdAt: SEED_TIMESTAMP,
  }));
  const places = SEED_PLACES.map((place) => ({
    ...place,
    city: SEED_CITY,
    openingHours: null,
    missingFields: ["openingHours"],
    source: {
      provider: "manual" as const,
      providerId: null,
      retrievedAt: SEED_TIMESTAMP,
    },
    updatedAt: SEED_TIMESTAMP,
  }));
  const recommendations = SEED_RECOMMENDATIONS.map((recommendation) => ({
    ...recommendation,
    visitDate: null,
    sourceLinks: [] as string[],
    moderationStatus: "active" as const,
    createdAt: SEED_TIMESTAMP,
  }));

  if (places.length !== 50 || recommendations.length !== 75) {
    throw new Error(
      `Seed data must contain exactly 50 places and 75 recommendations; found ${places.length} places and ${recommendations.length} recommendations.`,
    );
  }

  const placeIds = new Set(places.map((place) => place.id));
  const recommendationIds = new Set(
    recommendations.map((recommendation) => recommendation.id),
  );
  const userIds = new Set(users.map((user) => user.id));
  if (
    userIds.size !== users.length ||
    placeIds.size !== places.length ||
    recommendationIds.size !== recommendations.length ||
    recommendations.some(
      (recommendation) =>
        !placeIds.has(recommendation.placeId) ||
        !userIds.has(recommendation.authorId) ||
        recommendation.description.trim().length === 0,
    )
  ) {
    throw new Error(
      "Seed data contains duplicate IDs or invalid recommendation references.",
    );
  }

  return { users, places, recommendations };
}

/** Writes deterministic document IDs, so rerunning replaces rather than duplicates seed records. */
export async function seedEmulator(db: Firestore): Promise<{
  users: number;
  places: number;
  recommendations: number;
}> {
  const records = buildSeedRecords();
  const batch = db.batch();

  for (const user of records.users) batch.set(db.doc(`users/${user.id}`), user);
  for (const place of records.places)
    batch.set(db.doc(`places/${place.id}`), place);
  for (const recommendation of records.recommendations) {
    batch.set(db.doc(`recommendations/${recommendation.id}`), recommendation);
  }

  await batch.commit();
  return {
    users: records.users.length,
    places: records.places.length,
    recommendations: records.recommendations.length,
  };
}

export async function runSeed(
  env: Record<string, string | undefined> = process.env,
): Promise<void> {
  const emulatorHost = requireFirestoreEmulatorHost(env);
  const app = initializeApp({ projectId: SEED_PROJECT_ID });

  try {
    const counts = await seedEmulator(getFirestore(app));
    console.log(
      `Seeded ${counts.users} users, ${counts.places} places, and ${counts.recommendations} recommendations into the Firestore emulator at ${emulatorHost}.`,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not seed the Firestore emulator at ${emulatorHost}. Confirm the emulator is running and reachable: ${detail}`,
    );
  }
}

if (require.main === module) {
  runSeed().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
