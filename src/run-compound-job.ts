import type {Flashbots, UnsubscribeFunction} from '@keep3r-network/keeper-scripting-utils';
import {
  sendTx,
  BlockListener,
  createBundlesWithSameTxs,
  sendAndRetryUntilNotWorkable,
  makeid,
  getMainnetGasType2Parameters,
  populateTransactions,
} from '@keep3r-network/keeper-scripting-utils';
import type {TransactionRequest} from '@ethersproject/abstract-provider';
import {Wallet} from 'ethers';
import type {Signer, providers, Overrides, Contract} from 'ethers';
import {getMainnetSdk} from '@dethcrypto/eth-sdk-client';
import {getEnvVariable, stopSubscription} from './utils/misc';
import {updateCache} from './shared/update-cache';
import {deleteSanitizedToken, addSanitizedToken} from './shared/listen-and-react';
import {BURST_SIZE, FUTURE_BLOCKS, PRIORITY_FEE} from './utils/constants';

export async function runJob(
  compoundJob: Contract,
  provider: providers.JsonRpcProvider,
  flashbots: Flashbots | undefined,
  txSigner: Signer,
  tryToWorkTokenId: (
    tokenId: number,
    compoundor: Contract,
    compoundJob: Contract,
    provider: providers.JsonRpcProvider,
    blockListener: BlockListener,
    flashbots: Flashbots | undefined,
  ) => Promise<void>,
) {
  const {nonfungiblePositionManager, compoundor} = getMainnetSdk(txSigner);
  const compoundors: string[] = await compoundJob.getWhitelistedCompoundors();
  const blockListener = new BlockListener(provider);
  let newTokenId = 0;

  for (const compoundorAddress of compoundors) {
    const compoundorContract = compoundor.attach(compoundorAddress);
    let sanitizedTokensId: number[] = await updateCache(compoundJob, compoundorContract, nonfungiblePositionManager);

    for (const tokenId of sanitizedTokensId) {
      await tryToWorkTokenId(tokenId, compoundorContract, compoundJob, provider, blockListener, flashbots);
    }

    // Listen delete
    sanitizedTokensId = await deleteSanitizedToken(provider, sanitizedTokensId, compoundorContract);

    // Listen add
    [sanitizedTokensId, newTokenId] = await addSanitizedToken(
      provider,
      sanitizedTokensId,
      newTokenId,
      compoundJob,
      compoundorContract,
      nonfungiblePositionManager,
    );

    if (newTokenId != 0) {
      console.log('^^^^^^^^^^^^^^^^^ TOKEN ID ADDED TO COMPOUNDOR ^^^^^^^^^^^^^^^^^', newTokenId);
      await tryToWorkTokenId(newTokenId, compoundorContract, compoundJob, provider, blockListener, flashbots);
    }
  }
}

