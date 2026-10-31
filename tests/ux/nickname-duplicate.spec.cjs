const {test,expect}=require('@playwright/test');

test('duplicate nickname displays a warning and unique nickname can register',async({page})=>{
 const MOCK='https://mock-nickname-conflict.supabase.co';
 const joins=[];
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.hostname==='127.0.0.1'){
   if(url.pathname==='/config.js')return route.fulfill({
    status:200,contentType:'application/javascript',
    body:`window.QUIZ_AUTH_CONFIG={supabaseUrl:'${MOCK}',publishableKey:'mock-public-key-1234567890',turnstileSiteKey:''};`
   });
   return route.continue();
  }
  if(url.hostname!=='mock-nickname-conflict.supabase.co')return route.abort();
  const headers={'access-control-allow-origin':'*','access-control-allow-methods':'POST,GET,OPTIONS',
    'access-control-allow-headers':'*'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  let data={};try{data=JSON.parse(req.postData()||'{}')}catch(_){}
  const answer=(status,body)=>route.fulfill({
   status,headers,contentType:'application/json',body:JSON.stringify(body)
  });
  if(url.pathname.endsWith('/functions/v1/quiz-nickname-beginner')){
   if(data.action==='join'){
    joins.push(data.nickname);
    if(data.nickname.toLowerCase()==='visitor')
     return answer(409,{code:'nickname_taken',error:'此暱名已被使用，請更換其他名稱。'});
    return answer(200,{accepted:true,nickname:data.nickname,total_attempts:0,correct_attempts:0});
   }
   return answer(200,{accepted:true,nickname:'UniqueOne',total_attempts:0,correct_attempts:0});
  }
  if(url.pathname.endsWith('/functions/v1/quiz-guest-trial'))return answer(200,{used:0,remaining:5,limit:5,locked:false});
  return answer(200,[]);
 });
 await page.goto('/');
 const field=page.locator('#nicknameBeginnerInput');
 const status=page.locator('#nicknameBeginnerStatus');
 await expect(field).toBeVisible();
 await field.fill('Visitor');
 await page.getByRole('button',{name:'用暱稱挑戰初階'}).click();
 await expect(status).toContainText('已有人使用');
 await expect(field).toHaveAttribute('aria-invalid','true');
 await expect(page.getByRole('button',{name:'用暱稱挑戰初階'})).toBeEnabled();
 await field.fill('UniqueOne');
 await page.getByRole('button',{name:'用暱稱挑戰初階'}).click();
 await expect(status).toContainText('暱稱 UniqueOne');
 await expect(field).not.toHaveAttribute('aria-invalid','true');
 expect(joins).toEqual(['Visitor','UniqueOne']);
});
