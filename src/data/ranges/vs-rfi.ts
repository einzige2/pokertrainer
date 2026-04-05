import type { VsRfiData, VsRfiAction, HandString } from "./types";

/**
 * Approximate GTO vs-RFI ranges (facing an open raise).
 * Indexed as vsRfiData[heroPosition][openerPosition][hand].
 *
 * Source: widely-published simplified GTO pre-flop charts (100bb cash game).
 * Covers the most common and instructive spots. Only hero positions that can
 * face an open (i.e., later positions than the opener) are included.
 *
 * Action key: "call" | "3bet" | "fold"
 */

const ranks = ["A","K","Q","J","T","9","8","7","6","5","4","3","2"];

/** Builds a full range map defaulting to "fold", with 3bet/call overrides. */
const buildVsRfiRange = (args: {
  threeBetHands: string[];
  callHands: string[];
}): Record<HandString, VsRfiAction> => {
  const { threeBetHands, callHands } = args;
  const threeBetSet = new Set(threeBetHands);
  const callSet = new Set(callHands);
  const range: Record<HandString, VsRfiAction> = {};

  const action = (hand: string): VsRfiAction => {
    if (threeBetSet.has(hand)) return "3bet";
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

// --- BTN vs UTG open ---
const btnVsUtg = buildVsRfiRange({
  threeBetHands: ["AA", "KK", "QQ", "AKs", "AKo"],
  callHands: [
    "JJ", "TT", "99", "88", "77", "66",
    "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s",
    "KQs", "KJs", "KTs", "QJs", "QTs", "JTs", "T9s", "98s", "87s", "76s", "65s",
    "AQo", "KQo",
  ],
});

// --- BTN vs CO open ---
const btnVsCo = buildVsRfiRange({
  threeBetHands: ["AA", "KK", "QQ", "JJ", "AKs", "AQs", "A5s", "AKo", "AQo"],
  callHands: [
    "TT", "99", "88", "77", "66", "55",
    "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A4s", "A3s", "A2s",
    "KQs", "KJs", "KTs", "K9s", "QJs", "QTs", "Q9s",
    "JTs", "J9s", "T9s", "T8s", "98s", "97s", "87s", "86s", "76s", "75s", "65s",
    "KQo", "KJo", "QJo",
  ],
});

// --- CO vs HJ open ---
const coVsHj = buildVsRfiRange({
  threeBetHands: ["AA", "KK", "QQ", "AKs", "AKo"],
  callHands: [
    "JJ", "TT", "99", "88", "77",
    "AQs", "AJs", "ATs", "A9s", "A8s", "A5s",
    "KQs", "KJs", "KTs", "QJs", "QTs", "JTs", "T9s", "98s", "87s", "76s",
    "AQo", "AJo", "KQo",
  ],
});

// --- BB vs BTN open ---
const bbVsBtn = buildVsRfiRange({
  threeBetHands: [
    "AA", "KK", "QQ", "JJ", "AKs", "AQs", "A5s", "A4s", "A3s", "A2s", "AKo",
  ],
  callHands: [
    "TT", "99", "88", "77", "66", "55", "44", "33", "22",
    "AJs", "ATs", "A9s", "A8s", "A7s", "A6s",
    "KQs", "KJs", "KTs", "K9s", "K8s", "K7s",
    "QJs", "QTs", "Q9s", "Q8s", "Q7s",
    "JTs", "J9s", "J8s",
    "T9s", "T8s", "T7s",
    "98s", "97s", "96s",
    "87s", "86s",
    "76s", "75s",
    "65s", "64s",
    "54s",
    "AQo", "AJo", "ATo", "A9o", "A8o", "A7o", "A6o", "A5o",
    "KQo", "KJo", "KTo", "K9o",
    "QJo", "QTo", "Q9o",
    "JTo", "J9o",
    "T9o",
  ],
});

// --- BB vs CO open ---
const bbVsCo = buildVsRfiRange({
  threeBetHands: [
    "AA", "KK", "QQ", "JJ", "AKs", "AQs", "A5s", "A4s", "AKo", "AQo",
  ],
  callHands: [
    "TT", "99", "88", "77", "66", "55", "44", "33", "22",
    "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A3s", "A2s",
    "KQs", "KJs", "KTs", "K9s", "K8s",
    "QJs", "QTs", "Q9s", "Q8s",
    "JTs", "J9s", "J8s",
    "T9s", "T8s",
    "98s", "97s",
    "87s", "86s",
    "76s", "75s",
    "65s",
    "54s",
    "AJo", "ATo", "A9o", "A8o",
    "KQo", "KJo", "KTo",
    "QJo", "QTo",
    "JTo",
  ],
});

// --- BB vs UTG open ---
const bbVsUtg = buildVsRfiRange({
  threeBetHands: ["AA", "KK", "QQ", "AKs", "AKo"],
  callHands: [
    "JJ", "TT", "99", "88", "77", "66", "55", "44", "33", "22",
    "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
    "KQs", "KJs", "KTs", "K9s",
    "QJs", "QTs", "Q9s",
    "JTs", "J9s",
    "T9s", "T8s",
    "98s", "97s",
    "87s",
    "76s",
    "65s",
    "54s",
    "AQo", "AJo", "ATo",
    "KQo", "KJo",
    "QJo",
  ],
});

// --- SB vs BTN open ---
const sbVsBtn = buildVsRfiRange({
  threeBetHands: [
    "AA", "KK", "QQ", "JJ", "AKs", "AQs", "A5s", "A4s", "AKo", "AQo",
  ],
  callHands: [
    "TT", "99", "88", "77", "66",
    "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A3s",
    "KQs", "KJs", "KTs",
    "QJs", "QTs",
    "JTs",
    "T9s",
    "98s",
    "87s",
    "76s",
    "AJo", "ATo",
    "KQo", "KJo",
    "QJo",
  ],
});

// --- SB vs CO open ---
const sbVsCo = buildVsRfiRange({
  threeBetHands: ["AA", "KK", "QQ", "AKs", "AQs", "AKo"],
  callHands: [
    "JJ", "TT", "99", "88", "77",
    "AJs", "ATs", "A9s", "A8s", "A5s",
    "KQs", "KJs", "KTs",
    "QJs", "QTs",
    "JTs",
    "T9s",
    "98s",
    "87s",
    "AJo", "ATo",
    "KQo",
  ],
});

export const vsRfiData: VsRfiData = {
  BTN: {
    UTG: btnVsUtg,
    CO:  btnVsCo,
  },
  CO: {
    HJ: coVsHj,
  },
  SB: {
    BTN: sbVsBtn,
    CO:  sbVsCo,
  },
  BB: {
    UTG: bbVsUtg,
    CO:  bbVsCo,
    BTN: bbVsBtn,
  },
};
