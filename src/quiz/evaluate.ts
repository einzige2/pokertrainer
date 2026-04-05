import type { Scenario } from "../data/ranges/types";

/** Maps raw reply characters to canonical action strings per scenario. */
const SCENARIO_CODES: Record<Scenario, Record<string, string>> = {
  rfi:     { O: "open", F: "fold" },
  vs_rfi:  { C: "call", "3": "3bet", F: "fold" },
  vs_3bet: { C: "call", "4": "4bet", F: "fold" },
};

type ParseResult =
  | { ok: true; action: string }
  | { ok: false; hint: string };

/**
 * Parses a raw SMS reply into a canonical action string for the given scenario.
 * Trims whitespace, uppercases, and takes the first character.
 * Returns an error hint string if the reply is not a valid code.
 */
export const parseReply = (args: {
  reply: string;
  scenario: Scenario;
}): ParseResult => {
  const { reply, scenario } = args;
  const key = reply.trim().toUpperCase()[0] ?? "";
  const codes = SCENARIO_CODES[scenario];
  const action = codes[key];

  if (action == null) {
    const hint = Object.entries(codes)
      .map(([k, v]) => `${k} (${v})`)
      .join(" / ");
    return { ok: false, hint: `Reply: ${hint}` };
  }

  return { ok: true, action };
};

/**
 * Returns true if the parsed action matches the stored correct action.
 */
export const isCorrectAnswer = (args: {
  parsedAction: string;
  correctAction: string;
}): boolean => {
  const { parsedAction, correctAction } = args;
  return parsedAction === correctAction;
};
