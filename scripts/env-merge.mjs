import { randomBytes } from "node:crypto";

const GENERATED = {
  SESSION_SECRET: () => randomBytes(32).toString("hex"),
  IP_HASH_SECRET: () => randomBytes(32).toString("hex"),
  APP_TIME_ZONE: () => "America/New_York",
};

const keyOf = (line) => /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)?.[1];

/**
 * Pure merge of an existing .env.local text. Existing lines stay untouched;
 * missing generated keys are appended. The passcode line is added, or replaced
 * when `passcodeHash` ("<salt>:<hash>") is given.
 * Returns { text, added, replaced }; the lists hold key names only.
 */
export function mergeEnv(
  existing,
  { passcodeHash = null, generate = GENERATED } = {},
) {
  const lines = existing === "" ? [] : existing.replace(/\n$/, "").split("\n");
  const present = new Set(lines.map(keyOf).filter(Boolean));
  const added = [];
  const replaced = [];

  if (passcodeHash) {
    const entry = `APP_PASSCODE_HASH=${passcodeHash}`;
    if (present.has("APP_PASSCODE_HASH")) {
      for (let i = 0; i < lines.length; i++) {
        if (keyOf(lines[i]) === "APP_PASSCODE_HASH") lines[i] = entry;
      }
      replaced.push("APP_PASSCODE_HASH");
    } else {
      lines.push(entry);
      added.push("APP_PASSCODE_HASH");
    }
  }
  for (const [key, make] of Object.entries(generate)) {
    if (present.has(key)) continue;
    lines.push(`${key}=${make()}`);
    added.push(key);
  }
  return { text: lines.join("\n") + "\n", added, replaced };
}

export function hasKey(existing, key) {
  return existing.split("\n").some((line) => keyOf(line) === key);
}
