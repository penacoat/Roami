// SearchMatcher: matches search terms against recommendation tags and text.
// Pure: plain data in, plain data out, no Firebase.
//
// For each search term it looks for, in this order:
//   exact    the term itself, in a tag or in the text ("museums" also finds "museum")
//   synonym  a word that means the same ("espresso" finds "coffee")
//   prefix   a word starting with the term, 3+ letters ("caf" finds "cafe")
//   broader  a related but more general idea ("jazz" finds "live music")
// The first three count as exact matches. Broader matches are labeled separately
// so the app can offer them as "related" rather than as what was asked for.
//
// Text matches are skipped when the text negates them in the same clause, so
// "it no longer has jazz" and "used to have jazz nights" are not jazz matches.
// Tags are chosen by the author on purpose, so they are never negated.
import type { MatchKind, MatchReason } from '@roami/shared';

/** The parts of a recommendation the matcher reads. */
export interface Searchable {
  id: string;
  description: string;
  tags: string[];
  createdAt: string;
}

export interface SearchMatch {
  id: string;
  matchLevel: 'exact' | 'broader';
  reasons: MatchReason[];
}

export const MIN_PREFIX_LENGTH = 3;
export const MAX_TERMS = 20;

// Words that mean the same thing. Each group is matched as one idea.
// Add groups here as the pilot catalog grows; keep entries lowercase.
const SYNONYM_GROUPS: string[][] = [
  ['coffee', 'cafe', 'espresso', 'latte', 'coffee shop'],
  ['view', 'viewpoint', 'lookout', 'overlook', 'scenic', 'skyline'],
  ['hike', 'hiking', 'trail'],
  ['museum', 'gallery', 'exhibit'],
  ['bookstore', 'bookshop', 'book shop', 'books'],
  ['vintage', 'thrift', 'secondhand', 'second hand'],
  ['sunglasses', 'eyewear', 'shades'],
  ['bar', 'pub', 'tavern'],
  ['live music', 'gig', 'concert'],
  ['restaurant', 'dining', 'eatery'],
  ['bakery', 'pastry'],
  ['dessert', 'sweets'],
];

// Related, more general ideas (searched term -> what it can broaden to).
const BROADER: Record<string, string[]> = {
  jazz: ['live music', 'music', 'nightlife'],
  'live music': ['music', 'nightlife'],
  music: ['jazz', 'nightlife'],
  nightlife: ['bar', 'live music'],
  art: ['museum'],
  museum: ['art'],
  sunset: ['view'],
  view: ['sunset'],
  hike: ['park', 'outdoors', 'nature'],
  park: ['outdoors', 'hike', 'nature', 'garden'],
  food: ['market', 'restaurant', 'bakery', 'dinner'],
  dinner: ['restaurant', 'food'],
  breakfast: ['bakery', 'coffee', 'brunch'],
  brunch: ['breakfast', 'bakery'],
  bookstore: ['shopping'],
  vintage: ['shopping'],
  sunglasses: ['vintage', 'shopping'],
  shopping: ['market', 'vintage', 'bookstore'],
  market: ['food', 'shopping'],
  study: ['coffee', 'quiet'],
};

// Words that carry no meaning in a search ("a good place for coffee" -> coffee).
const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'for',
  'with',
  'near',
  'nearby',
  'in',
  'on',
  'at',
  'to',
  'of',
  'by',
  'from',
  'around',
  'my',
  'me',
  'i',
  'we',
  'some',
  'any',
  'good',
  'great',
  'best',
  'nice',
  'cool',
  'place',
  'places',
  'spot',
  'spots',
  'somewhere',
  'find',
  'looking',
  'want',
  'like',
  'that',
  'this',
  'is',
  'are',
  'has',
  'have',
]);

// Words that negate what follows them in a clause.
const NEGATION_WORDS = new Set([
  'no',
  'not',
  'never',
  'without',
  'nor',
  'none',
  'lacks',
  'lacking',
  'cannot',
  'nothing',
]);

// ---------- Text helpers ----------

/** Lowercase, accents removed ("café" -> "cafe"), straight apostrophes. */
function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[‘’]/g, "'");
}

