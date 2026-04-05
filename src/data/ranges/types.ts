/** All nine full-ring positions in order from earliest to latest. */
export type Position =
  | "UTG"
  | "UTG1"
  | "UTG2"
  | "LJ"
  | "HJ"
  | "CO"
  | "BTN"
  | "SB"
  | "BB";

/** The three pre-flop quiz scenarios covered by the app. */
export type Scenario = "rfi" | "vs_rfi" | "vs_3bet";

/** Action available when raising first in. */
export type RfiAction = "open" | "fold";

/** Actions available when facing an open raise. */
export type VsRfiAction = "fold" | "call" | "3bet";

/** Actions available when you opened and face a 3-bet. */
export type Vs3betAction = "fold" | "call" | "4bet";

/**
 * One of the 169 canonical hand strings.
 * Format: high card + low card + optional suit suffix.
 * Examples: "AA", "AKs", "AKo", "72o"
 */
export type HandString = string;

/** RFI ranges indexed by [position][hand]. */
export type RfiData = Record<Position, Record<HandString, RfiAction>>;

/**
 * vs-RFI ranges indexed by [heroPosition][openerPosition][hand].
 * Sparse: a player cannot face an open from a later position.
 */
export type VsRfiData = Partial<
  Record<Position, Partial<Record<Position, Record<HandString, VsRfiAction>>>>
>;

/**
 * vs-3bet ranges indexed by [heroPosition][threeBettorPosition][hand].
 * Sparse: only positions where the hero could have opened and faced a 3-bet.
 */
export type Vs3betData = Partial<
  Record<Position, Partial<Record<Position, Record<HandString, Vs3betAction>>>>
>;
