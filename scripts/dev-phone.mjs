import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";

const port = process.env.PORT ?? "3000";

function lanAddress() {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal)
        return address.address;
    }
  }
  return null;
}

const host = lanAddress();
console.log(
  host
    ? `\nOpen on your phone (same Wi-Fi): http://${host}:${port}\n`
    : "\nNo LAN address found; the app is only reachable on this machine.\n",
);

// DEV_LAN_HOST lets next.config.ts allow this origin in dev (allowedDevOrigins).
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--webpack",
    "-H",
    "0.0.0.0",
    "-p",
    port,
  ],
  { stdio: "inherit", env: { ...process.env, DEV_LAN_HOST: host ?? "" } },
);
child.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
