export * from "../actions/swap.ts";
export * from "../actions/transfer.ts";
export * from "../providers/wallet.ts";
export * from "../types/index.ts";

import type { Plugin } from "@elizaos/core";
import { swapAction } from "../actions/swap.ts";
import { transferAction } from "../actions/transfer.ts";
import { walletInfoAction } from "../actions/wallet-info.ts";
import { evmWalletProvider } from "../providers/wallet.ts";
import { quoteAction } from "../actions/quote.ts";

export const espressoxPlugin: Plugin = {
  name: "espressox",
  description: "Includes actions for transferring, bridging, and cross swapping tokens use EspressoX rollup",
  providers: [evmWalletProvider],
  evaluators: [],
  services: [],
  actions: [transferAction, swapAction, walletInfoAction, quoteAction],
};

export default espressoxPlugin;