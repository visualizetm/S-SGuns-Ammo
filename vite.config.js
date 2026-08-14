import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';

// Inject the git commit SHA at build time. Vercel exposes VERCEL_GIT_COMMIT_SHA;
// local builds fall back to `git rev-parse`, then to "dev" (e.g. no commits yet).
function resolveCommitSha() {
  let sha = process.env.VERCEL_GIT_COMMIT_SHA || '';
  if (!sha) {
    try {
      sha = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim();
    } catch {
      sha = '';
    }
  }
  return sha ? sha.slice(0, 7) : 'dev';
}

export default defineConfig({
  plugins: [react()],
  define: {
    __COMMIT_SHA__: JSON.stringify(resolveCommitSha()),
  },
});
