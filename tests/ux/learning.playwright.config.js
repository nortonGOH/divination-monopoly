const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: __dirname,
  testMatch: 'learning.spec.js',
  fullyParallel: false,
  retries: 0,
  reporter: 'line',
  use: { browserName: 'chromium', headless: true }
});
