import { rmSync } from "node:fs";
import path from "node:path";

/** Starts every run from an empty database (PGlite opens it lazily). */
export default function globalSetup() {
  rmSync(path.join(process.cwd(), ".data", "e2e"), {
    recursive: true,
    force: true,
  });
}
