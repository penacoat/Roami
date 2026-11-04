/**
 * Deterministic Seattle demo data. The venue names are recognizable public
 * places; coordinates are approximate demo map pins, not verified addresses.
 * Recommendation descriptions are illustrative guide copy, not user reviews
 * or claims of personal experience.
 */

export const SEED_TIMESTAMP = "2026-10-01T12:00:00Z";
export const SEED_CITY = "Seattle";
export const SEED_PROJECT_ID = "roami-7c0bd";

export interface SeedUser {
  id: string;
  name: string;
  bio: string;
  interests: string[];
}

export interface SeedPlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  category: string;
}

export interface SeedRecommendation {
  id: string;
  authorId: string;
  placeId: string;
  description: string;
  tags: string[];
}

export const SEED_USERS: SeedUser[] = [
  {
    id: "u-maya",
    name: "Roami Demo Guide 1",
    bio: "Sample profile for emulator demo content.",
    interests: ["jazz", "food", "coffee"],
  },
  {
    id: "u-jonas",
    name: "Roami Demo Guide 2",
    bio: "Sample profile for emulator demo content.",
    interests: ["coffee", "parks", "books"],
  },
];

export const SEED_PLACES: SeedPlace[] = [
  {
    id: "p-pike",
    name: "Pike Place Market",
    latitude: 47.6097,
    longitude: -122.3425,
    category: "market",
  },
  {
    id: "p-sam",
    name: "Seattle Art Museum",
    latitude: 47.6073,
    longitude: -122.3381,
    category: "museum",
  },
  {
    id: "p-kerry",
    name: "Kerry Park",
    latitude: 47.6295,
    longitude: -122.3599,
    category: "viewpoint",
  },
  {
    id: "p-jazz",
    name: "Jazz Alley",
    latitude: 47.6139,
    longitude: -122.3417,
    category: "music venue",
  },
  {
    id: "p-cafe",
    name: "Corner Coffee",
    latitude: 47.6149,
    longitude: -122.319,
    category: "cafe",
  },
  {
    id: "p-park",
    name: "Discovery Park",
    latitude: 47.6573,
    longitude: -122.4058,
    category: "park",
  },
  {
    id: "p-chihuly",
    name: "Chihuly Garden and Glass",
    latitude: 47.6205,
    longitude: -122.3509,
    category: "museum",
  },
  {
    id: "p-storyville",
    name: "Storyville Coffee Pike Place",
    latitude: 47.6099,
    longitude: -122.3419,
    category: "cafe",
  },
  {
    id: "p-coffee-works",
    name: "Seattle Coffee Works",
    latitude: 47.6121,
    longitude: -122.3415,
    category: "cafe",
  },
  {
    id: "p-victrola",
    name: "Victrola Coffee Roasters Capitol Hill",
    latitude: 47.6154,
    longitude: -122.3195,
    category: "cafe",
  },
  {
    id: "p-elm",
    name: "Elm Coffee Roasters",
    latitude: 47.5998,
    longitude: -122.3315,
    category: "cafe",
  },
  {
    id: "p-allegro",
    name: "Cafe Allegro",
    latitude: 47.6614,
    longitude: -122.3134,
    category: "cafe",
  },
  {
    id: "p-adas",
    name: "Ada's Technical Books and Cafe",
    latitude: 47.6142,
    longitude: -122.3192,
    category: "bookstore cafe",
  },
  {
    id: "p-elliott-bay",
    name: "Elliott Bay Book Company",
    latitude: 47.6147,
    longitude: -122.3187,
    category: "bookstore",
  },
  {
    id: "p-central-library",
    name: "Seattle Central Library",
    latitude: 47.6067,
    longitude: -122.3325,
    category: "library",
  },
  {
    id: "p-suzzallo",
    name: "Suzzallo Library",
    latitude: 47.6553,
    longitude: -122.3078,
    category: "library",
  },
  {
    id: "p-fremont-coffee",
    name: "Fremont Coffee Company",
    latitude: 47.6512,
    longitude: -122.3505,
    category: "cafe",
  },
  {
    id: "p-monorail",
    name: "Monorail Espresso",
    latitude: 47.6084,
    longitude: -122.3371,
    category: "cafe",
  },
  {
    id: "p-miro-tea",
    name: "Miro Tea",
    latitude: 47.6685,
    longitude: -122.3864,
    category: "tea shop",
  },
  {
    id: "p-matcha-maiko",
    name: "Matcha Cafe Maiko Seattle",
    latitude: 47.6152,
    longitude: -122.3428,
    category: "dessert cafe",
  },
  {
    id: "p-nanas",
    name: "Nana's Green Tea Seattle",
    latitude: 47.6132,
    longitude: -122.3424,
    category: "tea shop",
  },
  {
    id: "p-uwajimaya",
    name: "Uwajimaya Seattle",
    latitude: 47.5989,
    longitude: -122.3266,
    category: "market",
  },
  {
    id: "p-un-bien",
    name: "Un Bien Ballard",
    latitude: 47.6687,
    longitude: -122.3861,
    category: "restaurant",
  },
  {
    id: "p-chowder",
    name: "Pike Place Chowder",
    latitude: 47.6094,
    longitude: -122.3417,
    category: "restaurant",
  },
  {
    id: "p-dicks",
    name: "Dick's Drive-In Capitol Hill",
    latitude: 47.6174,
    longitude: -122.3216,
    category: "restaurant",
  },
  {
    id: "p-pink-door",
    name: "The Pink Door",
    latitude: 47.6101,
    longitude: -122.3422,
    category: "restaurant",
  },
  {
    id: "p-serious-pie",
    name: "Serious Pie Downtown",
    latitude: 47.6142,
    longitude: -122.3418,
    category: "restaurant",
  },
  {
    id: "p-molly-moons",
    name: "Molly Moon's Homemade Ice Cream Capitol Hill",
    latitude: 47.6153,
    longitude: -122.3271,
    category: "dessert shop",
  },
  {
    id: "p-gas-works",
    name: "Gas Works Park",
    latitude: 47.6456,
    longitude: -122.3344,
    category: "park",
  },
  {
    id: "p-volunteer",
    name: "Volunteer Park",
    latitude: 47.6301,
    longitude: -122.3147,
    category: "park",
  },
  {
    id: "p-arboretum",
    name: "Washington Park Arboretum",
    latitude: 47.6395,
    longitude: -122.2945,
    category: "garden",
  },
  {
    id: "p-green-lake",
    name: "Green Lake Park",
    latitude: 47.6799,
    longitude: -122.3262,
    category: "park",
  },
  {
    id: "p-sculpture-park",
    name: "Olympic Sculpture Park",
    latitude: 47.6165,
    longitude: -122.3553,
    category: "park",
  },
  {
    id: "p-space-needle",
    name: "Space Needle",
    latitude: 47.6205,
    longitude: -122.3493,
    category: "attraction",
  },
  {
    id: "p-mopop",
    name: "Museum of Pop Culture",
    latitude: 47.6215,
    longitude: -122.3481,
    category: "museum",
  },
  {
    id: "p-aquarium",
    name: "Seattle Aquarium",
    latitude: 47.6073,
    longitude: -122.3432,
    category: "attraction",
  },
  {
    id: "p-museum-flight",
    name: "Museum of Flight",
    latitude: 47.5186,
    longitude: -122.2967,
    category: "museum",
  },
  {
    id: "p-ballard-locks",
    name: "Hiram M. Chittenden Locks",
    latitude: 47.6687,
    longitude: -122.3974,
    category: "attraction",
  },
  {
    id: "p-fremont-troll",
    name: "Fremont Troll",
    latitude: 47.6511,
    longitude: -122.3473,
    category: "public art",
  },
  {
    id: "p-neumos",
    name: "Neumos",
    latitude: 47.6149,
    longitude: -122.3198,
    category: "music venue",
  },
  {
    id: "p-crocodile",
    name: "The Crocodile",
    latitude: 47.6143,
    longitude: -122.3452,
    category: "music venue",
  },
  {
    id: "p-showbox",
    name: "The Showbox",
    latitude: 47.6081,
    longitude: -122.3382,
    category: "music venue",
  },
  {
    id: "p-paramount",
    name: "Paramount Theatre",
    latitude: 47.6131,
    longitude: -122.3316,
    category: "theater",
  },
  {
    id: "p-golden-gardens",
    name: "Golden Gardens Park",
    latitude: 47.6895,
    longitude: -122.4025,
    category: "park",
  },
  {
    id: "p-alki",
    name: "Alki Beach Park",
    latitude: 47.5792,
    longitude: -122.4064,
    category: "beach",
  },
  {
    id: "p-westlake",
    name: "Westlake Center",
    latitude: 47.6111,
    longitude: -122.3378,
    category: "shopping center",
  },
  {
    id: "p-seattle-center",
    name: "Seattle Center",
    latitude: 47.6219,
    longitude: -122.35,
    category: "attraction",
  },
  {
    id: "p-siff-uptown",
    name: "SIFF Cinema Uptown",
    latitude: 47.6231,
    longitude: -122.3567,
    category: "cinema",
  },
  {
    id: "p-theo",
    name: "Theo Chocolate Factory",
    latitude: 47.6687,
    longitude: -122.3866,
    category: "chocolate shop",
  },
  {
    id: "p-sky-view",
    name: "Sky View Observatory",
    latitude: 47.6044,
    longitude: -122.3303,
    category: "viewpoint",
  },
];

