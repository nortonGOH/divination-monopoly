const {test,expect}=require('@playwright/test');
const MOCK='https://mock-ux.supabase.co';
async function setup(page,{inviteStatus=400,inviteError='email rate limit exceeded'}={}){
 const requests=[];
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.hostname==='127.0.0.1'){
   if(u.pathname==='/config.js')
    return route.fulfill({status:200,contentType:'application/javascript',
     body:"window.QUIZ_AUTH_CONFIG={supabaseUrl:'"+MOCK+"',publishableKey:'mock-key-123456789012345',turnstileSiteKey:''};"});
   return route.continue();
  }
  if(u.hostname!=='mock-ux.supabase.co')return route.abort();
  const h={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST,GET,OPTIONS'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:h});
  const path=u.pathname;
  const data=path.endsWith('/functions/v1/quiz-admin-users')?JSON.parse(req.postData()||'{}'):{};
  if(path.endsWith('/functions/v1/quiz-admin-users'))requests.push(data);
  const status=data.action==='invite'?inviteStatus:200;
  const response=data.action==='list'?{users:[]}:data.action==='invite'
   ?(status===200?{ok:true,message:'邀請已寄出'}:{error:inviteError}):[];
  return route.fulfill({status,contentType:'application/json',headers:h,body:JSON.stringify(response)});
 });
 await page.goto('/');
 await page.evaluate(()=>{adminAccessToken='mock-admin-token';document.getElementById('bankDialog').showModal();});
 await page.getByRole('button',{name:'會員帳號管理'}).click();
 await expect(page.getByRole('heading',{name:'會員帳號管理（限管理員）'})).toBeVisible();
 return {requests};
}
test('email quota failure is explained in Chinese without repeated sends or leaked credentials',async({page})=>{
 const {requests}=await setup(page);
 await page.getByPlaceholder('受邀者電子郵件').fill('fixture@example.test');
 await page.getByRole('button',{name:'寄送邀請'}).click();
 const status=page.getByRole('status').filter({hasText:'邀請尚未寄出'});
 await expect(status).toBeVisible();
 await expect(status).toContainText('郵件額度已用盡');
 await expect(status).toContainText('專用 SMTP');
 await expect(page.getByRole('button',{name:'寄送邀請'})).toBeEnabled();
 await expect(page.getByRole('link',{name:'查看 Supabase SMTP 設定說明'}))
  .toHaveAttribute('href','https://supabase.com/docs/guides/auth/auth-smtp');
 expect(requests.filter(x=>x.action==='invite')).toHaveLength(1);
 expect(requests.some(x=>x.action==='delete')).toBe(false);
});
test('ordinary invite failure displays actual error without being labeled quota exceeded',async({page})=>{
 await setup(page,{inviteError:'not authorized to invite'});
 await page.getByPlaceholder('受邀者電子郵件').fill('fixture@example.test');
 await page.getByRole('button',{name:'寄送邀請'}).click();
 const status=page.getByRole('status').filter({hasText:'邀請失敗'});
 await expect(status).toContainText('not authorized to invite');
 await expect(status).not.toContainText('郵件額度已用盡');
});
