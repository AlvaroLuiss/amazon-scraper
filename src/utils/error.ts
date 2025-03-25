import { Result } from '../types/types';
import logger from './logger';

export async function tryCatch<T>(
  promise: Promise<T>
): Promise<Result<T, Error>> {
  try {
    const value = await promise;
    return { ok: true, value };
  } catch (error) {
    logger.error('Operation failed:', error);
    return { ok: false, error: error as Error };
  }
}

export function success<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function failure<E extends Error>(error: E): Result<never, E> {
  return { ok: false, error };
}
