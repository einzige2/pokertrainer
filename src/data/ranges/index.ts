import { rfiData } from "./rfi";
import { vsRfiData } from "./vs-rfi";
import { vs3betData } from "./vs-3bet";
import type { Position, RfiAction, VsRfiAction, Vs3betAction } from "./types";

export * from "./types";
export { rfiData } from "./rfi";
export { vsRfiData } from "./vs-rfi";
export { vs3betData } from "./vs-3bet";

/**
 * Returns the GTO action for a given RFI spot.
 * Defaults to "fold" if the hand is not in the dataset (should not happen
 * if range data is complete, but guards against any gaps).
 */
export const getRfiAction = (args: {
  position: Position;
  hand: string;
}): RfiAction => {
  const { position, hand } = args;
  return rfiData[position][hand] ?? "fold";
};

/**
 * Returns the GTO action when facing a raise.
 * Returns undefined if the spot (hero + opener position combo) is not in the dataset.
 */
export const getVsRfiAction = (args: {
  heroPosition: Position;
  openerPosition: Position;
  hand: string;
}): VsRfiAction | undefined => {
  const { heroPosition, openerPosition, hand } = args;
  return vsRfiData[heroPosition]?.[openerPosition]?.[hand];
};

/**
 * Returns the GTO action when facing a 3-bet.
 * Returns undefined if the spot is not in the dataset.
 */
export const getVs3betAction = (args: {
  heroPosition: Position;
  threeBettorPosition: Position;
  hand: string;
}): Vs3betAction | undefined => {
  const { heroPosition, threeBettorPosition, hand } = args;
  return vs3betData[heroPosition]?.[threeBettorPosition]?.[hand];
};
