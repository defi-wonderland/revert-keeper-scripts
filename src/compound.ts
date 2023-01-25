import type {Flashbots, UnsubscribeFunction} from '@keep3r-network/keeper-scripting-utils';
import {
  BlockListener,
  createBundlesWithSameTxs,
  sendAndRetryUntilNotWorkable,
  makeid,
  getMainnetGasType2Parameters,
  populateTransactions,
} from '@keep3r-network/keeper-scripting-utils';
import type {TransactionRequest} from '@ethersproject/abstract-provider';
import type {Overrides} from 'ethers';
import {Contract} from 'ethers';
import {abi as ICompoundKeep3rJobABI} from 'out/CompoundKeep3rJob.sol/CompoundKeep3rJob.json';
import {runJobMainnet} from './run-compound-job';
import {BURST_SIZE, CHAIN_ID_MAINNET, FUTURE_BLOCKS, PRIORITY_FEE} from './utils/constants';
import {loadInitialSetup} from './shared/setup';
import {stopSubscription} from './utils/misc';

/* ==============================================================/*
                                SETUP
/*============================================================== */

const {provider, txSigner} = loadInitialSetup();
const blockListener = new BlockListener(provider);

// Contracts
const compoundJob = new Contract('COMPOUND_JOB', ICompoundKeep3rJobABI, txSigner);

// Creates a mapping that keeps track of whether we have sent a bundle to try to work a job.
const tokenIdWorkInProgress: Record<number, boolean> = {};
const unsubscribeTokenId: Record<number, UnsubscribeFunction> = {};

const tryToWorkOnTokenId = async (tokenId: number, flashbots: Flashbots) => {
  console.log('Start Working on compoundor job:', tokenId);

  stopSubscription(unsubscribeTokenId, tokenId);

  unsubscribeTokenId[tokenId] = blockListener.stream(async (block) => {
    // If a block arrives and there are bundles in progress, we return
    if (tokenIdWorkInProgress[tokenId]) return;

    const isWorkable = async () => {
      try {
        await compoundJob.callStatic.work(tokenId);
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

    // If the tokenId is workable, we optimistically set the feeCollectorWorkInProgress[tokenId] mapping to true, as we will send a bundle
    tokenIdWorkInProgress[tokenId] = true;

    try {
      // Get the signer's (keeper) current nonce
      const currentNonce = await provider.getTransactionCount(txSigner.address);
      /*
     We are going to send this through Flashbots, which means we will be sending multiple bundles to different
     blocks inside a batch. Here we are calculating which will be the last block we will be sending the
     last bundle of our first batch to. This information is needed to calculate what will the maximum possible base
     fee be in that block, so we can calculate the maxFeePerGas parameter for all our transactions.
     For example: we are in block 100 and we send to 100, 101, 102. We would like to know what is the maximum possible
     base fee at block 102 to make sure we don't populate our transactions with a very low maxFeePerGas, as this would
     cause our transaction to not be mined until the max base fee lowers.
  */
      const blocksAhead = FUTURE_BLOCKS + BURST_SIZE;

      // We calculate the first block that the first bundle in our batch will target.
      // Example, if future blocks is 2, and we are in block 100, it will send a bundle to blocks 102, 103, 104 (assuming a burst size of 3)
      // and 102 would be the firstBlockOfBatch
      const firstBlockOfBatch = block.number + FUTURE_BLOCKS;

      // Fetch the priorityFeeInGwei and maxFeePerGas parameters from the getMainnetGasType2Parameters function
      // NOTE: this just returns our priorityFee in GWEI, it doesn't calculate it, so if we pass a priority fee of 10 wei
      //       this will return a priority fee of 10 GWEI. We need to pass it so that it properly calculated the maxFeePerGas
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
        chainId: CHAIN_ID_MAINNET,
        contract: compoundJob,
        functionArgs: new Array(BURST_SIZE).fill(null).map(() => [tokenId]),
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

      /*
    We send our batch of bundles and recreate new ones until we or another keeper works the tokenId.
    One very important detail here is that we need to provide the sendAndRetryUntilNotWorkable tokenId with
    instructions as to how to regenerate the transactions to include in the new batches in case the first one fails.
    For example: The first bundle is sent to blocks 100 and 101, so inside the bundle that goes to block 100 we include a transaction that
    has block 100 as an argument and inside the bundle that goes to block 101, we include a transaction that has bock 101 as an argument.
    When we apply our retry mechanism, we need to indicate whether it should use the same txs as before, or if should use new ones.
    If it should use new ones, we need to provide the function with the logic as to how to create those new transactions.
    We do that through the regenerateTxs callback. In this case we are telling the script: "Hey, when creating a new batch for retrying,
    generate new transactions with the following function and arguments."
    If we do this, we also need to tell the function what method to use to create the batches. In this case, we know each transaction will be
    different so we just tell it to use the createBundlesWithDifferentTxs function by passing it in the bundleRegenerationMethod parameter.
    It's also worth noting that for ease of debugging we are passing the tokenId address as static id, and a random 5 digit id to identify each batch.
    Each batch would look something like this in the console: POOL_MANAGER_ADDRESS#12345
  */
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
      await tryToWorkOnTokenId(tokenId, flashbots);
    } catch (error: unknown) {
      console.error(error);
    } finally {
      // We need to set tokenId as not in progress anymore.
      tokenIdWorkInProgress[tokenId] = false;
    }
  });
};

(async () => {
  await runJobMainnet(tryToWorkOnTokenId);
})();
