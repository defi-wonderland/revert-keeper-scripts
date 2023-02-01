import type {BlockListener} from '@keep3r-network/keeper-scripting-utils';
import type {Subscription} from 'rxjs';

/**
 *
 * @notice Stops and restarts the iterable work process of a tokenId.
 *
 * @dev Removes all listeners and subscriptions and calls the tryToWorkFunction to start trying to work the tokenId once again
 *
 * @param tokenId - Number of the tokenId trying to work.
 * @param blockListener - Instances of the block listener class.
 * @param sub - Subscription to the block listener.
 * @param tryToWorkFunction - Function to start the work process again to achieve recursivity.
 *
 */
export function stopAndRestartWork(
  tokenId: number,
  blockListener: BlockListener,
  sub: Subscription,
  tryToWorkFunction: (tokenId: number) => void,
): void {
  // Stops listening blocks from observable.
  sub.unsubscribe();

  // Notify the blockListener that this subscription will stop listening blocks. Class will decrease the
  // subscriptions counter to check if it should stop fetching blocks from network provider. For more details
  // check Block Listener Class documentation on blocks.ts
  // blockListener.stop(tokenId);

  // Calls function to start the work process again to achieve recursivity.
  tryToWorkFunction(tokenId);
}
