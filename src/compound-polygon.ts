import {providers, Wallet, Contract} from 'ethers';
import {abi as ICompoundKeep3rJobABI} from '../abis/CompoundJob.json';
import {runJob} from './run-compound-job';
import {getEnvVariable} from './utils/misc';
import {MempoolBroadcastor} from '@keep3r-network/keeper-scripting-utils';
import {SKIPPING_FACTOR, GAS_LIMIT, POLYGON_COMPOUNDOR_JOB} from './utils/constants';

/* ==============================================================/*
                                SETUP
/*============================================================== */

const PRIORITY_FEE = 2e9;

const provider = new providers.WebSocketProvider(getEnvVariable('RPC_POLYGON_WSS_URI'));
const txSigner = new Wallet(getEnvVariable('TX_SIGNER_POLYGON_PRIVATE_KEY'), provider);
const compoundJob = new Contract(POLYGON_COMPOUNDOR_JOB, ICompoundKeep3rJobABI, txSigner);

const COMPOUNDOR_DEPLOYMENT_BLOCK = '0x1D561D3';

(async () => {
  // randomize SKIPPING_FACTOR to avoid keeper collision
  const skippingFactor = SKIPPING_FACTOR + Math.floor(Math.random() * 10);

  const mempoolBroadcastor = new MempoolBroadcastor(provider, PRIORITY_FEE, GAS_LIMIT);
  await runJob(txSigner, compoundJob, provider, skippingFactor, mempoolBroadcastor.tryToWorkOnMempool.bind(mempoolBroadcastor), COMPOUNDOR_DEPLOYMENT_BLOCK);
})();