const DEMO_AUTHORS = ["u-maya", "u-jonas"] as const;

const RECOMMENDATION_CONTENT: Array<[string, string, string[]]> = [
  [
    "p-jazz",
    "A demo guide to an intimate jazz stop: check the current calendar and ticket details before planning an evening.",
    ["jazz", "live music", "nightlife"],
  ],
  [
    "p-kerry",
    "A demo route idea for skyline and sunset views; check weather and daylight before heading up the hill.",
    ["scenic views", "skyline", "sunset", "free"],
  ],
  [
    "p-pike",
    "A demo market walk: browse the stalls, look for a snack, and explore the levels at a quieter time.",
    ["food", "market", "affordable dining"],
  ],
  [
    "p-cafe",
    "A sample quiet-study stop with coffee-shop atmosphere. Confirm seating and current hours before visiting.",
    ["coffee", "quiet study", "study"],
  ],
  [
    "p-sam",
    "A sample downtown culture stop. Check the museum calendar for current exhibits and admission details.",
    ["museum", "art", "culture"],
  ],
  [
    "p-park",
    "A sample outdoor itinerary anchor with trails and water views; check current trail conditions.",
    ["park", "hiking", "scenic views", "outdoors"],
  ],
  [
    "p-chihuly",
    "A sample art-focused visit featuring glass installations; check timed-entry and opening information.",
    ["art", "museum", "attraction"],
  ],
  [
    "p-jazz",
    "Pair a live-music plan with a nearby dinner option, and confirm performance and reservation details.",
    ["jazz", "live music", "date spot", "dinner"],
  ],
  [
    "p-storyville",
    "A sample coffee break near the market, useful as a warm-up stop on a downtown walking route.",
    ["coffee", "cafe", "market"],
  ],
  [
    "p-coffee-works",
    "A demo coffee stop for comparing espresso drinks and planning a downtown cafe crawl.",
    ["coffee", "espresso", "cafe"],
  ],
  [
    "p-victrola",
    "A sample Capitol Hill coffee stop that can anchor a neighborhood walk or study break.",
    ["coffee", "cafe", "Capitol Hill"],
  ],
  [
    "p-elm",
    "A sample downtown coffee stop to pair with nearby shops and public spaces.",
    ["coffee", "espresso", "downtown"],
  ],
  [
    "p-allegro",
    "A campus-area cafe option for a study-themed itinerary; check current seating and opening details.",
    ["quiet study", "coffee", "University District"],
  ],
  [
    "p-adas",
    "A sample book-and-coffee stop for browsing technical titles or planning a focused study break.",
    ["bookstore", "quiet study", "coffee"],
  ],
  [
    "p-elliott-bay",
    "A sample bookstore visit to add a relaxed browse to a Capitol Hill neighborhood itinerary.",
    ["bookstore", "books", "date spot"],
  ],
  [
    "p-central-library",
    "A striking public-library stop for architecture, reading, and a quiet study break.",
    ["quiet study", "library", "architecture"],
  ],
  [
    "p-suzzallo",
    "A campus library architecture stop; check visitor access and current university policies.",
    ["library", "study", "architecture"],
  ],
  [
    "p-fremont-coffee",
    "A sample cafe stop to combine with public art and a walk through Fremont.",
    ["coffee", "cafe", "Fremont"],
  ],
  [
    "p-monorail",
    "A compact espresso stop to fit between downtown attractions; verify current service and hours.",
    ["coffee", "espresso", "affordable"],
  ],
  [
    "p-miro-tea",
    "A sample tea-focused stop for exploring brewed tea options in Ballard.",
    ["tea", "quiet", "Ballard"],
  ],
  [
    "p-matcha-maiko",
    "A matcha dessert idea for a Capitol Hill or downtown treat stop; confirm the current menu.",
    ["matcha", "dessert", "tea"],
  ],
  [
    "p-nanas",
    "A sample green-tea and dessert stop for a matcha-themed food itinerary.",
    ["matcha", "green tea", "dessert"],
  ],
  [
    "p-uwajimaya",
    "A practical market stop for browsing Japanese groceries and assembling a budget-friendly meal.",
    ["affordable dining", "market", "Japanese food"],
  ],
  [
    "p-un-bien",
    "A sample casual dining stop for a Ballard food itinerary; check the current menu and service details.",
    ["affordable dining", "restaurant", "Ballard"],
  ],
  [
    "p-chowder",
    "A seafood stop to consider on a Pike Place Market route; check current menu and queue conditions.",
    ["seafood", "market", "dining"],
  ],
  [
    "p-dicks",
    "A classic quick-service option to include in a budget-conscious Capitol Hill food plan.",
    ["affordable food", "burger", "late night"],
  ],
  [
    "p-pink-door",
    "A sample date-night dining idea near the market; confirm reservations, menu, and performance schedule.",
    ["date spot", "dinner", "Italian food"],
  ],
  [
    "p-serious-pie",
    "A downtown pizza option for a casual meal between nearby attractions.",
    ["affordable dining", "pizza", "restaurant"],
  ],
  [
    "p-molly-moons",
    "A dessert stop to add to a Capitol Hill walk; check seasonal flavors and current hours.",
    ["dessert", "ice cream", "date spot"],
  ],
  [
    "p-gas-works",
    "A sample outdoor route with broad lake and skyline scenery; pack for changing weather.",
    ["scenic views", "park", "outdoors"],
  ],
  [
    "p-volunteer",
    "A green-space break in Capitol Hill that can pair with nearby museums and cafes.",
    ["park", "garden", "outdoors"],
  ],
  [
    "p-arboretum",
    "A nature-focused walk among landscaped collections; check trail and seasonal access information.",
    ["garden", "walking", "outdoors"],
  ],
  [
    "p-green-lake",
    "A sample lakeside outing for walking, running, or a relaxed picnic plan.",
    ["outdoors", "walking", "lake"],
  ],
  [
    "p-sculpture-park",
    "An outdoor art walk with waterfront scenery, suitable for a low-cost daytime itinerary.",
    ["scenic views", "art", "outdoors", "free"],
  ],
  [
    "p-space-needle",
    "A landmark visit with elevated city views; confirm ticket times and visibility conditions.",
    ["scenic views", "attraction", "skyline"],
  ],
  [
    "p-mopop",
    "A pop-culture museum option for a rainy-day itinerary; check current exhibitions and admission.",
    ["museum", "music", "culture"],
  ],
  [
    "p-aquarium",
    "A waterfront attraction to combine with a downtown walk; verify current exhibits and entry times.",
    ["attraction", "family", "waterfront"],
  ],
  [
    "p-museum-flight",
    "A substantial aviation-history visit; plan travel time and confirm current exhibits.",
    ["museum", "aviation", "indoors"],
  ],
  [
    "p-ballard-locks",
    "A public-works and waterfront outing; look up current visitor access and seasonal activity.",
    ["outdoors", "waterfront", "attraction"],
  ],
  [
    "p-fremont-troll",
    "A quick public-art stop that works well on a self-guided Fremont walk.",
    ["public art", "Fremont", "free"],
  ],
  [
    "p-neumos",
    "A Capitol Hill live-music option; check the event calendar and age or ticket requirements.",
    ["live music", "concert", "nightlife"],
  ],
  [
    "p-crocodile",
    "A live-music venue to consider for an evening plan; verify the show schedule and entry details.",
    ["live music", "concert", "nightlife"],
  ],
  [
    "p-showbox",
    "A downtown concert stop that can pair with dinner; confirm event and ticket information.",
    ["live music", "concert", "date spot"],
  ],
  [
    "p-paramount",
    "A theater-night itinerary idea for touring performances; check the current calendar and accessibility details.",
    ["theater", "date spot", "entertainment"],
  ],
  [
    "p-golden-gardens",
    "A sample sunset beach and park outing; bring layers and check weather before traveling.",
    ["scenic views", "sunset", "beach", "outdoors"],
  ],
  [
    "p-alki",
    "A waterfront walk idea with views across Elliott Bay; check transit and weather for the visit.",
    ["scenic views", "beach", "walking"],
  ],
  [
    "p-westlake",
    "A central indoor stop for shopping or a rainy-day break between downtown destinations.",
    ["shopping", "downtown", "indoors"],
  ],
  [
    "p-seattle-center",
    "A flexible itinerary hub near museums, performances, and public spaces; check event schedules.",
    ["attraction", "entertainment", "family"],
  ],
  [
    "p-siff-uptown",
    "A cinema option for an evening plan; confirm screenings, tickets, and accessibility details.",
    ["cinema", "date spot", "entertainment"],
  ],
  [
    "p-theo",
    "A chocolate-themed stop to consider for a Fremont itinerary; check visitor experiences and availability.",
    ["chocolate", "dessert", "Fremont"],
  ],
  [
    "p-sky-view",
    "A high-rise viewpoint idea for skyline photos; verify visibility, hours, and admission before going.",
    ["scenic views", "skyline", "city views"],
  ],
  [
    "p-pike",
    "A market-area snack stop can fit an affordable-food itinerary; compare current stall menus.",
    ["affordable food", "market", "snack"],
  ],
  [
    "p-storyville",
    "Use this cafe as one option in a coffee crawl, with the market and waterfront nearby.",
    ["coffee", "cafe", "walking"],
  ],
  [
    "p-victrola",
    "A coffee stop to pair with bookstore browsing and an easy Capitol Hill neighborhood loop.",
    ["coffee", "bookstore", "neighborhood walk"],
  ],
  [
    "p-adas",
    "A book-and-cafe pairing makes a useful indoor alternative on a rainy study day.",
    ["quiet study", "bookstore", "rainy day"],
  ],
  [
    "p-central-library",
    "Add this public library to an architecture walk through downtown Seattle.",
    ["architecture", "walking", "downtown"],
  ],
  [
    "p-matcha-maiko",
    "A matcha-focused dessert break can complement a downtown shopping or sightseeing route.",
    ["matcha", "dessert", "shopping"],
  ],
  [
    "p-uwajimaya",
    "Browse the food hall and market shelves for varied, budget-aware meal ideas.",
    ["affordable food", "Japanese food", "market"],
  ],
  [
    "p-dicks",
    "A simple quick meal can make this a useful stop between Capitol Hill music venues.",
    ["affordable dining", "late night", "Capitol Hill"],
  ],
  [
    "p-gas-works",
    "Consider this lakeside park for an outdoor picnic and broad city views.",
    ["scenic views", "picnic", "outdoors"],
  ],
  [
    "p-green-lake",
    "A loop around the lake can anchor an active morning or a low-key outdoor afternoon.",
    ["walking", "outdoors", "park"],
  ],
  [
    "p-sculpture-park",
    "Combine outdoor sculpture viewing with a waterfront walk for a flexible free outing.",
    ["art", "free", "scenic views"],
  ],
  [
    "p-mopop",
    "Pair music-history exhibits with nearby Seattle Center attractions for an indoor-focused day.",
    ["music", "museum", "Seattle Center"],
  ],
  [
    "p-neumos",
    "Look for local bands and upcoming concerts when planning an evening around Capitol Hill.",
    ["live music", "jazz", "concert"],
  ],
  [
    "p-crocodile",
    "A venue option for live sets across genres; confirm the lineup before making plans.",
    ["live music", "music", "nightlife"],
  ],
  [
    "p-golden-gardens",
    "A beach-side park can close an outdoor day with sunset scenery when conditions cooperate.",
    ["sunset", "beach", "scenic views"],
  ],
  [
    "p-alki",
    "Plan a relaxed waterfront outing and check ferry or bus connections before setting off.",
    ["outdoors", "waterfront", "scenic views"],
  ],
  [
    "p-paramount",
    "A performance night offers an indoor date idea; check the official calendar for details.",
    ["date spot", "theater", "entertainment"],
  ],
  [
    "p-miro-tea",
    "Add a tea tasting stop to a Ballard cafe and shop itinerary.",
    ["tea", "cafe", "Ballard"],
  ],
  [
    "p-sky-view",
    "For a city-view itinerary, compare this observation option with public parks and viewpoints.",
    ["scenic views", "viewpoint", "skyline"],
  ],
  [
    "p-arboretum",
    "A garden walk is a calm outdoor alternative to a busier downtown schedule.",
    ["quiet", "garden", "nature"],
  ],
  [
    "p-un-bien",
    "Include a casual meal in a Ballard neighborhood day and check current pricing before visiting.",
    ["affordable dining", "food", "restaurant"],
  ],
  [
    "p-showbox",
    "Plan around a concert listing and nearby downtown dining for an evening out.",
    ["live music", "date spot", "dinner"],
  ],
  [
    "p-ballard-locks",
    "An outdoor visit here can be paired with nearby gardens and a Ballard neighborhood route.",
    ["outdoors", "walking", "waterfront"],
  ],
  [
    "p-fremont-troll",
    "Pair this public-art landmark with coffee and other Fremont stops for a compact walk.",
    ["public art", "coffee", "Fremont"],
  ],
];

export const SEED_RECOMMENDATIONS: SeedRecommendation[] =
  RECOMMENDATION_CONTENT.map(([placeId, description, tags], index) => ({
    id: index < 8 ? `r${index + 1}` : `r${index + 1}`,
    authorId: DEMO_AUTHORS[index % DEMO_AUTHORS.length],
    placeId,
    description: `Demo suggestion: ${description}`,
    tags,
  }));
