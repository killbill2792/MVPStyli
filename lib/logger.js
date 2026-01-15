/**
 * Production-safe logging utility
 * Only logs in development mode
 */

export const logger = {
  log: (...args) => {
    if (__DEV__) {
      console.log(...args);
    }
  },
  warn: (...args) => {
    if (__DEV__) {
      console.warn(...args);
    }
  },
  error: (...args) => {
    // Always log errors, even in production (for debugging)
    console.error(...args);
  },
  info: (...args) => {
    if (__DEV__) {
      console.log('[INFO]', ...args);
    }
  },
  debug: (...args) => {
    if (__DEV__) {
      console.log('[DEBUG]', ...args);
    }
  },
};
