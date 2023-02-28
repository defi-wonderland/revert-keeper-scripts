import {providers, Wallet, Contract} from 'ethers';
import {abi as ICompoundKeep3rJobABI} from '../abis/CompoundJob.json';
import {runJob} from './run-compound-job';
import {getEnvVariable} from './utils/misc';
import {MempoolBroadcastor} from './shared/mempool-broadcastor';
import {SKIPPING_FACTOR, GAS_LIMIT} from './utils/constants';

/* ==============================================================/*
                                SETUP
/*============================================================== */

const provider = new providers.WebSocketProvider(getEnvVariable('RPC_POLYGON_WSS_URI'));
const txSigner = new Wallet(getEnvVariable('TX_SIGNER_POLYGON_PRIVATE_KEY'), provider);
const compoundJob = new Contract('0x86196e610acE45257456c648fa1CDc146Ce6516F', ICompoundKeep3rJobABI, txSigner);

const COMPOUNDOR_DEPLOYMENT_BLOCK = '0x1D561D3';

(async () => {
  const mempoolBroadcastor = new MempoolBroadcastor(provider, GAS_LIMIT);
  await runJob(txSigner, compoundJob, provider, SKIPPING_FACTOR, mempoolBroadcastor.tryToWorkOnMempool.bind(mempoolBroadcastor), COMPOUNDOR_DEPLOYMENT_BLOCK);
})();
