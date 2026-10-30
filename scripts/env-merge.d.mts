export function mergeEnv(
  existing: string,
  options?: {
    passcodeHash?: string | null;
    generate?: Record<string, () => string>;
  },
): { text: string; added: string[]; replaced: string[] };
export function hasKey(existing: string, key: string): boolean;
