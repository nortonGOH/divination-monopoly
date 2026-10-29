const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
  testDir:__dirname,
  testMatch:'*.spec.cjs',
  timeout:30000,
  retries:1,
  workers:1,
  reporter:[['list'],['junit',{outputFile:'test-results/ux.xml'}]],
  use:{baseURL:'http://127.0.0.1:4177',browserName:'chromium',headless:true,reducedMotion:'reduce'},
  webServer:{command:'python3 -m http.server 4177 --bind 127.0.0.1 --directory ../..',url:'http://127.0.0.1:4177',reuseExistingServer:!process.env.CI,timeout:30000}
});
