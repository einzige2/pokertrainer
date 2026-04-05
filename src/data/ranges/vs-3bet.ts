import type * as rangeTypes from "./types";

/**
 * Approximate GTO vs-3bet ranges (you opened, facing a 3-bet).
 * Indexed as vs3betData[heroPosition][threeBettorPosition][hand].
 *
 * Source: widely-published simplified GTO pre-flop charts (100bb cash game).
 * Covers the most common spots: BTN and CO openers facing 3-bets from the blinds.
 *
 * Action key: "call" | "4bet" | "fold"
 */

const ranks = ["A","K","Q","J","T","9","8","7","6","5","4","3","2"];

/** Builds a full range map defaulting to "fold", with 4bet/call overrides. */
const buildVs3betRange = (args: {
  fourBetHands: string[];
  callHands: string[];
}): Record<rangeTypes.HandString, rangeTypes.Vs3betAction> => {
  const { fourBetHands, callHands } = args;
  const fourBetSet = new Set(fourBetHands);
  const callSet = new Set(callHands);
  const range: Record<rangeTypes.HandString, rangeTypes.Vs3betAction> = {};

  const action = (hand: string): rangeTypes.Vs3betAction => {
    if (fourBetSet.has(hand)) return "4bet";
    if (callSet.has(hand)) return "call";
    return "fold";
  };

  for (const r of ranks) range[`${r}${r}`] = action(`${r}${r}`);
  for (let i = 0; i < ranks.length; i++) {
    for (let j = i + 1; j < ranks.length; j++) {
      range[`${ranks[i]}${ranks[j]}s`] = action(`${ranks[i]}${ranks[j]}s`);
      range[`${ranks[i]}${ranks[j]}o`] = action(`${ranks[i]}${ranks[j]}o`);
    }
  }

  return range;
};

// --- BTN opener vs BB 3-bet ---
const btnVsBb = buildVs3betRange({
  fourBetHands: ["AA", "KK", "AKs", "AKo", "A5s", "A4s"],
  callHands: [
    "QQ", "JJ", "TT", "99", "88",
    "AQs", "AJs", "ATs", "A9s",
    "KQs", "KJs", "KTs",
    "QJs", "QTs",
    "JTs",
    "T9s",
    "98s",
    "87s",
    "76s",
    "AQo", "KQo",
  ],
});

// --- BTN opener vs SB 3-bet ---
const btnVsSb = buildVs3betRange({
  fourBetHands: ["AA", "KK", "AKs", "AKo", "A5s"],
  callHands: [
    "QQ", "JJ", "TT", "99", "88",
    "AQs", "AJs", "ATs",
    "KQs", "KJs",
    "QJs", "QTs",
    "JTs",
    "T9s",
    "AQo",
  ],
});

// --- CO opener vs BB 3-bet ---
const coVsBb = buildVs3betRange({
  fourBetHands: ["AA", "KK", "AKs", "AKo", "A5s", "A4s"],
  callHands: [
    "QQ", "JJ", "TT", "99",
    "AQs", "AJs", "ATs",
    "KQs", "KJs",
    "QJs", "QTs",
    "JTs",
    "T9s",
    "98s",
    "AQo",
  ],
});

// --- CO opener vs SB 3-bet ---
const coVsSb = buildVs3betRange({
  fourBetHands: ["AA", "KK", "AKs", "AKo"],
  callHands: [
    "QQ", "JJ", "TT", "99",
    "AQs", "AJs",
    "KQs",
    "QJs",
    "JTs",
    "AQo",
  ],
});

// --- UTG opener vs BB 3-bet ---
const utgVsBb = buildVs3betRange({
  fourBetHands: ["AA", "KK", "AKs", "AKo"],
  callHands: [
    "QQ", "JJ", "TT",
    "AQs", "AJs",
    "KQs",
    "QJs",
    "JTs",
  ],
});

export const vs3betData: rangeTypes.Vs3betData = {
  BTN: {
    BB: btnVsBb,
    SB: btnVsSb,
  },
  CO: {
    BB: coVsBb,
    SB: coVsSb,
  },
  UTG: {
    BB: utgVsBb,
  },
};
