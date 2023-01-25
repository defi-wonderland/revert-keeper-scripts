import {Flashbots} from '@keep3r-network/keeper-scripting-utils';
import {Contract} from 'ethers';
import {getMainnetSdk} from '@dethcrypto/eth-sdk-client';
import {defaultAbiCoder} from 'ethers/lib/utils';
import {abi as ICompoundKeep3rJobABI} from '../out/CompoundKeep3rJob.sol/CompoundKeep3rJob.json';
import type {Address, PositionData} from './utils/types';
import {CHAIN_ID_MAINNET, FLASHBOTS_RPC, ADDRESS_ZERO} from './utils/constants';
import {loadInitialSetup} from './shared/setup';
import {updateCache} from './shared/update-cache';

const {provider, txSigner, bundleSigner} = loadInitialSetup();

// Contracts Mainnet
const compoundJobMainnet = new Contract('COMPOUND_JOB', ICompoundKeep3rJobABI, txSigner);
const compoundorMainnet = getMainnetSdk(txSigner).compoundor;
const nonfungiblePositionManagerMainnet = getMainnetSdk(txSigner).nonfungiblePositionManager;

// JOB IN MAINNET
export async function runJobMainnet(tryToWorkTokenId: (tokenId: number, flashFlashbots: Flashbots) => Promise<void>) {
  async () => {
    // One time setup
    const flashbots = await Flashbots.init(txSigner, bundleSigner, provider, [FLASHBOTS_RPC], true, CHAIN_ID_MAINNET);
    const sanitizedMainnetTokensId: number[] = await updateCache(compoundJobMainnet, compoundorMainnet, nonfungiblePositionManagerMainnet);

    for (const tokenId of sanitizedMainnetTokensId) {
      await tryToWorkTokenId(tokenId, flashbots);
    }

    // Listen and react to event token withdrawn
    provider.on(compoundorMainnet.filters.TokenWithdrawn(), async (eventData) => {
      const tokenIdWithdraw: number = Number.parseInt(
        defaultAbiCoder.decode(['address', 'address', 'uint256'], eventData.data)[2] as string,
        10,
      );
      console.log('^^^^^^^^^^^^^^^^^ TOKEN ID WIHDRAWN FROM COMPOUNDOR ^^^^^^^^^^^^^^^^^', tokenIdWithdraw);
      const index = sanitizedMainnetTokensId.indexOf(tokenIdWithdraw);
      sanitizedMainnetTokensId.splice(index, 1);
    });

    // Listen and react to events like creation of new poolManager.
    provider.on(compoundorMainnet.filters.TokenDeposited(), async (eventData) => {
      const tokenIdDeposited: number = Number.parseInt(defaultAbiCoder.decode(['address', 'uint256'], eventData.data)[1] as string, 10);
      const position: PositionData = await nonfungiblePositionManagerMainnet.positions(tokenIdDeposited);
      const whitelistedTokens = new Set<Address>(await compoundJobMainnet.getWhitelistedTokens());

      if (whitelistedTokens.has(position.token0) || whitelistedTokens.has(position.token1)) {
        const ownerAddress = await compoundorMainnet.ownerOf(tokenIdDeposited);

        if (ownerAddress !== ADDRESS_ZERO) {
          sanitizedMainnetTokensId.push(tokenIdDeposited);
        }
      }

      console.log('^^^^^^^^^^^^^^^^^ TOKEN ID ADDED TO COMPOUNDOR ^^^^^^^^^^^^^^^^^', tokenIdDeposited);
      await tryToWorkTokenId(tokenIdDeposited, flashbots);
    });
  };
}
