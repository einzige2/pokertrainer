import { randomDisplayHand } from "../data/hands";
import { getRfiAction } from "../data/ranges/index";
import type { Position, Scenario } from "../data/ranges/types";

/** Human-readable labels for positions. */
const POSITION_LABELS: Record<Position, string> = {
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
  position: Position;
  scenario: Scenario;
  openerPosition: Position | null;
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
const REPLY_PROMPTS: Record<Scenario, string> = {
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
  position: Position;
  scenario: Scenario;
  openerPosition: Position | null;
  hand: string;
}): string => {
  const { position, scenario, openerPosition, hand } = args;
  const scenarioLine = formatScenarioLine({ position, scenario, openerPosition });
  const displayHand = randomDisplayHand(hand);
  const prompt = REPLY_PROMPTS[scenario];
  return `${scenarioLine} | ${displayHand}\n${prompt}`;
};

/**
 * Formats the feedback SMS sent after a user answers.
 * For correct answers: "Correct! AKs is an open from BTN."
 * For wrong answers:   "Incorrect. KJo is a fold from UTG. Open range: QQ+, AKs, AKo."
 */
export const formatFeedback = (args: {
  isCorrect: boolean;
  hand: string;
  correctAction: string;
  position: Position;
  scenario: Scenario;
}): string => {
  const { isCorrect, hand, correctAction, position, scenario } = args;
  const pos = POSITION_LABELS[position];

  if (isCorrect) {
    return `Correct! ${hand} is a ${correctAction} from ${pos}.`;
  }

  // For RFI, include a brief hint about the range boundary
  if (scenario === "rfi") {
    const hint = buildRfiHint({ position, correctAction });
    return `Incorrect. ${hand} is a ${correctAction} from ${pos}.${hint}`;
  }

  return `Incorrect. ${hand} is a ${correctAction} from ${pos}.`;
};

/**
 * Builds a short range hint for RFI feedback.
 * Lists the top hands in the position's opening range as context.
 */
const buildRfiHint = (args: {
  position: Position;
  correctAction: string;
}): string => {
  const { position } = args;

  // Show top of the opening range as a quick reference
  const topHands = [
    "AA", "KK", "QQ", "JJ", "TT", "AKs", "AQs", "AKo",
  ].filter((h) => getRfiAction({ position, hand: h }) === "open");

  if (topHands.length === 0) return "";
  const sample = topHands.slice(0, 5).join(", ");
  return ` Opens include: ${sample}...`;
};

