#!/usr/bin/env node
/**
 * vault-env — pulls base secrets from Vault into a .env file.
 *
 * Run via:  npm run secrets:pull   (script: "node scripts/vault-env.mjs")
 *
 * Config:   vault.config.json in the project root.
 *
 * Auth is auto-detected, in this order:
 *   1. $VAULT_TOKEN environment variable
 *   2. ~/.vault-token        (written by `vault login`)
 *   3. .vault/approle.json   ({ "role_id": "...", "secret_id": "..." }, gitignored)
 *
 * The generated .env is Vault-managed — do not hand-edit it. Put local-only
 * overrides in .env.local (loaded by Next.js, wins over .env, never touched here).
 *
 * Keys listed under `targets` in vault.config.json are written to their own
 * file (raw value) instead of .env — e.g. WOODPECKER_TOKEN -> .claude/wp-token.
 *
 * Requires Node 18+ (uses the global fetch). No npm dependencies.
 */
import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

const CONFIG_FILE = 'vault.config.json';

function fail(msg) {
  console.error(`vault-env: ${msg}`);
  process.exit(1);
}

function loadConfig() {
  if (!existsSync(CONFIG_FILE)) fail(`${CONFIG_FILE} not found in ${process.cwd()}`);
  let cfg;
  try {
    cfg = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  } catch (e) {
    fail(`${CONFIG_FILE} is not valid JSON — ${e.message}`);
  }
  if (!cfg.address) fail(`${CONFIG_FILE}: "address" is required`);
  if (!Array.isArray(cfg.paths) || cfg.paths.length === 0) {
    fail(`${CONFIG_FILE}: "paths" must be a non-empty array`);
  }
  for (const p of cfg.paths) {
    if (/[<>]/.test(p)) {
      fail(
        `${CONFIG_FILE}: path "${p}" still contains a placeholder.\n` +
          '         Set the real Vault KV paths before pulling secrets.',
      );
    }
  }
  cfg.kv = cfg.kv || {};
  cfg.kv.mount = cfg.kv.mount || 'secret';
  cfg.kv.version = cfg.kv.version || 2;
  cfg.output = cfg.output || '.env';
  cfg.targets = cfg.targets && typeof cfg.targets === 'object' ? cfg.targets : {};
  cfg.claudeEnv = Array.isArray(cfg.claudeEnv) ? cfg.claudeEnv : [];
  return cfg;
}

async function resolveToken(address) {
  if (process.env.VAULT_TOKEN) {
    return { token: process.env.VAULT_TOKEN, via: '$VAULT_TOKEN' };
  }

  const tokenFile = join(homedir(), '.vault-token');
  if (existsSync(tokenFile)) {
    const t = readFileSync(tokenFile, 'utf8').trim();
    if (t) return { token: t, via: '~/.vault-token' };
  }

  const approleFile = join('.vault', 'approle.json');
  if (existsSync(approleFile)) {
    let ar;
    try {
      ar = JSON.parse(readFileSync(approleFile, 'utf8'));
    } catch (e) {
      fail(`${approleFile} is not valid JSON — ${e.message}`);
    }
    if (!ar.role_id || !ar.secret_id) {
      fail(`${approleFile} must contain "role_id" and "secret_id"`);
    }
    const mount = ar.mount || 'approle';
    const res = await fetch(`${address}/v1/auth/${mount}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_id: ar.role_id, secret_id: ar.secret_id }),
    });
    if (!res.ok) {
      fail(`AppRole login failed (HTTP ${res.status}). Check .vault/approle.json.`);
    }
    const json = await res.json();
    const token = json?.auth?.client_token;
    if (!token) fail('AppRole login returned no client_token');
    return { token, via: '.vault/approle.json (AppRole)' };
  }

  fail(
    'no Vault credentials found.\n' +
      '         Run `vault login`, or set $VAULT_TOKEN, or create\n' +
      '         .vault/approle.json with { "role_id": "...", "secret_id": "..." }.',
  );
}

async function readPath(address, token, kv, path) {
  const clean = path.replace(/^\/+|\/+$/g, '');
  const url =
    kv.version === 2
      ? `${address}/v1/${kv.mount}/data/${clean}`
      : `${address}/v1/${kv.mount}/${clean}`;
  const res = await fetch(url, { headers: { 'X-Vault-Token': token } });
  if (res.status === 403) fail(`access denied for "${path}" — the token lacks read permission`);
  if (res.status === 404) {
    fail(`secret "${path}" not found — check the path and kv.version in ${CONFIG_FILE}`);
  }
  if (!res.ok) fail(`Vault returned HTTP ${res.status} for "${path}"`);
  const json = await res.json();
  const data = kv.version === 2 ? json?.data?.data : json?.data;
  if (!data || typeof data !== 'object') fail(`secret "${path}" has no key-value data`);
  return data;
}

function formatEnvValue(value) {
  const s = String(value);
  if (/[\n\r"'#=]|^\s|\s$/.test(s)) {
    return `"${s
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\r/g, '')
      .replace(/\n/g, '\\n')}"`;
  }
  return s;
}

