import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";

const target = path.join(process.cwd(), ".env.local");

if (existsSync(target)) {
  console.error(
    ".env.local already exists; leaving it untouched. Delete it first to start over.",
  );
  process.exit(1);
}

const interactive = Boolean(process.stdin.isTTY);
let muted = false;
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: interactive,
});
// Hide typed characters (but not the prompt) when attached to a terminal.
const writeOutput = rl._writeToOutput?.bind(rl);
rl._writeToOutput = (text) => {
  if (!muted) writeOutput?.(text);
};
const lines = rl[Symbol.asyncIterator]();

async function ask(question) {
  process.stdout.write(question);
  muted = interactive;
  const { value } = await lines.next();
  muted = false;
  if (interactive) process.stdout.write("\n");
  return (value ?? "").trim();
}

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
const hash = scryptSync(passcode, salt, 64).toString("hex");

const contents = [
  "# Local development settings. Never commit this file.",
  `APP_PASSCODE_HASH=${salt}:${hash}`,
  `SESSION_SECRET=${randomBytes(32).toString("hex")}`,
  `IP_HASH_SECRET=${randomBytes(32).toString("hex")}`,
  "APP_TIME_ZONE=America/New_York",
  "",
].join("\n");
writeFileSync(target, contents, { flag: "wx", mode: 0o600 });
console.log("Wrote .env.local. Start the app with: npm run dev:phone");
