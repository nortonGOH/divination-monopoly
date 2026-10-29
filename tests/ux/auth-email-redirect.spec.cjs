const {test,expect}=require('@playwright/test');
const MOCK='https://mock-auth-redirect.supabase.co';
const CORRECT='https://nortongoh.github.io/divination-monopoly/';
async function boot(page){
 const calls=[];
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.hostname==='127.0.0.1'){
   if(u.pathname==='/config.js'){
     return route.fulfill({status:200,contentType:'application/javascript',
       body:"window.QUIZ_AUTH_CONFIG={supabaseUrl:'"+MOCK+"',publishableKey:'mock-publishable-12345',turnstileSiteKey:''};"});
   }
   return route.continue();
  }
  if(u.hostname!=='mock-auth-redirect.supabase.co')return route.abort();
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST,GET,OPTIONS'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers,body:''});
  calls.push({url:req.url(),method:req.method(),body:req.postData()});
  let reply=[];
  if(u.pathname==='/auth/v1/signup')reply={user:{id:'fixture-user'},session:null};
  return route.fulfill({status:200,contentType:'application/json',headers,body:JSON.stringify(reply)});
 });
 await page.goto('/');
 return calls;
}
test('signup requests point Supabase confirmation back to the GitHub Pages project path',async({page})=>{
 const calls=await boot(page);
 await page.locator('#playerSignInBtn').click();
 await page.getByRole('button',{name:'建立新帳號'}).click();
 await page.locator('#playerAuthForm input[type="email"]').fill('fixture@valid.test');
 await page.locator('#playerAuthForm input[type="password"]').fill('test-password-123');
 await page.locator('#playerNickname').fill('測試會員');
 await page.getByRole('button',{name:'確認建立新帳號'}).click();
 await expect(page.getByRole('status').filter({hasText:'註冊請求已送出'})).toBeVisible();
 const requests=calls.filter(item=>new URL(item.url).pathname==='/auth/v1/signup');
 expect(requests).toHaveLength(1);
 const url=new URL(requests[0].url);
 expect(url.searchParams.get('redirect_to')).toBe(CORRECT);
 expect(url.searchParams.get('redirect_to')).not.toBe('https://nortongoh.github.io/');
 expect(requests[0].method).toBe('POST');
 expect(JSON.parse(requests[0].body)).toMatchObject({email:'fixture@valid.test',data:{nickname:'測試會員'}});
 expect(calls.every(item=>new URL(item.url).hostname==='mock-auth-redirect.supabase.co')).toBe(true);
});
