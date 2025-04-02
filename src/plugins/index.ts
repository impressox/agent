export * from "../actions/bridge.ts";
export * from "../actions/swap.ts";
export * from "../actions/transfer.ts";
export * from "../providers/wallet.ts";
export * from "../types/index.ts";

import type { Plugin } from "@elizaos/core";
import { bridgeAction } from "../actions/bridge.ts";
import { swapAction } from "../actions/swap.ts";
import { transferAction } from "../actions/transfer.ts";
import { walletInfoAction } from "../actions/wallet-info.ts";
import { evmWalletProvider } from "../providers/wallet.ts";

export const espressoxPlugin: Plugin = {
  name: "espressox",
  description: "Includes actions for transferring, bridging, and swapping tokens on the EspressoX network",
  providers: [evmWalletProvider],
  evaluators: [],
  services: [],
  actions: [transferAction, bridgeAction, swapAction, walletInfoAction],
};

export default espressoxPlugin;