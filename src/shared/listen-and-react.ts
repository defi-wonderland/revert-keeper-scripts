import type {Contract, providers, BigNumber} from 'ethers';
import {ethers} from 'ethers';
import {defaultAbiCoder} from 'ethers/lib/utils';
import BatchPositions from '../../solidity/artifacts/contracts/BatchPositions.sol/BatchPositions.json';

export async function deleteSanitizedToken(provider: providers.JsonRpcProvider, oldTokenId: number, compoundor: Contract): Promise<number> {
  // Listen and react to event token withdrawn
  provider.on(compoundor.filters.TokenWithdrawn(), async (eventData) => {
    const tokenIdWithdraw: number = Number.parseInt(defaultAbiCoder.decode(['address', 'address', 'uint256'], eventData.data)[2] as string, 10);
    oldTokenId = tokenIdWithdraw;
  });
  return oldTokenId;
}

export async function addSanitizedToken(
  provider: providers.JsonRpcProvider,
  newTokenId: number,
  compoundJob: Contract,
  compoundor: Contract,
  nonfungiblePositionManager: Contract,
): Promise<number> {
  // Listen and react to events like creation of new poolManager.
  provider.on(compoundor.filters.TokenDeposited(), async (eventData) => {
    const tokenIdDeposited: number = Number.parseInt(defaultAbiCoder.decode(['address', 'uint256'], eventData.data)[1] as string, 10);
    const beforeNewSanitizedTokensId: number[] = [];
    beforeNewSanitizedTokensId[0] = tokenIdDeposited;
    const inputData = ethers.utils.defaultAbiCoder.encode(
      ['address', 'address', 'uint256[]'],
      [compoundJob.address, nonfungiblePositionManager.address, beforeNewSanitizedTokensId],
    );

    // Generate payload from input data
    const payload = BatchPositions.bytecode.concat(inputData.slice(2));

    // Call the deployment transaction with the payload
    const returnedData = await compoundJob.provider.call({data: payload});
    const [afterSanitizedTokensId] = ethers.utils.defaultAbiCoder.decode(['uint256[]'], returnedData) as [BigNumber[]];
    newTokenId = afterSanitizedTokensId.map((tokenId) => tokenId.toNumber())[0];
  });
  return newTokenId;
}
