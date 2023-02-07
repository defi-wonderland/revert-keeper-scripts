import type {BlockListener, UnsubscribeFunction} from '@keep3r-network/keeper-scripting-utils';
import type {BigNumber} from 'ethers';

export type LastWorkAtMap = Record<string, BigNumber>;
export type UnsubscribePoolManagerMap = Record<string, UnsubscribeFunction>;
export type WorkDataMap = Record<string, string>;
export type TokenIdWorkInProgressMap = Record<string, boolean>;
export type ChainId = number;
export type Address = string;

export type RunSetup = {
  blockListener: BlockListener;
  lastWorkAt: LastWorkAtMap;
  tokenIdWorkInProgress: TokenIdWorkInProgressMap;
  unsubscribePoolManager: UnsubscribePoolManagerMap;
  workData: WorkDataMap;
};

export const FLASHBOTS_RPC_BY_CHAINID: Record<ChainId, string> = {
  1: 'https://relay.flashbots.net',
  5: 'https://relay-goerli.flashbots.net',
};
