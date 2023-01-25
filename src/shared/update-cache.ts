import type {Contract} from 'ethers';
import {defaultAbiCoder} from 'ethers/lib/utils';
import type {Address, PositionData} from '../utils/types';
import {ADDRESS_ZERO, BLOCK_CREATION_CONTRACT} from '../utils/constants';
import {loadInitialSetup} from './setup';

const {provider} = loadInitialSetup();

/**
 * @notice Fetches the tokensId which contains token0 or token1 includes in our whitelist.
 */
export async function updateCache(compoundJob: Contract, compoundor: Contract, nonfungiblePositionManager: Contract): Promise<number[]> {
  // List with sanitized tokensId
  const sanitizedTokensId: number[] = [];

  const whitelistedTokens = new Set<Address>(await compoundJob.getWhitelistedTokens());

  const queryBlock = BLOCK_CREATION_CONTRACT;
  const evtFilter = compoundor.filters.TokenDeposited();
  const queryResults = await compoundor.queryFilter(evtFilter, queryBlock);
  console.info('Reading TokenDeposited events from the contract creation blockyarn', queryBlock);

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
