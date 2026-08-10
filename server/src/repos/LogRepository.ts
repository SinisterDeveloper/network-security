import { LogKey } from '../types.js';
import { Logs, logAction } from '../deviceStore.js';

export interface LogRepository {
  push(key: LogKey, value: unknown, id: string | null): void;
  getAll(): typeof Logs;
  clear(): void;
}

export const logRepository: LogRepository = {
  push: (key, value, id) => logAction(key, value, id),
  getAll: () => Logs,
  clear: () => { Logs.length = 0; },
};
