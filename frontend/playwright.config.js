// @ts-check
const { defineConfig } = require('@playwright/test');

const EDGE_PATH = process.env.SMOKE_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 90000,
  expect: {
    timeout: 15000
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.SMOKE_FRONTEND_URL || 'http://localhost:4200',
    launchOptions: {
      executablePath: EDGE_PATH,
      channel: undefined
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off'
  }
});