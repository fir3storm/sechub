const fs = require("fs");
const path = require("path");

function loadDotEnv(filename = ".env") {
  const envPath = path.join(__dirname, filename);
  if (!fs.existsSync(envPath)) return {};

  const env = {};
  for (const rawLine of fs.readFileSync(envPath, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const appDir = __dirname;
const fileEnv = loadDotEnv(".env");
const port = fileEnv.PORT || process.env.PORT || 3002;

const sharedEnv = {
  NODE_ENV: "production",
  ...fileEnv,
};

/** @type {import('pm2').StartOptions[]} */
const apps = [
  {
    name: "sechub-web",
    cwd: appDir,
    script: "node_modules/next/dist/bin/next",
    args: `start -p ${port}`,
    instances: 1,
    exec_mode: "fork",
    autorestart: true,
    watch: false,
    max_restarts: 20,
    min_uptime: "10s",
    max_memory_restart: "1G",
    env: {
      ...sharedEnv,
      PORT: String(port),
    },
    error_file: "logs/sechub-web-error.log",
    out_file: "logs/sechub-web-out.log",
    merge_logs: true,
    time: true,
  },
  {
    name: "sechub-worker",
    cwd: appDir,
    script: "src/workers/ingestWorker.ts",
    interpreter: "node",
    interpreter_args: "--import tsx",
    instances: 1,
    exec_mode: "fork",
    autorestart: true,
    watch: false,
    max_restarts: 20,
    min_uptime: "10s",
    max_memory_restart: "768M",
    env: sharedEnv,
    error_file: "logs/sechub-worker-error.log",
    out_file: "logs/sechub-worker-out.log",
    merge_logs: true,
    time: true,
  },
];

module.exports = { apps };
