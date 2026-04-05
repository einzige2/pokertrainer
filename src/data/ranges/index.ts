import * as rfiModule from "./rfi";
import * as vsRfiModule from "./vs-rfi";
import * as vs3betModule from "./vs-3bet";
import type * as rangeTypes from "./types";

export * from "./types";
export { rfiData } from "./rfi";
export { vsRfiData } from "./vs-rfi";
export { vs3betData } from "./vs-3bet";

/**
 * Returns the GTO action for a given RFI spot.
 * Defaults to "fold" if the hand is not in the dataset.
 */
export const getRfiAction = (args: {
  position: rangeTypes.Position;
  hand: string;
}): rangeTypes.RfiAction => {
  const { position, hand } = args;
  return rfiModule.rfiData[position][hand] ?? "fold";
};

/**
 * Returns the GTO action when facing a raise.
 * Returns undefined if the spot is not in the dataset.
 */
export const getVsRfiAction = (args: {
  heroPosition: rangeTypes.Position;
  openerPosition: rangeTypes.Position;
  hand: string;
}): rangeTypes.VsRfiAction | undefined => {
  const { heroPosition, openerPosition, hand } = args;
  return vsRfiModule.vsRfiData[heroPosition]?.[openerPosition]?.[hand];
};

/**
 * Returns the GTO action when facing a 3-bet.
 * Returns undefined if the spot is not in the dataset.
 */
export const getVs3betAction = (args: {
  heroPosition: rangeTypes.Position;
  threeBettorPosition: rangeTypes.Position;
  hand: string;
}): rangeTypes.Vs3betAction | undefined => {
  const { heroPosition, threeBettorPosition, hand } = args;
  return vs3betModule.vs3betData[heroPosition]?.[threeBettorPosition]?.[hand];
};
