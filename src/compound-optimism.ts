import {providers, Wallet, Contract} from 'ethers';
import {abi as ICompoundKeep3rJobABI} from '../abis/CompoundJob.json';
import {runJob, tryToWorkOnMempool} from './run-compound-job';
import {getEnvVariable} from './utils/misc';

/* ==============================================================/*
                                SETUP
/*============================================================== */

const provider = new providers.JsonRpcProvider(getEnvVariable('RPC_OPTIMISM_HTTPS_URI')); // TODO use wss on prod
const txSigner = new Wallet(getEnvVariable('TX_SIGNER_OPTIMISM_PRIVATE_KEY'), provider);
const compoundJob = new Contract('0x3e89CCA7D1D41d51BaDC3F884B1f89F4A6063F99', ICompoundKeep3rJobABI, txSigner);

(async () => {
  await runJob(compoundJob, provider, null!, txSigner, tryToWorkOnMempool);
})();