function ensureGitignored(entries) {
  const gi = '.gitignore';
  const existing = existsSync(gi) ? readFileSync(gi, 'utf8') : '';
  const present = existing.split(/\r?\n/).map((l) => l.trim());
  const missing = entries.filter((e) => !present.includes(e));
  if (missing.length) {
    const block =
      (existing && !existing.endsWith('\n') ? '\n' : '') +
      '\n# vault-env — secret files, never commit\n' +
      missing.join('\n') +
      '\n';
    appendFileSync(gi, block);
    console.log(`vault-env: added to .gitignore -> ${missing.join(', ')}`);
  }
}

// Merge keys into .claude/settings.local.json -> "env" so Claude Code can expand
// them as ${VAR} inside .mcp.json. The file is gitignored (per-machine).
function writeClaudeEnv(envVars) {
  const file = join('.claude', 'settings.local.json');
  mkdirSync('.claude', { recursive: true });
  let settings = {};
  if (existsSync(file)) {
    try {
      settings = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      fail(`${file} is not valid JSON — ${e.message}`);
    }
  }
  settings.env = { ...(settings.env || {}), ...envVars };
  writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`);
}

async function main() {
  const cfg = loadConfig();
  const { token, via } = await resolveToken(cfg.address);
  console.log(`vault-env: authenticated via ${via}`);

  const merged = {};
  const conflicts = new Set();
  for (const path of cfg.paths) {
    const data = await readPath(cfg.address, token, cfg.kv, path);
    for (const [k, v] of Object.entries(data)) {
      if (k in merged && merged[k] !== v) conflicts.add(k);
      merged[k] = v;
    }
  }
  for (const k of conflicts) {
    console.warn(`vault-env: key "${k}" defined in multiple paths — later path wins`);
  }

  // Route each key: targets -> own file, claudeEnv -> Claude settings env, rest -> .env.
  const claudeEnvKeys = new Set(cfg.claudeEnv);
  const envKeys = [];
  const targetFiles = [];
  const claudeEnv = {};
  for (const key of Object.keys(merged).sort()) {
    const dest = cfg.targets[key];
    if (dest) {
      const dir = dirname(dest);
      if (dir && dir !== '.') mkdirSync(dir, { recursive: true });
      writeFileSync(dest, `${String(merged[key]).trim()}\n`);
      targetFiles.push(dest);
    } else if (claudeEnvKeys.has(key)) {
      claudeEnv[key] = String(merged[key]);
    } else {
      envKeys.push(key);
    }
  }

  const claudeEnvCount = Object.keys(claudeEnv).length;
  if (claudeEnvCount) writeClaudeEnv(claudeEnv);

  // Secrets must never be committed.
  ensureGitignored([
    '.env',
    '.vault/',
    '.claude/settings.local.json',
    ...targetFiles.map((f) => f.replace(/\\/g, '/')),
  ]);

  const body =
    '# Generated by vault-env from Vault — do NOT edit by hand.\n' +
    '# Local-only overrides belong in .env.local (not managed here).\n' +
    `# Source paths: ${cfg.paths.join(', ')}\n\n` +
    envKeys.map((k) => `${k}=${formatEnvValue(merged[k])}`).join('\n') +
    '\n';
  writeFileSync(cfg.output, body);

  console.log(`vault-env: wrote ${envKeys.length} secret(s) to ${cfg.output}`);
  for (const f of targetFiles) console.log(`vault-env: wrote ${f}`);
  if (claudeEnvCount) {
    console.log(`vault-env: wrote ${claudeEnvCount} key(s) into .claude/settings.local.json (env)`);
  }
}

main().catch((e) => fail(e?.message || String(e)));
