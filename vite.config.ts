import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The build is a single self-contained index.html so it also opens straight from a folder (file://).
export default defineConfig({
  plugins: [svelte(), viteSingleFile()],
  test: {
    include: ['src/**/*.test.ts'],
    // vitest otherwise takes every core but one; four keep the machine usable while the suite runs (VITEST_MAX_WORKERS overrides)
    maxWorkers: Number(process.env.VITEST_MAX_WORKERS ?? 4),
  },
});
