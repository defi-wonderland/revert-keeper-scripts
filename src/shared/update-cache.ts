import {BigNumber, Contract} from 'ethers';
import {ethers} from 'ethers';
import {defaultAbiCoder} from 'ethers/lib/utils';
import * as BatchPositions from '../../solidity/artifacts/contracts/BatchPositions.sol/BatchPositions.json';

/**
 * @notice Fetches the tokensId which contains token0 or token1 includes in our whitelist.
 */
export async function updateCache(compoundJob: Contract, compoundor: Contract, nonfungiblePositionManager: Contract, fromBlockOrBlockHash?: ethers.providers.BlockTag): Promise<number[]> {
  const beforeSanitizedTokensId: number[] = [];

  const evtDepositFilter = compoundor.filters.TokenDeposited();
  const depositEvents = await compoundor.queryFilter(evtDepositFilter, fromBlockOrBlockHash, 'latest');
  const evtWithdrawFilter = compoundor.filters.TokenWithdrawn();
  const withdrawalEvents = await compoundor.queryFilter(evtWithdrawFilter, fromBlockOrBlockHash, 'latest');

  const filteredResults = depositEvents.filter((addEvent) => {
    const wasLaterWithdrawn = withdrawalEvents.find(
      (rmEvent) => rmEvent.args!.tokenId.toString() === addEvent.args!.tokenId.toString() && rmEvent.blockNumber > addEvent.blockNumber,
    );
    return !wasLaterWithdrawn;
  });

  await Promise.all(
    filteredResults.map(async (eventData) => {
      const tokenId = Number.parseInt(defaultAbiCoder.decode(['address', 'uint256'], eventData.data)[1] as string, 10);
      beforeSanitizedTokensId.push(tokenId);
    }),
  );

  const inputData = ethers.utils.defaultAbiCoder.encode(
    ['address', 'address', 'uint256[]'],
    [compoundJob.address, nonfungiblePositionManager.address, beforeSanitizedTokensId],
  );

  // Generate payload from input data
  const payload = BatchPositions.bytecode.concat(inputData.slice(2));

  // Call the deployment transaction with the payload
  const returnedData = await compoundJob.provider.call({data: payload});
  const [sanitizedTokensId] = ethers.utils.defaultAbiCoder.decode(['uint256[]'], returnedData) as [BigNumber[]];
  return sanitizedTokensId.map((tokenId) => tokenId.toNumber());
}
