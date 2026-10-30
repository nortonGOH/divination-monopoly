const {test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>{
  // Real production Supabase and all third-party hosts are always mocked.
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='127.0.0.1'){
      if(url.pathname==='/config.js'){
        return route.fulfill({status:200,contentType:'application/javascript',body:
          "window.QUIZ_AUTH_CONFIG={supabaseUrl:'https://mock-learning.supabase.co',publishableKey:'mock-key-123456789012345',turnstileSiteKey:''};"});
      }
      return route.continue();
    }
    return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'[]'});
  });
  await page.goto('/');
});

test('standalone lessons render without live quiz bank, member credentials or answers',async({page})=>{
  const map=page.locator('#learningMap');
  await expect(map.getByText('數術知識學習地圖')).toBeVisible();
  await expect(map.locator('.learn-map-node')).toHaveCount(11);
  const detail=map.locator('.learn-map-detail');
  await expect(detail).toContainText('數術文獻與歷史分類');
  await expect(detail).toContainText('學習重點');
  await expect(detail).toContainText('史料與研究方法');
  await expect(detail).toContainText('證據界線');
  await expect(detail.locator('a')).toHaveCount(1);
  await expect(detail.locator('a')).toHaveAttribute('href','https://ctext.org/han-shu/yi-wen-zhi');
  await expect(map).not.toContainText('對應題庫：');
  await expect(map).not.toContainText('尚未登入會員');
});
test('reading marks persist on this device and do not change quiz score',async({page})=>{
  const map=page.locator('#learningMap');
  const before=await page.locator('#quizScore').textContent();
  await map.getByRole('button',{name:'閱讀後標記本單元'}).click();
  await expect(map).toContainText('已標記閱讀 1／39 單元');
  await page.reload();
  await expect(map).toContainText('已標記閱讀 1／39 單元');
  await expect(map.getByRole('button',{name:/已閱讀.*取消標記/})).toBeVisible();
  expect(await page.locator('#quizScore').textContent()).toEqual(before);
  await map.getByRole('button',{name:/已閱讀.*取消標記/}).click();
  await expect(map).toContainText('已標記閱讀 0／39 單元');
});
test('all 28 mansion lesson cards provide their own sources and atlas deep link',async({page})=>{
  const map=page.locator('#learningMap');
  await map.getByRole('button',{name:'四象二十八宿 28 單元'}).click();
  await expect(map.locator('.learn-map-node')).toHaveCount(28);
  await expect(map.locator('.learn-map-path-heading')).toHaveCount(4);
  const detail=map.locator('.learn-map-detail');
  await expect(detail).toContainText('角宿');
  await expect(detail).toContainText('《史記》');
  await expect(detail.locator('.learn-map-atlas')).toHaveAttribute('href','./mansions-atlas.html?m=%E8%A7%92');
  await map.locator('.learn-map-node').nth(7).click();
  await expect(detail).toContainText('斗宿');
  await expect(detail.locator('.learn-map-atlas')).toHaveAttribute('href','./mansions-atlas.html?m=%E6%96%97');
});
