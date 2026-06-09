const PREFIXES = {
  info: '\x1b[36m[INFO]\x1b[0m',
  warn: '\x1b[33m[WARN]\x1b[0m',
  error: '\x1b[31m[ERROR]\x1b[0m',
  debug: '\x1b[90m[DEBUG]\x1b[0m',
} as const;

function log(level: keyof typeof PREFIXES, ...args: unknown[]) {
  const ts = new Date().toISOString();
  console[level === 'error' ? 'error' : 'log'](`${PREFIXES[level]} ${ts}`, ...args);
}

export const logger = {
  info: (...args: unknown[]) => log('info', ...args),
  warn: (...args: unknown[]) => log('warn', ...args),
  error: (...args: unknown[]) => log('error', ...args),
  debug: (...args: unknown[]) => log('debug', ...args),
};
