// Contract tests: run the frontend's own API modules against a LIVE backend (see README "Frontend tests").
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.api.test.js'], testTimeout: 30000, hookTimeout: 30000, fileParallelism: false },
});
