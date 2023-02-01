import axios from 'axios';

export type GasFees = {
  gasPrice?: number;
  maxFeePerGas: number;
  maxPriorityFeePerGas: number;
};

export type Wei = string;

export class GasService {
  private get GAS_FEES_API() {
    return `https://api.blocknative.com/gasprices/blockprices`;
  }

  private get DEFAULT_CONFIDENCE_LEVEL() {
    return 95;
  }

  private headers = {};

  public async getGasFees(chainId: number): Promise<GasFees> {
    this.headers = {
      Authorization: process.env.BLOCK_NATIVE_KEY,
    };

    const response = await axios.get(this.GAS_FEES_API, {params: {chainid: chainId}, headers: this.headers});
    const {price, maxFeePerGas, maxPriorityFeePerGas} = response.data.blockPrices
      .shift()
      .estimatedPrices.find(({confidence}: {confidence: number}) => confidence === this.DEFAULT_CONFIDENCE_LEVEL);
    return {
      gasPrice: price,
      maxFeePerGas,
      maxPriorityFeePerGas,
    };
  }
}
