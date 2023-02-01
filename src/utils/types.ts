import type {BlockListener, Flashbots, UnsubscribeFunction} from '@keep3r-network/keeper-scripting-utils';
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

export type PositionData = {
  nonce: BigNumber;
  operator: string;
  token0: string;
  token1: string;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: BigNumber;
  feeGrowthInside0LastX128: BigNumber;
  feeGrowthInside1LastX128: BigNumber;
  tokensOwed0: BigNumber;
  tokensOwed1: BigNumber;
};

export const FLASHBOTS_RPC_BY_CHAINID: Record<ChainId, string> = {
  1: 'https://relay.flashbots.net',
  5: 'https://relay-goerli.flashbots.net',
};
