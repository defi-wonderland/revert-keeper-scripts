import {defineConfig} from '@dethcrypto/eth-sdk';

export default defineConfig({
  contracts: {
    mainnet: {
      compoundor: '0x5411894842e610C4D0F6Ed4C232DA689400f94A1',
      nonfungiblePositionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    },
  },
});
