import {FlashbotsBundleProvider} from '@flashbots/ethers-provider-bundle';
import {providers, Wallet, Contract} from 'ethers';
import {abi as ICompoundKeep3rJobABI} from '../abis/CompoundJob.json';
import {getEnvVariable} from './utils/misc';
import {runJob} from './run-compound-job';
import {FLASHBOTS_RPC_BY_CHAINID} from './utils/types';
import {FlashbotsBroadcastor} from '@keep3r-network/keeper-scripting-utils';
import {SKIPPING_FACTOR, GAS_LIMIT} from './utils/constants';

/* ==============================================================/*
                                SETUP
/*============================================================== */

const PRIORITY_FEE = 2e9;

const provider = new providers.JsonRpcProvider(getEnvVariable('RPC_MAINNET_WSS_URI'));
const txSigner = new Wallet(getEnvVariable('TX_SIGNER_MAINNET_PRIVATE_KEY'), provider);
const bundleSigner = new Wallet(getEnvVariable('BUNDLE_SIGNER_MAINNET_PRIVATE_KEY'), provider);
const compoundJob = new Contract('UNIMPLEMENTED_COMPOUND_JOB', ICompoundKeep3rJobABI, txSigner);

(async () => {
  // Get the chain Id
  const {chainId} = await provider.getNetwork();

  const FLASHBOTS_RPC: string = FLASHBOTS_RPC_BY_CHAINID[chainId];
  const flashbots = await FlashbotsBundleProvider.create(provider, bundleSigner)
  const flashbotBroadcastor = new FlashbotsBroadcastor(flashbots, PRIORITY_FEE, GAS_LIMIT);

  await runJob(txSigner, compoundJob, provider, SKIPPING_FACTOR, flashbotBroadcastor.tryToWorkOnFlashbots.bind(flashbotBroadcastor));
})();
