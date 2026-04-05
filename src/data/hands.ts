/**
 * All 169 canonical pre-flop hand strings in standard notation.
 * Ordered: pocket pairs (AA..22), then suited (AKs..32s), then offsuit (AKo..32o).
 */

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"] as const;
type Rank = (typeof RANKS)[number];

const SUIT_SYMBOLS = ["♠", "♥", "♦", "♣"] as const;
type SuitSymbol = (typeof SUIT_SYMBOLS)[number];

/** All 13 pocket pair strings, high to low. */
export const PAIRS: string[] = RANKS.map((r) => `${r}${r}`);

/** All 78 suited hand strings, ordered by rank descending. */
export const SUITED: string[] = [];
for (let i = 0; i < RANKS.length; i++) {
  for (let j = i + 1; j < RANKS.length; j++) {
    SUITED.push(`${RANKS[i]}${RANKS[j]}s`);
  }
}

/** All 78 offsuit hand strings, ordered by rank descending. */
export const OFFSUIT: string[] = [];
for (let i = 0; i < RANKS.length; i++) {
  for (let j = i + 1; j < RANKS.length; j++) {
    OFFSUIT.push(`${RANKS[i]}${RANKS[j]}o`);
  }
}

/** All 169 canonical hand strings. */
export const ALL_HANDS: string[] = [...PAIRS, ...SUITED, ...OFFSUIT];

/**
 * Returns a random display string for a hand with randomized suits.
 * E.g. "AKs" → "A♠K♣", "AKo" → "A♥K♦", "AA" → "A♣A♥"
 */
export const randomDisplayHand = (hand: string): string => {
  const shuffled = [...SUIT_SYMBOLS].sort(() => Math.random() - 0.5) as SuitSymbol[];

  if (hand.endsWith("s")) {
    // Suited: both cards same suit
    const rank1 = hand[0] as Rank;
    const rank2 = hand[1] as Rank;
    const suit = shuffled[0];
    return `${rank1}${suit}${rank2}${suit}`;
  }

  if (hand.endsWith("o")) {
    // Offsuit: two different suits
    const rank1 = hand[0] as Rank;
    const rank2 = hand[1] as Rank;
    return `${rank1}${shuffled[0]}${rank2}${shuffled[1]}`;
  }

  // Pocket pair: two different suits
  const rank = hand[0] as Rank;
  return `${rank}${shuffled[0]}${rank}${shuffled[1]}`;
};
