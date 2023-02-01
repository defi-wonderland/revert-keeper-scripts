import type {BigNumber} from 'ethers';
import {utils} from 'ethers';

export const toGwei = (value: number): BigNumber => {
  return utils.parseUnits(value.toString(), 'gwei');
};
