import type {Contract} from 'ethers';
import {ethers} from 'ethers';
import {defaultAbiCoder} from 'ethers/lib/utils';
import {bytecode} from '../../solidity/artifacts/contracts/BatchPositions.sol/BatchPositions.json';

/**
 * @notice Fetches the tokensId which contains token0 or token1 includes in our whitelist.
 */
export async function updateCache(compoundJob: Contract, compoundor: Contract, nonfungiblePositionManager: Contract): Promise<number[]> {
  const beforeSanitizedTokensId: number[] = [];

  const evtDepositFilter = compoundor.filters.TokenDeposited();
  const depositEvents = await compoundor.queryFilter(evtDepositFilter);
  const evtWithdrawFilter = compoundor.filters.TokenWithdrawn();
  const withdrawalEvents = await compoundor.queryFilter(evtWithdrawFilter);

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
  const payload = bytecode.concat(inputData.slice(2));

  // Call the deployment transaction with the payload
  const returnedData = await compoundJob.provider.call({data: payload});
  const [decoded] = ethers.utils.defaultAbiCoder.decode(['uint256[]'], returnedData);

  const decodedToNumber: number[] = [];
  for (const [i, element] of decoded.entries()) {
    decodedToNumber[i] = Number.parseInt(element as unknown as string, 10);
  }

  return decodedToNumber;
}
