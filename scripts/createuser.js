#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const result = spawnSync("bash", [path.join(__dirname, "..", "owner.sh")], {
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
