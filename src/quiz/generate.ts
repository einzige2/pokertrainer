import { Database } from "bun:sqlite";
import { getTodaysSentCombos } from "../db/quiz-history";
import { getRfiAction, getVsRfiAction, getVs3betAction } from "../data/ranges/index";
import type { Position, Scenario } from "../data/ranges/types";
import { rfiData, vsRfiData, vs3betData } from "../data/ranges/index";

export type QuestionSpec = {
  position: Position;
  scenario: Scenario;
  openerPosition: Position | null;
  hand: string;
  correctAction: string;
};

/** All available position keys. */
const ALL_POSITIONS: Position[] = [
  "UTG", "UTG1", "UTG2", "LJ", "HJ", "CO", "BTN", "SB", "BB",
];

/** Picks a random element from an array. Returns undefined for empty arrays. */
const pickRandom = <T>(arr: T[]): T | undefined =>
  arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : undefined;

/**
 * Builds a list of all available (position, scenario, openerPosition, hand) combos
 * that have a defined range in our dataset.
 */
const buildAllCombos = (): Array<Omit<QuestionSpec, "correctAction">> => {
  const combos: Array<Omit<QuestionSpec, "correctAction">> = [];

  // RFI combos — all positions except BB (no RFI from BB)
  for (const pos of ALL_POSITIONS) {
    if (pos === "BB") continue;
    const range = rfiData[pos];
    for (const hand of Object.keys(range)) {
      combos.push({ position: pos, scenario: "rfi", openerPosition: null, hand });
    }
  }

  // vs-RFI combos — only positions/opener pairs in our dataset
  for (const heroPos of Object.keys(vsRfiData) as Position[]) {
    const openerMap = vsRfiData[heroPos];
    if (openerMap == null) continue;
    for (const openerPos of Object.keys(openerMap) as Position[]) {
      const range = openerMap[openerPos];
      if (range == null) continue;
      for (const hand of Object.keys(range)) {
        combos.push({
          position: heroPos,
          scenario: "vs_rfi",
          openerPosition: openerPos,
          hand,
        });
      }
    }
  }

  // vs-3bet combos — only positions/3bettor pairs in our dataset
  for (const heroPos of Object.keys(vs3betData) as Position[]) {
    const threeBettorMap = vs3betData[heroPos];
    if (threeBettorMap == null) continue;
    for (const threeBettorPos of Object.keys(threeBettorMap) as Position[]) {
      const range = threeBettorMap[threeBettorPos];
      if (range == null) continue;
      for (const hand of Object.keys(range)) {
        combos.push({
          position: heroPos,
          scenario: "vs_3bet",
          openerPosition: threeBettorPos,
          hand,
        });
      }
    }
  }

  return combos;
};

// Cache at module load time — range data is static
const ALL_COMBOS = buildAllCombos();

/**
 * Generates a single quiz question for a user, avoiding combos already sent today.
 * Returns undefined if no unique combos remain (e.g., daily_count exceeds dataset size).
 */
export const generateQuestion = (args: {
  db: Database;
  userId: number;
  todayMidnight: string;
}): QuestionSpec | undefined => {
  const { db, userId, todayMidnight } = args;

  const alreadySent = getTodaysSentCombos({ db, userId, todayMidnight });
  const sentSet = new Set(
    alreadySent.map((r) => `${r.position}|${r.scenario}|${r.hand}`)
  );

  const available = ALL_COMBOS.filter(
    (c) => !sentSet.has(`${c.position}|${c.scenario}|${c.hand}`)
  );

  const combo = pickRandom(available);
  if (combo == null) return undefined;

  const correctAction = resolveAction(combo);
  if (correctAction == null) return undefined;

  return { ...combo, correctAction };
};

/**
 * Resolves the correct action for a given combo from the range data.
 */
const resolveAction = (
  combo: Omit<QuestionSpec, "correctAction">
): string | undefined => {
  const { position, scenario, openerPosition, hand } = combo;

  if (scenario === "rfi") {
    return getRfiAction({ position, hand });
  }

  if (scenario === "vs_rfi") {
    if (openerPosition == null) return undefined;
    return getVsRfiAction({ heroPosition: position, openerPosition, hand });
  }

  // vs_3bet
  if (openerPosition == null) return undefined;
  return getVs3betAction({ heroPosition: position, threeBettorPosition: openerPosition, hand });
};
