import type { Place, Recommendation, User } from "@roami/shared";

import { rankMatches } from "../../mobile/src/logic/searchMatcher";
import { buildSeedRecords } from "../src/scripts/seed";
import { SEED_PLACES, SEED_RECOMMENDATIONS } from "../src/scripts/seedData";

describe("emulator seed records", () => {
  const records = buildSeedRecords();

  it("generates exactly 50 places and 75 recommendations with unique IDs", () => {
    expect(records.places).toHaveLength(50);
    expect(records.recommendations).toHaveLength(75);
    expect(new Set(records.places.map(({ id }) => id)).size).toBe(50);
    expect(new Set(records.recommendations.map(({ id }) => id)).size).toBe(75);
    expect(SEED_PLACES).toHaveLength(50);
    expect(SEED_RECOMMENDATIONS).toHaveLength(75);
  });

  it("matches the shared models without adding unmodeled fields", () => {
    const user: User = records.users[0];
    const place: Place = records.places[0];
    const recommendation: Recommendation = records.recommendations[0];

    expect(user).toBeDefined();
    expect(place).toBeDefined();
    expect(recommendation).toBeDefined();
    expect(Object.keys(records.users[0] ?? {}).sort()).toEqual([
      "bio",
      "createdAt",
      "id",
      "interests",
      "name",
    ]);
    expect(Object.keys(records.places[0] ?? {}).sort()).toEqual([
      "category",
      "city",
      "id",
      "latitude",
      "longitude",
      "missingFields",
      "name",
      "openingHours",
      "source",
      "updatedAt",
    ]);
    expect(Object.keys(records.recommendations[0] ?? {}).sort()).toEqual([
      "authorId",
      "createdAt",
      "description",
      "id",
      "moderationStatus",
      "placeId",
      "sourceLinks",
      "tags",
      "visitDate",
    ]);
  });

  it("connects each active, nonempty recommendation to a seeded place and user", () => {
    const placeIds = new Set(records.places.map(({ id }) => id));
    const userIds = new Set(records.users.map(({ id }) => id));

    for (const recommendation of records.recommendations) {
      expect(recommendation.description.trim()).not.toBe("");
      expect(recommendation.moderationStatus).toBe("active");
      expect(placeIds.has(recommendation.placeId)).toBe(true);
      expect(userIds.has(recommendation.authorId)).toBe(true);
      expect(recommendation.visitDate).toBeNull();
      expect(recommendation.sourceLinks).toEqual([]);
    }
  });

  it("uses null for unknown opening hours and excludes unavailable walking data", () => {
    for (const place of records.places) {
      expect(place.openingHours).toBeNull();
      expect(place.missingFields).toContain("openingHours");
      expect(place.source.provider).toBe("manual");
      expect(place.source.providerId).toBeNull();
      expect(Number.isFinite(place.latitude)).toBe(true);
      expect(Number.isFinite(place.longitude)).toBe(true);
      expect(Math.abs(place.latitude)).toBeLessThanOrEqual(90);
      expect(Math.abs(place.longitude)).toBeLessThanOrEqual(180);
    }
    expect(
      records.places.every((place) => !("walkingMinutesFromPrevious" in place)),
    ).toBe(true);
  });

  it.each([
    ["jazz", ["jazz", "live music", "nightlife"]],
    ["matcha", ["matcha"]],
    ["quiet study", ["quiet study"]],
    ["scenic views", ["scenic views", "skyline", "sunset"]],
    ["affordable food", ["affordable food", "affordable dining"]],
  ])(
    "includes relevant seeded recommendations for %s",
    (query, expectedTags) => {
      const matches = rankMatches(
        records.recommendations.map(({ id, description, tags, createdAt }) => ({
          id,
          description,
          tags,
          createdAt,
        })),
        query.split(" "),
      );
      const matchedIds = new Set(matches.map(({ id }) => id));
      const relevant = records.recommendations.filter(
        (recommendation) =>
          matchedIds.has(recommendation.id) &&
          recommendation.tags.some((tag) => expectedTags.includes(tag)),
      );

      expect(relevant.length).toBeGreaterThan(0);
    },
  );
});
