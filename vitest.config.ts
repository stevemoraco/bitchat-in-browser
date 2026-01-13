/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [preact()],
  test: {
    // Test environment
    environment: 'jsdom',

    // Global setup for all tests
    globals: true,

    // Setup files run before each test file
    setupFiles: ['./src/test/setup.ts'],

    // Include patterns (tests and benchmarks)
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.bench.ts'],

    // Exclude patterns
    exclude: ['node_modules', 'dist', 'e2e'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/*.bench.ts',
        'src/__benchmarks__/**/*',
        'src/test/**/*',
        'src/**/*.d.ts',
        'src/main.tsx',
      ],
      // Thresholds - adjust as coverage improves
      thresholds: {
        statements: 50,
        branches: 50,
        functions: 50,
        lines: 50,
      },
    },

    // Mock configuration
    mockReset: true,
    restoreMocks: true,

    // Timeout for async tests (benchmarks may need longer)
    testTimeout: 60000,

    // Reporter configuration
    reporters: ['verbose'],

    // Watch mode patterns
    watchExclude: ['node_modules', 'dist'],

    // Alias matching vite config
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@services': resolve(__dirname, './src/services'),
      '@stores': resolve(__dirname, './src/stores'),
      '@utils': resolve(__dirname, './src/utils'),
      '@types': resolve(__dirname, './src/types'),
      '@test': resolve(__dirname, './src/test'),
    },

    // CSS handling
    css: true,

    // Dependencies that need transformation
    deps: {
      inline: [/preact/, /nostr-tools/, /libsodium-wrappers-sumo/, /libsodium-sumo/],
    },

    // Pool options for test isolation
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },
  },

  // Resolve configuration matching main vite config
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@services': resolve(__dirname, './src/services'),
      '@stores': resolve(__dirname, './src/stores'),
      '@utils': resolve(__dirname, './src/utils'),
      '@types': resolve(__dirname, './src/types'),
      '@test': resolve(__dirname, './src/test'),
      // Fix libsodium ESM resolution issue
      './libsodium-sumo.mjs': resolve(
        __dirname,
        './node_modules/libsodium-sumo/dist/modules-sumo-esm/libsodium-sumo.mjs'
      ),
    },
  },
});
