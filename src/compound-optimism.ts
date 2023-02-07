import {providers, Wallet, Contract} from 'ethers';
import {abi as ICompoundKeep3rJobABI} from '../abis/CompoundJob.json';
import {runJob} from './run-compound-job';
import {getEnvVariable} from './utils/misc';
import {MempoolBroadcastor} from './shared/mempool-broadcastor';
import {SKIPPING_FACTOR, GAS_LIMIT} from './utils/constants';

/* ==============================================================/*
                                SETUP
/*============================================================== */

const provider = new providers.WebSocketProvider(getEnvVariable('RPC_OPTIMISM_WSS_URI'));
const txSigner = new Wallet(getEnvVariable('TX_SIGNER_OPTIMISM_PRIVATE_KEY'), provider);
const compoundJob = new Contract('0x3e89CCA7D1D41d51BaDC3F884B1f89F4A6063F99', ICompoundKeep3rJobABI, txSigner);

(async () => {
  const mempoolBroadcastor = new MempoolBroadcastor(provider, GAS_LIMIT);
  await runJob(txSigner, compoundJob, provider, SKIPPING_FACTOR, mempoolBroadcastor.tryToWorkOnMempool.bind(mempoolBroadcastor));
})();
