import type { RfiData, RfiAction, HandString } from "./types";

/**
 * Approximate GTO RFI (Raise First In) ranges for all 9 positions.
 *
 * Source: widely-published simplified GTO pre-flop charts (100bb cash game).
 * These are simplified to pure strategies (open/fold only; no mixed frequencies).
 * Ranges are tighter from early position and widen as position improves.
 *
 * Coverage: every hand in all() of hands.ts is accounted for (defaults to "fold").
 */

/** Hands that are opens from a given position (all others fold). */
const OPEN_HANDS: Record<string, string[]> = {
  // UTG: ~14% of hands, very tight
  UTG: [
    "AA", "KK", "QQ", "JJ", "TT", "99", "88",
    "AKs", "AQs", "AJs", "ATs", "A9s", "KQs", "KJs", "QJs",
    "AKo", "AQo",
  ],

  // UTG+1: ~15.5% — slightly wider
  UTG1: [
    "AA", "KK", "QQ", "JJ", "TT", "99", "88",
    "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "KQs", "KJs", "KTs", "QJs", "JTs",
    "AKo", "AQo", "AJo",
  ],

  // UTG+2: ~17%
  UTG2: [
    "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77",
    "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A5s",
    "KQs", "KJs", "KTs", "QJs", "QTs", "JTs", "T9s",
    "AKo", "AQo", "AJo", "KQo",
  ],

  // LJ (Lojack): ~20%
  LJ: [
    "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77",
    "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s",
    "KQs", "KJs", "KTs", "K9s", "QJs", "QTs", "Q9s", "JTs", "T9s", "98s",
    "AKo", "AQo", "AJo", "ATo", "KQo",
  ],

  // HJ (Hijack): ~23%
  HJ: [
    "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66",
    "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s",
    "KQs", "KJs", "KTs", "K9s", "K8s", "QJs", "QTs", "Q9s", "JTs", "J9s", "T9s", "T8s", "98s", "87s",
    "AKo", "AQo", "AJo", "ATo", "A9o", "KQo", "KJo",
  ],

  // CO (Cutoff): ~27%
  CO: [
    "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55",
    "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
    "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "QJs", "QTs", "Q9s", "Q8s",
    "JTs", "J9s", "J8s", "T9s", "T8s", "98s", "97s", "87s", "76s",
    "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "KQo", "KJo", "KTo", "QJo",
  ],

  // BTN (Button): ~45% — widest pre-flop open
  BTN: [
    "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "33", "22",
    "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
    "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "K4s", "K3s", "K2s",
    "QJs", "QTs", "Q9s", "Q8s", "Q7s", "Q6s",
    "JTs", "J9s", "J8s", "J7s",
    "T9s", "T8s", "T7s",
    "98s", "97s", "96s",
    "87s", "86s",
    "76s", "75s",
    "65s", "64s",
    "54s",
    "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "A7o", "A6o", "A5o", "A4o",
    "KQo", "KJo", "KTo", "K9o",
    "QJo", "QTo", "Q9o",
    "JTo", "J9o",
    "T9o",
  ],

  // SB (Small Blind): ~40% — positional disadvantage; slightly tighter than BTN
  SB: [
    "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "33", "22",
    "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
    "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s",
    "QJs", "QTs", "Q9s", "Q8s", "Q7s",
    "JTs", "J9s", "J8s", "J7s",
    "T9s", "T8s", "T7s",
    "98s", "97s", "96s",
    "87s", "86s",
    "76s", "75s",
    "65s",
    "54s",
    "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "A7o",
    "KQo", "KJo", "KTo", "K9o",
    "QJo", "QTo",
    "JTo",
  ],

  // BB never RFIs (it's already in as the big blind — no raise first in from BB)
  BB: [],
};

/**
 * Builds a full Record<HandString, RfiAction> for one position,
 * defaulting every hand to "fold" unless it appears in OPEN_HANDS.
 */
const buildPositionRange = (openHands: string[]): Record<HandString, RfiAction> => {
  const openSet = new Set(openHands);
  const range: Record<HandString, RfiAction> = {};

  // Pairs
  const ranks = ["A","K","Q","J","T","9","8","7","6","5","4","3","2"];
  for (const r of ranks) range[`${r}${r}`] = openSet.has(`${r}${r}`) ? "open" : "fold";

  // Suited and offsuit
  for (let i = 0; i < ranks.length; i++) {
    for (let j = i + 1; j < ranks.length; j++) {
      const suited = `${ranks[i]}${ranks[j]}s`;
      const offsuit = `${ranks[i]}${ranks[j]}o`;
      range[suited] = openSet.has(suited) ? "open" : "fold";
      range[offsuit] = openSet.has(offsuit) ? "open" : "fold";
    }
  }

  return range;
};

export const rfiData: RfiData = {
  UTG:  buildPositionRange(OPEN_HANDS["UTG"]!),
  UTG1: buildPositionRange(OPEN_HANDS["UTG1"]!),
  UTG2: buildPositionRange(OPEN_HANDS["UTG2"]!),
  LJ:   buildPositionRange(OPEN_HANDS["LJ"]!),
  HJ:   buildPositionRange(OPEN_HANDS["HJ"]!),
  CO:   buildPositionRange(OPEN_HANDS["CO"]!),
  BTN:  buildPositionRange(OPEN_HANDS["BTN"]!),
  SB:   buildPositionRange(OPEN_HANDS["SB"]!),
  BB:   buildPositionRange(OPEN_HANDS["BB"]!),
};
