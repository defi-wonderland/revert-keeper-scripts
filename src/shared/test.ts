import {getMainnetSdk} from '@dethcrypto/eth-sdk-client';
import {defaultAbiCoder} from 'ethers/lib/utils';
import type {BigNumber} from 'ethers';
import {ADDRESS_ZERO, BLOCK_CREATION_CONTRACT} from '../utils/constants';
import {loadInitialSetup} from './setup';

const {provider, txSigner} = loadInitialSetup();

// Contracts Mainnet
const compoundorMainnet = getMainnetSdk(txSigner).compoundor;
const nonfungiblePositionManagerMainnet = getMainnetSdk(txSigner).nonfungiblePositionManager;

updateCache(1);

/**
 * @notice Fetches the tokensId which contains token0 or token1 includes in our whitelist.
 */

export async function updateCache(chain: number): Promise<number[]> {
  // List with sanitized tokensId
  const sanitizedTokensId: number[] = [];

  const compoundor = compoundorMainnet;
  const nonfungiblePositionManager = nonfungiblePositionManagerMainnet;

  // Gets the whitelist
  const whitelistedTokens = new Set(['0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', '0x6B175474E89094C44Da98b954EedeAC495271d0F']);

  const queryBlock = BLOCK_CREATION_CONTRACT;
  const evtFilter = compoundor.filters.TokenDeposited();
  const queryResults = await compoundor.queryFilter(evtFilter, queryBlock);
  console.info('Reading TokenDeposited events from the contract creation block', queryBlock);

  await Promise.all(
    queryResults.map(async (eventData) => {
      const tokenId: number = Number.parseInt(defaultAbiCoder.decode(['address', 'uint256'], eventData.data)[1] as string, 10);
      // The tokens that form the tokenId
      const position: PositionData = await nonfungiblePositionManager.positions(tokenId);
      // If token0 or token1 is in the whitelist
      if (whitelistedTokens.has(position.token0) || whitelistedTokens.has(position.token1)) {
        // Gets if that tokenId is the compoundor
        const ownerAddress = await compoundor.ownerOf(tokenId);
        // If owner is different than address zero the tokenId is in the compoundor
        if (ownerAddress !== ADDRESS_ZERO) {
          sanitizedTokensId.push(tokenId);
        }
      }
    }),
  );
  console.info('Tokens Id which sould be used to work', sanitizedTokensId);
  return sanitizedTokensId;
}

type PositionData = {
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
