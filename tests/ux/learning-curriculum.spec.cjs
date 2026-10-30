const {test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>{
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='127.0.0.1'){
   if(url.pathname==='/config.js')return route.fulfill({status:200,contentType:'application/javascript',
    body:"window.QUIZ_AUTH_CONFIG={supabaseUrl:'https://mock-learning.supabase.co',publishableKey:'mock-key-123456789012345',turnstileSiteKey:''};"});
   return route.continue();
  }
  return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'[]'});
 });
 await page.goto('/');
});
test('guest reads only three introductory modules; member lessons have titles but no body',async({page})=>{
 const map=page.locator('#learningMap');
 await expect(map).toContainText('遊客入門：已標記閱讀 0／3 單元');
 await expect(map.locator('.learn-map-node')).toHaveCount(11);
 await expect(map.locator('.learn-map-node[data-locked=true]')).toHaveCount(8);
 await expect(map.locator('.learn-map-detail')).toContainText('數術文獻與歷史分類');
 await expect(map.locator('.learn-map-detail')).toContainText('學習重點');
 await map.locator('.learn-map-node').nth(4).click();
 await expect(map.locator('.learn-map-detail')).toContainText('註冊／登入會員解鎖全部教材');
 await expect(map.locator('.learn-map-detail')).not.toContainText('學習重點');
 await map.getByRole('button',{name:'四象二十八宿 28 單元'}).click();
 await expect(map.locator('.learn-map-node[data-locked=true]')).toHaveCount(28);
 await expect(map.locator('.learn-map-path-heading')).toHaveCount(4);
 await expect(map.locator('.learn-map-detail')).not.toContainText('史料與研究方法');
});
test('intro reading marker survives reload without altering quiz score',async({page})=>{
 const map=page.locator('#learningMap');
 const score=await page.locator('#quizScore').textContent();
 await map.getByRole('button',{name:'閱讀後標記本單元'}).click();
 await expect(map).toContainText('已標記閱讀 1／3 單元');
 await page.reload();
 await expect(map).toContainText('已標記閱讀 1／3 單元');
 expect(await page.locator('#quizScore').textContent()).toBe(score);
 await map.getByRole('button',{name:/已閱讀.*取消標記/}).click();
 await expect(map).toContainText('已標記閱讀 0／3 單元');
});
test('member fetch is authenticated; logging out instantly removes member-only details',async({page})=>{
 const rows=await page.evaluate(()=>[...window.NUMEROLOGY_CURRICULUM.topics,...window.NUMEROLOGY_CURRICULUM.mansions]
  .filter(x=>x.access_tier==='member').map(x=>({id:x.id,access_tier:'member',
    lead:'會員受保護導讀：'+x.title,points:['專屬學習重點一','專屬學習重點二','專屬學習重點三'],
    method:'會員方法內容',question:'會員研究問題',caution:'會員證據限制',sources:['han'],
    atlas_name:x.id.startsWith('mansion-')?x.title.slice(0,1):null})));
 let header='';
 await page.route('**/rest/v1/learning_curriculum_lessons?**',async route=>{
  header=route.request().headers()['authorization']||'';
  await route.fulfill({status:200,contentType:'application/json',
   headers:{'access-control-allow-origin':'*'},body:JSON.stringify(rows)});
 });
 await page.evaluate(()=>{
  window.quizMemberToken=()=> 'test-valid-member-token';
  window.dispatchEvent(new Event('quiz-member-session-changed'));
 });
 const map=page.locator('#learningMap');
 await expect(map).toContainText('會員教材：已標記閱讀 0／39 單元');
 expect(header).toBe('Bearer test-valid-member-token');
 await map.locator('.learn-map-node').nth(4).click();
 await expect(map.locator('.learn-map-detail')).toContainText('專屬學習重點一');
 await map.getByRole('button',{name:'四象二十八宿 28 單元'}).click();
 const detail=map.locator('.learn-map-detail');
 await expect(detail.locator('.learn-map-atlas')).toHaveAttribute('href','./mansions-atlas.html?m=%E8%A7%92');
 await page.evaluate(()=>{
  window.quizMemberToken=()=> '';
  window.dispatchEvent(new Event('quiz-member-session-changed'));
 });
 await expect(map).toContainText('遊客入門：已標記閱讀 0／3 單元');
 await expect(detail).not.toContainText('專屬學習重點一');
 await expect(detail).toContainText('僅供已登入會員閱讀');
});
test('server authorization denial does not expose protected content',async({page})=>{
 await page.route('**/rest/v1/learning_curriculum_lessons?**',route=>route.fulfill({
  status:403,contentType:'application/json',headers:{'access-control-allow-origin':'*'},
  body:'{"message":"Forbidden"}'
 }));
 await page.evaluate(()=>{
  window.quizMemberToken=()=> 'invalid-jwt-token';
  window.dispatchEvent(new Event('quiz-member-session-changed'));
 });
 const map=page.locator('#learningMap');
 await map.locator('.learn-map-node').nth(3).click();
 await expect(map.locator('.learn-map-detail')).toContainText('未能通過會員教材驗證');
 await expect(map.locator('.learn-map-detail')).not.toContainText('學習重點');
});
