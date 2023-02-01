import type {Contract, providers} from 'ethers';
import type {Flashbots} from '@keep3r-network/keeper-scripting-utils';
import {defaultAbiCoder} from 'ethers/lib/utils';
import type {Address, PositionData} from '../utils/types';
import {ADDRESS_ZERO} from '../utils/constants';

export async function deleteSanitizedToken(
  provider: providers.JsonRpcProvider,
  sanitizedTokensId: number[],
  compoundor: Contract,
): Promise<number[]> {
  // Listen and react to event token withdrawn
  provider.on(compoundor.filters.TokenWithdrawn(), async (eventData) => {
    const tokenIdWithdraw: number = Number.parseInt(defaultAbiCoder.decode(['address', 'address', 'uint256'], eventData.data)[2] as string, 10);
    console.log('^^^^^^^^^^^^^^^^^ TOKEN ID WIHDRAWN FROM COMPOUNDOR ^^^^^^^^^^^^^^^^^', tokenIdWithdraw);
    const index = sanitizedTokensId.indexOf(tokenIdWithdraw);
    sanitizedTokensId.splice(index, 1);
  });
  return sanitizedTokensId;
}

export async function addSanitizedToken(
  provider: providers.JsonRpcProvider,
  sanitizedTokensId: number[],
  newTokenId: number,
  compoundJob: Contract,
  compoundor: Contract,
  nonfungiblePositionManager: Contract,
): Promise<[number[], number]> {
  // Listen and react to events like creation of new poolManager.
  provider.on(compoundor.filters.TokenDeposited(), async (eventData) => {
    const tokenIdDeposited: number = Number.parseInt(defaultAbiCoder.decode(['address', 'uint256'], eventData.data)[1] as string, 10);
    const position: PositionData = await nonfungiblePositionManager.positions(tokenIdDeposited);
    const whitelistedTokens = new Set<Address>(await compoundJob.getWhitelistedTokens());

    if (whitelistedTokens.has(position.token0) || whitelistedTokens.has(position.token1)) {
      const ownerAddress = await compoundor.ownerOf(tokenIdDeposited);

      if (ownerAddress !== ADDRESS_ZERO) {
        sanitizedTokensId.push(tokenIdDeposited);
      }
    }
  });
  return [sanitizedTokensId, newTokenId];
}
