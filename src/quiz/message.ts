import * as handsModule from "@/data/hands";
import * as rangesModule from "@/data/ranges/index";
import type * as rangeTypes from "@/data/ranges/types";

/** Human-readable labels for positions. */
const POSITION_LABELS: Record<rangeTypes.Position, string> = {
  UTG:  "UTG",
  UTG1: "UTG+1",
  UTG2: "UTG+2",
  LJ:   "LJ",
  HJ:   "HJ",
  CO:   "CO",
  BTN:  "BTN",
  SB:   "SB",
  BB:   "BB",
};

/**
 * Formats the scenario line for a quiz question SMS.
 * Examples:
 *   rfi, BTN         → "BTN | FTR"
 *   vs_rfi, CO, UTG  → "CO | vs UTG open"
 *   vs_3bet, BTN, BB → "BTN | you opened, BB 3-bet"
 */
export const formatScenarioLine = (args: {
  position: rangeTypes.Position;
  scenario: rangeTypes.Scenario;
  openerPosition: rangeTypes.Position | null;
}): string => {
  const { position, scenario, openerPosition } = args;
  const pos = POSITION_LABELS[position];

  if (scenario === "rfi") {
    return `${pos} | FTR`;
  }

  if (scenario === "vs_rfi") {
    const opener = openerPosition != null ? POSITION_LABELS[openerPosition] : "?";
    return `${pos} | vs ${opener} open`;
  }

  // vs_3bet
  const threeBettor = openerPosition != null ? POSITION_LABELS[openerPosition] : "?";
  return `${pos} | you opened, ${threeBettor} 3-bet`;
};

/** Reply prompts per scenario. */
const REPLY_PROMPTS: Record<rangeTypes.Scenario, string> = {
  rfi:     "Reply: O (open) / F (fold)",
  vs_rfi:  "Reply: C (call) / 3 (3-bet) / F (fold)",
  vs_3bet: "Reply: C (call) / 4 (4-bet) / F (fold)",
};

/**
 * Formats a full quiz question SMS message.
 * Example:
 *   "BTN | FTR | A♠K♣
 *    Reply: O (open) / F (fold)"
 */
export const formatQuestion = (args: {
  position: rangeTypes.Position;
  scenario: rangeTypes.Scenario;
  openerPosition: rangeTypes.Position | null;
  hand: string;
}): string => {
  const { position, scenario, openerPosition, hand } = args;
  const scenarioLine = formatScenarioLine({ position, scenario, openerPosition });
  const displayHand = handsModule.randomDisplayHand(hand);
  const prompt = REPLY_PROMPTS[scenario];
  return `${scenarioLine} | ${displayHand}\n${prompt}`;
};

/**
 * Formats the feedback SMS sent after a user answers.
 * For correct answers: "Correct! AKs is an open from BTN."
 * For wrong answers:   "Incorrect. KJo is a fold from UTG. Opens include: AA, KK..."
 */
export const formatFeedback = (args: {
  isCorrect: boolean;
  hand: string;
  correctAction: string;
  position: rangeTypes.Position;
  scenario: rangeTypes.Scenario;
}): string => {
  const { isCorrect, hand, correctAction, position, scenario } = args;
  const pos = POSITION_LABELS[position];

  if (isCorrect) {
    return `Correct! ${hand} is a ${correctAction} from ${pos}.`;
  }

  if (scenario === "rfi") {
    const hint = buildRfiHint({ position });
    return `Incorrect. ${hand} is a ${correctAction} from ${pos}.${hint}`;
  }

  return `Incorrect. ${hand} is a ${correctAction} from ${pos}.`;
};

/**
 * Builds a short range hint for RFI feedback.
 * Lists a sample of hands in the position's opening range as context.
 */
const buildRfiHint = (args: { position: rangeTypes.Position }): string => {
  const { position } = args;
  const topHands = ["AA", "KK", "QQ", "JJ", "TT", "AKs", "AQs", "AKo"].filter(
    (h) => rangesModule.getRfiAction({ position, hand: h }) === "open"
  );
  if (topHands.length === 0) return "";
  return ` Opens include: ${topHands.slice(0, 5).join(", ")}...`;
};
