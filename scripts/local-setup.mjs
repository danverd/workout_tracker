import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";

import { hasKey, mergeEnv } from "./env-merge.mjs";

const target = path.join(process.cwd(), ".env.local");
const exists = existsSync(target);
const existing = exists ? readFileSync(target, "utf8") : "";
const resetPasscode = process.argv.includes("--reset-passcode");
const needPasscode = resetPasscode || !hasKey(existing, "APP_PASSCODE_HASH");

const interactive = Boolean(process.stdin.isTTY);
let muted = false;
// readline echoes typed characters to `output`. This sink forwards everything
// to stdout except while muted (passcode entry on a TTY), so the prompt text
// stays visible but the typed characters are never echoed.
const output = new Writable({
  write(chunk, _encoding, callback) {
    if (!muted) process.stdout.write(chunk);
    callback();
  },
});
const rl = createInterface({
  input: process.stdin,
  output,
  terminal: interactive,
});
const lines = rl[Symbol.asyncIterator]();

async function ask(question) {
  process.stdout.write(question);
  muted = interactive;
  const { value } = await lines.next();
  muted = false;
  if (interactive) process.stdout.write("\n");
  return (value ?? "").trim();
}

let passcodeHash = null;
if (needPasscode) {
  const passcode = await ask("Choose a passcode: ");
  const confirm = await ask("Repeat the passcode: ");
  rl.close();
  if (passcode.length < 4) {
    console.error("Passcode must be at least 4 characters.");
    process.exit(1);
  }
  if (confirm !== passcode) {
    console.error("Passcodes did not match.");
    process.exit(1);
  }
  // Format verified by src/lib/auth.ts: "<salt>:<scrypt hex, 64 bytes>".
  const salt = randomBytes(16).toString("hex");
  passcodeHash = `${salt}:${scryptSync(passcode, salt, 64).toString("hex")}`;
} else {
  rl.close();
}

const base = exists
  ? existing
  : "# Local development settings. Never commit this file.\n";
const { text, added, replaced } = mergeEnv(base, { passcodeHash });
if (added.length === 0 && replaced.length === 0) {
  console.log(".env.local already has every setting; nothing to change.");
} else {
  writeFileSync(target, text, { mode: 0o600 });
  if (added.length) console.log(`Added: ${added.join(", ")}`);
  if (replaced.length) console.log(`Replaced: ${replaced.join(", ")}`);
  console.log(".env.local updated. Start the app with: npm run dev:phone");
}
