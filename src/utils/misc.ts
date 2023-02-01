import process from 'dotenv';
import type {UnsubscribeFunction} from '@keep3r-network/keeper-scripting-utils';

export function getEnvVariable(name: string): string {
  const env = process.config().parsed;
  const value: string | undefined = env![name];
  if (!value) throw new Error(`Environment variable ${name} not found`);
  return value;
}

export function stopSubscription(storage: Record<string, UnsubscribeFunction>, strategy: number): void {
  if (storage[strategy]) {
    storage[strategy]();
    delete storage[strategy];
  }
}
