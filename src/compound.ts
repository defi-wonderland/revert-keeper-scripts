import {Flashbots} from '@keep3r-network/keeper-scripting-utils';
import {providers, Wallet, Contract} from 'ethers';
import {abi as ICompoundKeep3rJobABI} from '../abis/CompoundJob.json';
import {getEnvVariable} from './utils/misc';
import {runJob, tryToWorkOnFlashbots} from './run-compound-job';
import {FLASHBOTS_RPC_BY_CHAINID} from './utils/types';

/* ==============================================================/*
                                SETUP
/*============================================================== */

const provider = new providers.JsonRpcProvider(getEnvVariable('RPC_MAINNET_HTTPS_URI'));
const txSigner = new Wallet(getEnvVariable('TX_SIGNER_MAINNET_PRIVATE_KEY'), provider);
const bundleSigner = new Wallet(getEnvVariable('BUNDLE_SIGNER_MAINNET_PRIVATE_KEY'), provider);
// Contracts
const compoundJob = new Contract('COMPOUND_JOB', ICompoundKeep3rJobABI, txSigner);

(async () => {
  // Get the chain Id
  const {chainId} = await provider.getNetwork();
  // Set the flashbot of that network
  const FLASHBOTS_RPC: string = FLASHBOTS_RPC_BY_CHAINID[chainId];
  const flashbots = await Flashbots.init(txSigner, bundleSigner, provider, [FLASHBOTS_RPC], true, chainId);

  await runJob(compoundJob, provider, flashbots, txSigner, tryToWorkOnFlashbots);
})();
