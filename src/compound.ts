import {Flashbots} from '@keep3r-network/keeper-scripting-utils';
import {providers, Wallet, Contract} from 'ethers';
import {abi as ICompoundKeep3rJobABI} from '../abis/CompoundJob.json';
import {getEnvVariable} from './utils/misc';
import {runJob} from './run-compound-job';
import {FLASHBOTS_RPC_BY_CHAINID} from './utils/types';
import {FlashbotBroadcastor} from './shared/flashbots-broadcastor';
import {BURST_SIZE, FUTURE_BLOCKS, SKIPPING_FACTOR, GAS_LIMIT, PRIORITY_FEE_IN_WEI} from './utils/constants';

/* ==============================================================/*
                                SETUP
/*============================================================== */

const provider = new providers.JsonRpcProvider(getEnvVariable('RPC_MAINNET_WSS_URI'));
const txSigner = new Wallet(getEnvVariable('TX_SIGNER_MAINNET_PRIVATE_KEY'), provider);
const bundleSigner = new Wallet(getEnvVariable('BUNDLE_SIGNER_MAINNET_PRIVATE_KEY'), provider);
const compoundJob = new Contract('UNIMPLEMENTED_COMPOUND_JOB', ICompoundKeep3rJobABI, txSigner);

(async () => {
  // Get the chain Id
  const {chainId} = await provider.getNetwork();

  const FLASHBOTS_RPC: string = FLASHBOTS_RPC_BY_CHAINID[chainId];
  const flashbots = await Flashbots.init(txSigner, bundleSigner, provider, [FLASHBOTS_RPC], true, chainId);
  const flashbotBroadcastor = new FlashbotBroadcastor(provider, flashbots, BURST_SIZE, FUTURE_BLOCKS, PRIORITY_FEE_IN_WEI, GAS_LIMIT);

  await runJob(txSigner, compoundJob, provider, SKIPPING_FACTOR, flashbotBroadcastor.tryToWorkOnFlashbots.bind(flashbotBroadcastor));
})();
