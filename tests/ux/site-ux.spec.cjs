const {test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>{
  // Block every external host, including live Supabase; tests never reach production APIs.
  await page.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(u.hostname==='127.0.0.1'){
      if(u.pathname==='/config.js')
        return route.fulfill({status:200,contentType:'application/javascript',body:"window.QUIZ_AUTH_CONFIG={supabaseUrl:'https://mock-ux.supabase.co',publishableKey:'mock-key',turnstileSiteKey:''};"});
      return route.continue();
    }
    return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'[]'});
  });
  await page.goto('/');
});
test('keyboard skip link goes to main content',async({page})=>{
  await page.keyboard.press('Tab');
  const link=page.locator('.ux-skip-link');
  await expect(link).toBeFocused();
  await expect(link).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#mainContent$/);
  await expect(page.locator('#mainContent')).toBeFocused();
});
test('quick navigation targets actual challenge, quiz and history',async({page})=>{
  const nav=page.getByRole('navigation',{name:'網站快速導覽'});
  await expect(nav.getByRole('link')).toHaveCount(3);
  for(const [name,target] of [['開始挑戰','spinBtn'],['題目與難度','quizTitle'],['史料閱覽','historyHeading']]){
    const item=nav.getByRole('link',{name});
    await expect(item).toHaveAttribute('href','#'+target);
    await expect(page.locator('#'+target)).toHaveCount(1);
  }
  await nav.getByRole('link',{name:'題目與難度'}).click();
  await expect(page).toHaveURL(/#quizTitle$/);
  await expect(page.locator('#quizDifficulty')).toHaveCount(1);
});
test('instructions expand accessibly without forcing login',async({page})=>{
  const details=page.locator('.ux-howto');
  await expect(details).not.toHaveAttribute('open','');
  await details.locator('summary').click();
  await expect(details).toHaveAttribute('open','');
  await expect(details).toContainText('抽宿挑戰');
  await details.locator('summary').click();
  await expect(details).not.toHaveAttribute('open','');
});
test('mobile touch targets and back to top work at 375px',async({page})=>{
  await page.setViewportSize({width:375,height:812});
  await page.reload();
  const nav=page.locator('.ux-quick-nav');
  await expect(nav).toBeVisible();
  for(const a of await nav.locator('a').all()){
    const b=await a.boundingBox();
    expect(b.height).toBeGreaterThanOrEqual(44);
  }
  const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client+2);
  await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
  const top=page.locator('#uxBackTop');
  await expect(top).toBeVisible();
  await top.click();
  await expect(page).toHaveURL(/#pageStart$/);
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeLessThan(10);
});