/** Words in the text: letters, digits, and inner apostrophes ("isn't"). */
export function tokenize(text: string): string[] {
  return fold(text)
    .replace(/[^a-z0-9'\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter((w) => w.length > 0);
}

/** A rough singular, so "museums", "galleries", and "glasses" compare equal to their singular. */
export function singular(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.endsWith('sses')) return word.slice(0, -2);
  if (word.endsWith('ss') || word.endsWith('us') || word.endsWith('is')) return word;
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/** The comparable form of a phrase: tokens, each made singular. */
function keyOf(phrase: string): string {
  return tokenize(phrase).map(singular).join(' ');
}

const SYNONYMS = new Map<string, string[]>();
for (const group of SYNONYM_GROUPS) {
  const keys = group.map(keyOf);
  for (const key of keys) SYNONYMS.set(key, keys);
}

const BROADER_BY_KEY = new Map<string, string[]>(
  Object.entries(BROADER).map(([term, related]) => [keyOf(term), related.map(keyOf)]),
);

/** The term and the words that mean the same. */
function sameMeaning(key: string): string[] {
  return SYNONYMS.get(key) ?? [key];
}

/** Related ideas for a term, with their synonyms, excluding anything that means the term. */
function broaderThan(key: string): string[] {
  const own = new Set(sameMeaning(key));
  const result = new Set<string>();
  for (const k of own) {
    for (const related of BROADER_BY_KEY.get(k) ?? []) {
      for (const s of sameMeaning(related)) if (!own.has(s)) result.add(s);
    }
  }
  return [...result];
}

/** Multi-word phrases the parser should keep together, such as "live music". */
function dictionaryPhrases(): string[] {
  const all = [...SYNONYM_GROUPS.flat(), ...Object.keys(BROADER), ...Object.values(BROADER).flat()];
  return all.filter((p) => p.includes(' '));
}

// ---------- Query parsing ----------

/**
 * Turns the search box text and chosen interests into search terms.
 * Interests are kept whole. The text is split into words, except that known
 * phrases ("live music", and multi-word tags passed in) stay together.
 * Stopwords are dropped and duplicates removed. At most MAX_TERMS terms.
 */
export function parseQuery(
  text: string,
  interests: string[],
  extraPhrases: string[] = [],
): string[] {
  const terms: string[] = [];
  const seen = new Set<string>();
  const add = (phrase: string) => {
    const key = keyOf(phrase);
    if (key.length === 0 || seen.has(key)) return;
    seen.add(key);
    terms.push(tokenize(phrase).join(' '));
  };

  for (const interest of interests) {
    const words = tokenize(interest);
    if (words.some((w) => !STOPWORDS.has(w))) add(interest);
  }

  const phrases = [...new Set([...dictionaryPhrases(), ...extraPhrases].map(keyOf))]
    .filter((p) => p.includes(' '))
    .map((p) => p.split(' '))
    .sort((a, b) => b.length - a.length);
  const words = tokenize(text);
  for (let i = 0; i < words.length;) {
    const phrase = phrases.find((p) => p.every((w, j) => singular(words[i + j] ?? '') === w));
    if (phrase) {
      add(words.slice(i, i + phrase.length).join(' '));
      i += phrase.length;
      continue;
    }
    if (!STOPWORDS.has(words[i])) add(words[i]);
    i += 1;
  }
  return terms.slice(0, MAX_TERMS);
}

// ---------- Matching ----------

/** A recommendation split up for matching: clauses of words, and tags as words. */
interface Prepared {
  rec: Searchable;
  clauses: string[][];
  tags: { tag: string; words: string[] }[];
}

/** Splits text into clauses at punctuation and at contrast words such as "but". */
function clausesOf(text: string): string[][] {
  return fold(text)
    .split(/[.,;:!?()\n]|\b(?:but|though|although|however)\b/)
    .map(tokenize)
    .filter((c) => c.length > 0);
}

function prepare(rec: Searchable): Prepared {
  return {
    rec,
    clauses: clausesOf(rec.description),
    tags: rec.tags.map((tag) => ({ tag, words: tokenize(tag) })),
  };
}

/** True when words[start..] begins with the phrase (compared in singular form). */
function startsWithPhrase(words: string[], start: number, phrase: string[]): boolean {
  return phrase.every((w, j) => start + j < words.length && singular(words[start + j]) === w);
}

/** True when the clause negates a match that starts at `start`. */
function isNegated(clause: string[], start: number): boolean {
  for (let i = 0; i < start; i += 1) {
    const w = clause[i];
    if (NEGATION_WORDS.has(w) || w.endsWith("n't")) return true;
    if (w === 'used' && clause[i + 1] === 'to') return true; // "used to have jazz"
  }
  // Negations that can come after the thing they negate: "jazz is no longer offered".
  return (
    clause.includes('anymore') || clause.some((w, i) => w === 'no' && clause[i + 1] === 'longer')
  );
}

type Hit = { matched: string; source: 'tag' | 'text' };

function findWhole(item: Prepared, phrase: string[]): Hit | null {
  for (const { tag, words } of item.tags) {
    for (let i = 0; i < words.length; i += 1) {
      if (startsWithPhrase(words, i, phrase)) return { matched: tag, source: 'tag' };
    }
  }
  for (const clause of item.clauses) {
    for (let i = 0; i < clause.length; i += 1) {
      if (startsWithPhrase(clause, i, phrase) && !isNegated(clause, i)) {
        return { matched: clause.slice(i, i + phrase.length).join(' '), source: 'text' };
      }
    }
  }
  return null;
}

function findPrefix(item: Prepared, prefix: string): Hit | null {
  const extends_ = (w: string) => w.startsWith(prefix) && singular(w) !== singular(prefix);
  for (const { tag, words } of item.tags) {
    if (words.some(extends_)) return { matched: tag, source: 'tag' };
  }
  for (const clause of item.clauses) {
    for (let i = 0; i < clause.length; i += 1) {
      if (extends_(clause[i]) && !isNegated(clause, i)) {
        return { matched: clause[i], source: 'text' };
      }
    }
  }
  return null;
}

function findAny(item: Prepared, keys: string[]): Hit | null {
  for (const key of keys) {
    const hit = findWhole(item, key.split(' '));
    if (hit) return hit;
  }
  return null;
}

/** The best reason a recommendation matches one term, or null. */
function matchTerm(item: Prepared, term: string): MatchReason | null {
  const key = keyOf(term);
  const words = key.split(' ');
  const reason = (kind: MatchKind, hit: Hit): MatchReason => ({ kind, term, ...hit });

  const exact = findWhole(item, words);
  if (exact) return reason('exact', exact);

  const synonym = findAny(
    item,
    sameMeaning(key).filter((k) => k !== key),
  );
  if (synonym) return reason('synonym', synonym);

  if (words.length === 1 && words[0].length >= MIN_PREFIX_LENGTH) {
    const prefix = findPrefix(item, words[0]);
    if (prefix) return reason('prefix', prefix);
  }

  const broader = findAny(item, broaderThan(key));
  if (broader) return reason('broader', broader);
  return null;
}

/** Why a recommendation matches the terms: one reason per matched term, in term order. */
export function matchRecommendation(rec: Searchable, terms: string[]): MatchReason[] {
  const item = prepare(rec);
  return terms.flatMap((t) => {
    const r = matchTerm(item, t);
    return r ? [r] : [];
  });
}

/**
 * Matches and ranks recommendations. Exact matches come first, then broader ones.
 * Within each group, recommendations matching more terms come first, then more
 * tag matches, then newer ones. Popularity is not used.
 */
export function rankMatches(recs: Searchable[], terms: string[]): SearchMatch[] {
  if (terms.length === 0) return [];
  const scored = recs.flatMap((rec) => {
    const reasons = matchRecommendation(rec, terms);
    if (reasons.length === 0) return [];
    const exactCount = reasons.filter((r) => r.kind !== 'broader').length;
    return [
      {
        rec,
        match: {
          id: rec.id,
          matchLevel: exactCount > 0 ? ('exact' as const) : ('broader' as const),
          reasons,
        },
        exactCount,
        tagCount: reasons.filter((r) => r.source === 'tag').length,
      },
    ];
  });

  scored.sort(
    (a, b) =>
      Number(b.match.matchLevel === 'exact') - Number(a.match.matchLevel === 'exact') ||
      b.exactCount - a.exactCount ||
      b.match.reasons.length - a.match.reasons.length ||
      b.tagCount - a.tagCount ||
      b.rec.createdAt.localeCompare(a.rec.createdAt) ||
      a.rec.id.localeCompare(b.rec.id),
  );
  return scored.map((s) => s.match);
}
