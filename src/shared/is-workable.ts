import type {Contract} from 'ethers';

export async function checkIsWorkable(compoundJob: Contract, tokenId: number | string, compoundor: number | string) {
  try {
    await compoundJob.callStatic.work(tokenId, compoundor);
    return true;
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      !error.message.includes('CompoundNotWorkable()') &&
      !error.message.includes('V2Keep3rJob::work:not-workable')
    ) {
      console.log(`Failed when attempting to call work statically. tokenId: ${tokenId}. Message: ${error.message}. Returning.`);
    }

    return false;
  }
}
