// @ts-check
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
dotenv.config();
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * @see https://playwright.dev/docs/test-configuration
 */

export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: 2,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    // baseURL: 'http://localhost:3000',
    storageState: 'auth.json',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'setup',
      testMatch: 'tests/bulkCreateIssues.spec.js',
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
        testDataPath: process.env.TEST_DATA_PATH,
        outputPath: process.env.OUTPUT_PATH
      },
    },

    {
      name: 'scenarios',
      testMatch: 'tests/attachFilesParallel.spec.js',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
        testDataPath: process.env.TEST_DATA_PATH,
        outputPath: process.env.OUTPUT_PATH
      },
    },

    {
      name: 'scenarios-only',
      testMatch: 'tests/attachFilesParallel.spec.js',
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
        testDataPath: process.env.TEST_DATA_PATH,
        outputPath: process.env.OUTPUT_PATH
      },
    },

    {
      name: 'evidence-with-scenarios',
      testMatch: 'tests/uploadEvidence.spec.js',
      dependencies: ['scenarios-only'],
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
        testDataPath: process.env.TEST_DATA_PATH,
        outputPath: process.env.OUTPUT_PATH
      },
    },

    {
      name: 'evidence-only',
      testMatch: 'tests/uploadEvidence.spec.js',
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
        testDataPath: process.env.TEST_DATA_PATH,
        outputPath: process.env.OUTPUT_PATH
      },
    },

    {
      name: 'evidence',
      testMatch: 'tests/uploadEvidence.spec.js',
      dependencies: ['scenarios'],
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
        testDataPath: process.env.TEST_DATA_PATH,
        outputPath: process.env.OUTPUT_PATH
      },
    },

    {
      name: 'full-process',
      testMatch: 'tests/downloadCSV.spec.js',
      dependencies: ['evidence'],
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
        testDataPath: process.env.TEST_DATA_PATH,
        outputPath: process.env.OUTPUT_PATH
      },
    },

    {
      name: 'download-csv',
      testMatch: 'tests/downloadCSV.spec.js',
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
        testDataPath: process.env.TEST_DATA_PATH,
        outputPath: process.env.OUTPUT_PATH
      },
    },

    {
      name: 'download-csv-with-evidence',
      testMatch: 'tests/downloadCSV.spec.js',
      dependencies: ['evidence-with-scenarios'],
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
        testDataPath: process.env.TEST_DATA_PATH,
        outputPath: process.env.OUTPUT_PATH
      },
    }
  ]
});

