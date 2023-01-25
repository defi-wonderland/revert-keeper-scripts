import dotenv from 'dotenv';
import {providers, Wallet} from 'ethers';
import {getEnvVariable} from '../utils/misc';

dotenv.config();

export function loadInitialSetup() {
  const provider = new providers.JsonRpcProvider(getEnvVariable('RPC_HTTPS_URI')); // TODO use wss on prod
  const txSigner = new Wallet(getEnvVariable('TX_SIGNER_PRIVATE_KEY'), provider);
  const bundleSigner = new Wallet(getEnvVariable('BUNDLE_SIGNER_PRIVATE_KEY'), provider);
  return {
    provider,
    txSigner,
    bundleSigner,
  };
}
