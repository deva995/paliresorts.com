import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const tests = readdirSync(new URL('../server/tests/', import.meta.url))
  .filter(name => name.endsWith('.test.ts'))
  .sort()
  .map(name => `server/tests/${name}`);
const result = spawnSync(process.execPath, [
  '--import', 'tsx', '--import', './server/tests/isolation.mjs',
  '--test', '--test-reporter=tap', ...tests
], { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });

// Print test identities and counts only, never arbitrary application logs or environment values.
for (const line of (result.stdout || '').split(/\r?\n/)) {
  if (/^(?:not ok \d+|# (?:tests|suites|pass|fail|cancelled|skipped|todo|duration_ms) )/.test(line)) {
    console.log(line);
  }
}
if (result.error) console.error(`Test runner failed: ${result.error.code || 'UNKNOWN'}`);
if (result.status !== 0) console.error('Isolated suite failed. Inspect individual tests with sanitized diagnostics.');
process.exitCode = result.status ?? 1;
