// Avvia il dev server (vite) in modo compatibile anche con Windows.
// Sostituisce "npm run dev" quando lo spawn diretto di "vite" fallisce
// con ENOENT (mancata risoluzione di vite.cmd su Windows).
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const VITE_PREFIX = "VITE_";

function readAppEnv() {
  try {
    const parsed = JSON.parse(
      readFileSync(join(process.cwd(), ".grok", "app-env.json"), "utf8"),
    );
    const env = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (key.startsWith(VITE_PREFIX) && typeof value === "string") {
        env[key] = value;
      }
    }
    return env;
  } catch {
    return {};
  }
}

const env = { ...readAppEnv(), ...process.env };

const child = spawn("npx", ["vite", "dev", "--host", "0.0.0.0", "--port", "8080"], {
  stdio: "inherit",
  env,
  shell: true,
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code) => process.exit(code ?? 0));
