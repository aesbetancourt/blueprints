/**
 * Built-in variable definitions (computed at resolve time).
 */
export interface BuiltInVariable {
  key: string;
  description: string;
  resolve: () => string;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function formatDate(date: Date, format: string): string {
  return format
    .replace('YYYY', date.getFullYear().toString())
    .replace('MM', pad(date.getMonth() + 1))
    .replace('MMM', MONTH_SHORT[date.getMonth()])
    .replace('DD', pad(date.getDate()))
    .replace('D', date.getDate().toString())
    .replace('HH', pad(date.getHours()))
    .replace('mm', pad(date.getMinutes()))
    .replace('ss', pad(date.getSeconds()));
}

/** All built-in variables with their descriptions and resolvers */
export const BUILT_IN_VARIABLES: BuiltInVariable[] = [
  {
    key: 'today',
    description: 'Current date (YYYY-MM-DD)',
    resolve: () => formatDate(new Date(), 'YYYY-MM-DD'),
  },
  {
    key: 'now',
    description: 'Current date and time (YYYY-MM-DD HH:mm)',
    resolve: () => formatDate(new Date(), 'YYYY-MM-DD HH:mm'),
  },
  {
    key: 'time',
    description: 'Current time (HH:mm)',
    resolve: () => formatDate(new Date(), 'HH:mm'),
  },
  {
    key: 'year',
    description: 'Current year (YYYY)',
    resolve: () => new Date().getFullYear().toString(),
  },
];

/**
 * Resolve a single variable key to its value.
 * Returns undefined if the key is not recognized.
 */
function resolveKey(key: string, userVars: Record<string, string>): string | undefined {
  // Check built-in date variables with custom format: today:FORMAT or now:FORMAT
  if (key.startsWith('today:')) {
    const fmt = key.slice(6);
    return formatDate(new Date(), fmt);
  }
  if (key.startsWith('now:')) {
    const fmt = key.slice(4);
    return formatDate(new Date(), fmt);
  }

  // Check built-in variables
  const builtIn = BUILT_IN_VARIABLES.find((v) => v.key === key);
  if (builtIn) return builtIn.resolve();

  // Check user-defined variables
  if (key in userVars && userVars[key]) return userVars[key];

  return undefined;
}

/**
 * Resolve all {{variable}} placeholders in content.
 * Unresolved variables (empty or unknown) are left as-is.
 */
export function resolveVariables(content: string, userVars: Record<string, string>): string {
  return content.replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => {
    const trimmed = key.trim();
    const resolved = resolveKey(trimmed, userVars);
    return resolved !== undefined ? resolved : `{{${trimmed}}}`;
  });
}

/**
 * Resolve a single variable key and return the value (for suggestion preview).
 */
export function resolveVariable(key: string, userVars: Record<string, string>): string {
  return resolveKey(key, userVars) ?? '';
}