export const tryToWorkOnFlashbots = async (
  tokenId: number,
  compoundor: Contract,
  compoundJob: Contract,
  provider: providers.JsonRpcProvider,
  blockListener: BlockListener,
  flashbots: Flashbots | undefined,
) => {
  console.log('Start Working on compound job with token ID:', tokenId);
  if (!flashbots) return;

  const txSigner = new Wallet(getEnvVariable('TX_SIGNER_MAINNET_PRIVATE_KEY'), provider);

  // Get the chain Id
  const {chainId} = await provider.getNetwork();
  // Creates a mapping that keeps track of whether we have sent a bundle to try to work a job.
  const tokenIdWorkInProgress: Record<number, boolean> = {};
  const unsubscribeTokenId: Record<number, UnsubscribeFunction> = {};

  stopSubscription(unsubscribeTokenId, tokenId);

  unsubscribeTokenId[tokenId] = blockListener.stream(async (block) => {
    // If a block arrives and there are bundles in progress, we return
    if (tokenIdWorkInProgress[tokenId]) return;
    if (block.number % 100 != tokenId % 100) return;

    const isWorkable = async () => {
      try {
        await compoundJob.callStatic.work(tokenId, compoundor);
        return true;
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          !error.message.includes('CompoundNotWorkable()') &&
          !error.message.includes('V2Keep3rJob::work:not-workable')
        ) {
          console.log(`Failed when attempting to call work statically. tokenId: ${tokenId}. Message: ${error.message}. Returning.`);
        }

        return false;
      }
    };

    if (!(await isWorkable())) return;

    console.log(`Attempting to work ${tokenId} statically succeeded. Preparing real transaction...`);

    // If the tokenId is workable, we optimistically set the tokenIdWorkInProgress[tokenId] mapping to true, as we will send a bundle
    tokenIdWorkInProgress[tokenId] = true;

    try {
      // Get the signer's (keeper) current nonce
      const currentNonce = await provider.getTransactionCount(txSigner.address);

      const blocksAhead = FUTURE_BLOCKS + BURST_SIZE;

      const firstBlockOfBatch = block.number + FUTURE_BLOCKS;

      // Fetch the priorityFeeInGwei and maxFeePerGas parameters from the getMainnetGasType2Parameters function
      const {priorityFeeInGwei, maxFeePerGas} = getMainnetGasType2Parameters({
        block,
        blocksAhead,
        priorityFeeInWei: PRIORITY_FEE,
      });

      console.log('Successfully calculated gas parameters. Populating Transactions...');

      // We declare what options we would like our transaction to have
      const options: Overrides = {
        gasLimit: 5_000_000,
        nonce: currentNonce,
        maxFeePerGas,
        maxPriorityFeePerGas: priorityFeeInGwei,
        type: 2,
      };

      // We populate the transactions we will use in our bundles.
      // Note: when the txs we are going to include in our batch are different between one another, we must ensure BURST_SIZE = len(functionArgs)
      //       this is why we populate the functionArgs like this
      const txs: TransactionRequest[] = await populateTransactions({
        chainId,
        contract: compoundJob,
        functionArgs: new Array(BURST_SIZE).fill(null).map(() => [tokenId, compoundor]),
        functionName: 'work',
        options,
      });

      console.log('Transactions populated successfully. Creating bundles...');

      const bundles = createBundlesWithSameTxs({
        unsignedTxs: txs,
        burstSize: BURST_SIZE,
        firstBlockOfBatch,
      });

      console.log('Bundles created successfuly');

      const result = await sendAndRetryUntilNotWorkable({
        txs,
        provider,
        priorityFeeInWei: PRIORITY_FEE,
        signer: txSigner,
        bundles,
        newBurstSize: BURST_SIZE,
        flashbots,
        isWorkableCheck: async () => isWorkable(),
        staticDebugId: tokenId.toString(),
        dynamicDebugId: makeid(5),
      });

      // If the bundle was included, we console log the success
      if (result) console.log('===== Tx SUCCESS =====', tokenId);

      // Restart the entire process
      await tryToWorkOnFlashbots(tokenId, compoundor, compoundJob, provider, blockListener, flashbots);
    } catch (error: unknown) {
      console.error(error);
    } finally {
      // We need to set tokenId as not in progress anymore.
      tokenIdWorkInProgress[tokenId] = false;
    }
  });
};

export const tryToWorkOnMempool = async (
  tokenId: number,
  compoundor: Contract,
  compoundJob: Contract,
  provider: providers.JsonRpcProvider,
  blockListener: BlockListener,
  flashbot: Flashbots | undefined,
) => {
  console.log('Start Working on compound job with token ID:', tokenId);

  let txInProgress = false;

  blockListener.stream(async (block) => {
    /*
			   If the tokenId is workable, and a new block comes, check if there's already a transaction in progress. Return if there is one.
			   We do this to avoid sending multiple transactions that try to work the same tokenId.
			*/
    if (txInProgress) return;
    if (block.number % 1000 != tokenId % 1000) return;
    console.log('block:', block.number);

    const isWorkable = async () => {
      try {
        await compoundJob.callStatic.work(tokenId, compoundor.address);
        return true;
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          !error.message.includes('CompoundNotWorkable()') &&
          !error.message.includes('V2Keep3rJob::work:not-workable')
        ) {
          console.log(`Failed when attempting to call work statically. tokenId: ${tokenId}. Message: ${error.message}. Returning.`);
        }

        return false;
      }
    };

    if (!(await isWorkable())) return;

    console.log(`Attempting to work ${tokenId} statically succeeded. Preparing real transaction...`);

    try {
      // If there's a transaction in progress we return.
      if (txInProgress) return;

      // If there isn't a transaction in progress, we will send a transaction, so we optimistically set txInProgress to true.
      txInProgress = true;

      const gasFees = await provider.getGasPrice();

      // Create an object containing the fields we would like to add to our transaction.
      const options: Overrides = {
        gasLimit: 1_000_000,
        gasPrice: gasFees.mul(12).div(10).toNumber(),
        // MaxPriorityFeePerGas: toGwei(Math.ceil(gasFees.mul(2).div(10).toNumber())),
        type: 0,
      };

      // Send the transaction
      await sendTx({
        contractCall: () =>
          compoundJob.work(tokenId, compoundor.address, {
            ...options,
          }),
      });

      console.log(`===== Tx SUCCESS IN BLOCK ${block.number} =====`, tokenId);
    } catch (error: any) {
      console.log('===== Tx FAILED =====', tokenId);
      console.log(`Transaction failed. Reason: ${error.message}`);
    } finally {
      txInProgress = false;
    }
  });
};
