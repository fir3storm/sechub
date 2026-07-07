const path = require("path");

const appDir = __dirname;
const port = process.env.PORT || 3002;

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
      NODE_ENV: "production",
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
    env: {
      NODE_ENV: "production",
    },
    error_file: "logs/sechub-worker-error.log",
    out_file: "logs/sechub-worker-out.log",
    merge_logs: true,
    time: true,
  },
];

module.exports = { apps };
