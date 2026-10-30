import { rmSync } from "node:fs";
import path from "node:path";

rmSync(path.join(process.cwd(), ".data", "pglite"), {
  recursive: true,
  force: true,
});
console.log("Deleted .data/pglite. Stop the dev server before resetting.");
