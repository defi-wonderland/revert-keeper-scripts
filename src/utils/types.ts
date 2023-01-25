import type {BlockListener, Flashbots, UnsubscribeFunction} from '@keep3r-network/keeper-scripting-utils';
import type {BigNumber, providers, Wallet} from 'ethers';

export type Address = string;
export type LastWorkAtMap = Record<string, BigNumber>;
export type UnsubscribePoolManagerMap = Record<string, UnsubscribeFunction>;
export type WorkDataMap = Record<string, string>;
export type TokenIdWorkInProgressMap = Record<string, boolean>;

export type InitialSetup = {
  provider: providers.JsonRpcProvider; // TODO switch to wss on prod
  // provider: providers.WebSocketProvider;
  txSigner: Wallet;
  bundleSigner: Wallet;
};

export type RunSetup = {
  blockListener: BlockListener;
  lastWorkAt: LastWorkAtMap;
  tokenIdWorkInProgress: TokenIdWorkInProgressMap;
  unsubscribePoolManager: UnsubscribePoolManagerMap;
  workData: WorkDataMap;
};

export type TryToWorkTokenId = (tokenId: string, flashFlashbots: Flashbots) => Promise<void>;

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
