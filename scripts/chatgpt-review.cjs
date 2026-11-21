const { execSync, spawnSync } = require('child_process');
const path = require('path');

const promptArg = process.argv.slice(2).join(' ').trim();
const defaultPrompt = promptArg || 'Please review the latest phase changes, tests, and architecture status for the CONSTRUCTION project.';

console.log(`[ChatGPT Reviewer] Gathering project context...`);

let gitDiff = '';
try {
  gitDiff = execSync('git diff --stat HEAD~1', { encoding: 'utf-8', timeout: 5000 });
} catch {
  try {
    gitDiff = execSync('git status --short', { encoding: 'utf-8', timeout: 5000 });
  } catch {}
}

const fullPrompt = `${defaultPrompt}\n\nRecent Repository Status:\n${gitDiff || 'No recent diff available'}`;

console.log(`[ChatGPT Reviewer] Submitting to bound ChatGPT conversation...`);

const result = spawnSync('chatgpt', ['ask', fullPrompt], {
  stdio: 'inherit',
  shell: true,
  cwd: path.resolve(__dirname, '..')
});

if (result.error) {
  console.error('[ChatGPT Reviewer] Error invoking chatgpt CLI:', result.error.message);
  process.exit(1);
}
