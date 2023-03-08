import type {UnsubscribeFunction, BroadcastorProps} from '@keep3r-network/keeper-scripting-utils';
import {BlockListener} from '@keep3r-network/keeper-scripting-utils';
import type {Wallet, providers, Contract} from 'ethers';
import {getMainnetSdk} from '@dethcrypto/eth-sdk-client';
import {updateCache} from './shared/update-cache';
import {deleteSanitizedToken, addSanitizedToken} from './shared/listen-and-react';
import {stopSubscription} from './utils/misc';

export async function runJob(
  txSigner: Wallet,
  compoundJob: Contract,
  provider: providers.JsonRpcProvider,
  skippingFactor: number,
  broadcastMethod: (props: BroadcastorProps) => Promise<void>,
  fromBlockOrBlockHash?: providers.BlockTag
) {
  const {nonfungiblePositionManager, compoundor} = getMainnetSdk(txSigner);
  const compoundors: string[] = await compoundJob.getWhitelistedCompoundors();
  const blockListener = new BlockListener(provider);
  let addTokenId = 0;
  let deleteTokenId = 0;

  for (const compoundorAddress of compoundors) {
    const compoundorContract = compoundor.attach(compoundorAddress);
    const sanitizedTokensId: number[] = await updateCache(compoundJob, compoundorContract, nonfungiblePositionManager, fromBlockOrBlockHash);

    // Creates a mapping that keeps track of whether we have sent a bundle to try to work a job.
    const tokenIdWorkInProgress: Record<number, boolean> = {};
    const subscription: Record<number, UnsubscribeFunction> = {};

    for (const tokenId of sanitizedTokensId) {
      await tryToWorkTokenId(tokenId);
    }

    // Listen delete
    deleteTokenId = await deleteSanitizedToken(provider, deleteTokenId, compoundorContract);
    if (deleteTokenId != 0) {
      console.log('^^^^^^^^^^^^^^^^^ TOKEN ID WIHDRAWN FROM COMPOUNDOR ^^^^^^^^^^^^^^^^^', deleteTokenId);
      const index = sanitizedTokensId.indexOf(deleteTokenId);
      sanitizedTokensId.splice(index, 1);
      stopSubscription(subscription, deleteTokenId);
    }

    // Listen add
    addTokenId = await addSanitizedToken(provider, addTokenId, compoundJob, compoundorContract, nonfungiblePositionManager);

    if (addTokenId != 0 && !sanitizedTokensId.includes(addTokenId)) {
      console.log('^^^^^^^^^^^^^^^^^ TOKEN ID ADDED TO COMPOUNDOR ^^^^^^^^^^^^^^^^^', addTokenId);
      sanitizedTokensId.push(addTokenId);
      await tryToWorkTokenId(addTokenId);
    }

    async function tryToWorkTokenId(tokenId: number) {
      subscription[tokenId] = blockListener.stream(async (block) => {
        if (block.number % skippingFactor != tokenId % skippingFactor) return;

        // If token is in progress or is not the tokenId chosen to work or is notWorkable unsuscribe and return
        if (tokenIdWorkInProgress[tokenId]) return;

        try {
          // If the tokenId is workable, we optimistically set the tokenIdWorkInProgress[tokenId] mapping to true, as we will send a bundle
          tokenIdWorkInProgress[tokenId] = true;

          await broadcastMethod({
            jobContract: compoundJob,
            workMethod: 'work(uint256,address)',
            workArguments: [tokenId, compoundorAddress],
            block
          });
        } catch (error: any) {
          console.log('===== Tx FAILED =====', tokenId);
          console.log(`Transaction failed. Reason: ${error.message}`);
        } finally {
          // We need to set tokenId as not in progress anymore.
          tokenIdWorkInProgress[tokenId] = false;
        }
      });
    }
  }
}
