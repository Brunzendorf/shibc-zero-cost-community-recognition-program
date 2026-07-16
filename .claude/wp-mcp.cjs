#!/usr/bin/env node
/**
 * Wrapper for the woodpecker-mcp Docker container.
 *
 * Why not call `docker run` directly from .mcp.json?
 *   The Woodpecker user token must NOT live in .mcp.json (that file is
 *   git-tracked). This wrapper reads the token from the gitignored
 *   .claude/wp-token at spawn time and injects it as an env var into the
 *   container — the token never enters version control.
 *
 * Why Node and not a shell script?
 *   Claude Code spawns MCP servers without a shell on Windows; a .sh wrapper
 *   would require Git-Bash to be reliably on PATH. Node is cross-platform and
 *   always present alongside the project's npm/pnpm tooling.
 *
 * Install location: .claude/wp-mcp.cjs (referenced by .mcp.json as
 *   { "command": "node", "args": [".claude/wp-mcp.cjs"] }).
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const WOODPECKER_URL = process.env.WOODPECKER_URL || 'https://ci.next-inno.de';

const tokenFile = path.join(__dirname, 'wp-token');
if (!fs.existsSync(tokenFile)) {
  console.error(
    `wp-mcp: missing ${tokenFile} — generate a Woodpecker user token at ` +
      `${WOODPECKER_URL} under Profile -> CLI & API and save it there.`,
  );
  process.exit(1);
}

const token = fs.readFileSync(tokenFile, 'utf8').trim();
if (!token) {
  console.error(`wp-mcp: ${tokenFile} is empty.`);
  process.exit(1);
}

const child = spawn(
  'docker',
  [
    'run',
    '-i',
    '--rm',
    '-e',
    `WOODPECKER_TOKEN=${token}`,
    '-e',
    `WOODPECKER_URL=${WOODPECKER_URL}`,
    'ghcr.io/j04n-f/woodpecker-mcp',
  ],
  { stdio: 'inherit' },
);

child.on('error', (err) => {
  console.error(`wp-mcp: failed to spawn docker — ${err.message}`);
  process.exit(127);
});
child.on('exit', (code, signal) => {
  process.exit(signal ? 128 : code ?? 0);
});
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
