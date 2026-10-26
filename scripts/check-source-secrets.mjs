// Reports paths/key names only; secret values and matching lines are never printed.
import { readFileSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const secrets = [];
for (const file of ['.env', 'server/.env']) {
  if (!existsSync(resolve(root, file))) continue;
  for (const line of readFileSync(resolve(root, file), 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || !/PASSWORD|SECRET|API_KEY|DATABASE_URL|TOKEN/.test(match[1])) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
    if (value.length >= 12) secrets.push({ key: match[1], value });
  }
}
const inventory = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' });
if (inventory.status !== 0) throw new Error('Cannot inspect source control inventory');
let findings = 0;
let checked = 0;
for (const name of new Set(inventory.stdout.split('\0').filter(Boolean))) {
  const file = resolve(root, name);
  if (!statSync(file).isFile() || statSync(file).size > 3 * 1024 * 1024 || !/\.(?:[cm]?[jt]sx?|json|md|sql|toml|ya?ml|sh|txt|example)$/.test(name)) continue;
  const content = readFileSync(file, 'utf8');
  checked++;
  for (const secret of secrets) {
    if (content.includes(secret.value)) { findings++; console.log(`Review required: ${name} matches local ${secret.key}`); }
  }
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content)) { findings++; console.log(`Review required: ${name} contains a private-key marker`); }
}
console.log(`Source secret check: ${checked} text files checked, ${findings} findings`);
console.log('Scope: exact sensitive local environment values and private-key markers; not a comprehensive secret scanner.');
process.exitCode = findings ? 1 : 0;
