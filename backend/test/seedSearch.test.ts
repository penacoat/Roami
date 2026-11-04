import { getUserNames } from "../../mobile/src/repositories/UserRepository";
import { listPlacesInCity } from "../../mobile/src/repositories/PlaceRepository";
import { listActiveForPlaces } from "../../mobile/src/repositories/RecommendationRepository";
import {
  clearSearchCache,
  searchRecommendations,
} from "../../mobile/src/services/SearchService";
import { buildSeedRecords } from "../src/scripts/seed";

jest.mock("../../mobile/src/repositories/PlaceRepository", () => ({
  listPlacesInCity: jest.fn(),
}));
jest.mock("../../mobile/src/repositories/RecommendationRepository", () => ({
  listActiveForPlaces: jest.fn(),
}));
jest.mock("../../mobile/src/repositories/UserRepository", () => ({
  getUserNames: jest.fn(),
}));

const records = buildSeedRecords();
const placeSummaries = records.places.map(
  ({
    id,
    name,
    latitude,
    longitude,
    category,
    openingHours,
    missingFields,
  }) => ({
    id,
    name,
    latitude,
    longitude,
    category,
    openingHours,
    missingFields,
  }),
);

beforeEach(() => {
  jest.clearAllMocks();
  clearSearchCache();
  jest.mocked(listPlacesInCity).mockResolvedValue(placeSummaries);
  jest.mocked(listActiveForPlaces).mockResolvedValue(records.recommendations);
  jest
    .mocked(getUserNames)
    .mockResolvedValue(
      new Map(records.users.map(({ id, name }) => [id, name])),
    );
});

describe("seeded content through the discovery search service", () => {
  it.each([
    ["jazz", "jazz"],
    ["matcha", "matcha"],
    ["quiet study", "quiet study"],
    ["scenic views", "scenic views"],
    ["affordable food", "affordable food"],
  ])("returns relevant demo content for %s", async (text, expectedTag) => {
    const response = await searchRecommendations({
      text,
      interests: [],
      city: "Seattle",
      limit: 50,
    });

    expect(response.results.length).toBeGreaterThan(0);
    expect(
      response.results.some((result) =>
        result.recommendation.tags.some((tag) =>
          tag.toLowerCase().includes(expectedTag),
        ),
      ),
    ).toBe(true);
  });
});
