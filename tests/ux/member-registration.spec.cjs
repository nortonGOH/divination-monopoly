const {test,expect}=require('@playwright/test');
const MOCK='https://mock-registration.supabase.co';
async function setup(page,{signupStatus=200,signupData={user:{id:'mock-registration'}},resendStatus=200,loginStatus=200}={}){
 const requests=[];
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.hostname==='127.0.0.1'){
   if(url.pathname==='/config.js')
    return route.fulfill({status:200,contentType:'application/javascript',
      body:"window.QUIZ_AUTH_CONFIG={supabaseUrl:'"+MOCK+"',publishableKey:'mock-public-key-123',turnstileSiteKey:''};"});
   return route.continue();
  }
  if(url.hostname!=='mock-registration.supabase.co')return route.abort();
  const h={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST,GET,OPTIONS'};
  if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:h});
  const path=url.pathname,raw=request.postData();
  const data=raw?JSON.parse(raw):{};
  requests.push({path,query:url.search,method:request.method(),body:data});
  let result=[],status=200;
  if(path==='/auth/v1/signup'){
    status=signupStatus;
    result=status===200?signupData:{code:'over_email_send_rate_limit',msg:'email rate limit exceeded'};
  }else if(path==='/auth/v1/resend'){
    status=resendStatus;
    result=status===200?{}:{code:'over_email_send_rate_limit',message:'email rate limit exceeded'};
  }else if(path==='/auth/v1/token'){
    status=loginStatus;
    result=status===200?{access_token:'mock-member-token'}:{code:'invalid_credentials',message:'Invalid login credentials'};
  }else if(path.endsWith('/rpc/quiz_player_status')){
    result={wrong_count:0,locked:false,total_attempts:0,correct_attempts:0,success_rate:0};
  }else if(path.endsWith('/rpc/quiz_answered_question_ids'))result=[];
  else if(path.endsWith('/rpc/quiz_my_profile'))result={nickname:'測試會員',leaderboard_opt_in:false};
  else if(path.endsWith('/rpc/quiz_record_member_login'))result={success:true};
  return route.fulfill({status,headers:h,contentType:'application/json',body:JSON.stringify(result)});
 });
 await page.goto('/');
 await page.evaluate(()=>{
   // Mock captcha bypasses only local UI tests; production code keeps Turnstile enforcement.
   window.quizCaptcha.token=()=> 'mock-turnstile-token';
   window.quizCaptcha.reset=()=> {};
 });
 return {requests};
}
async function openSignup(page){
 await page.locator('#playerSignInBtn').click();
 await page.getByRole('button',{name:'建立新帳號',exact:true}).click();
 await expect(page.getByRole('heading',{name:'建立數術挑戰帳號'})).toBeVisible();
}
async function fillSignup(page,pass='secure-testing-123'){
 await page.locator('#playerEmail').fill('tester@example.test');
 await page.locator('#playerPassword').fill(pass);
 await page.locator('#playerConfirmPassword').fill(pass);
 await page.locator('#playerNickname').fill('測試會員');
}
test('signup Enter submits signup only and shows honest email verification guidance',async({page})=>{
 const {requests}=await setup(page);
 await openSignup(page);
 await expect(page.locator('#playerPassword')).toHaveAttribute('autocomplete','new-password');
 await expect(page.locator('#playerConfirmPassword')).toHaveAttribute('required','');
 await fillSignup(page);
 await page.locator('#playerConfirmPassword').press('Enter');
 await expect(page.getByRole('heading',{name:'驗證電子郵件'})).toBeVisible();
 await expect(page.locator('#playerAuthNotice')).toContainText('註冊請求已受理');
 await expect(page.locator('#playerAuthNotice')).toContainText('尚未代表已登入');
 await expect(page.locator('#playerAuthForm')).toContainText('秒後重寄');
 await expect(page.getByRole('button',{name:/可於 .* 秒後重寄/})).toBeDisabled();
 const signup=requests.filter(r=>r.path==='/auth/v1/signup');
 expect(signup).toHaveLength(1);
 expect(requests.filter(r=>r.path==='/auth/v1/token')).toHaveLength(0);
 expect(signup[0].query).toContain('redirect_to=');
 expect(signup[0].body).toMatchObject({
   email:'tester@example.test',data:{nickname:'測試會員'},
   gotrue_meta_security:{captcha_token:'mock-turnstile-token'}
 });
 expect(requests.every(x=>!x.path.includes('/rest/v1/quiz_questions'))).toBe(true);
});
test('signup password mismatch prevents all Auth calls, preserves draft and permits correction',async({page})=>{
 const {requests}=await setup(page);
 await openSignup(page);await fillSignup(page);
 await page.locator('#playerConfirmPassword').fill('not-equal-at-least-ten');
 await page.getByRole('button',{name:'送出註冊'}).click();
 await expect(page.locator('#playerAuthNotice')).toContainText('兩次輸入的密碼不同');
 expect(requests.filter(x=>x.path==='/auth/v1/signup')).toHaveLength(0);
 await expect(page.locator('#playerEmail')).toHaveValue('tester@example.test');
 await page.locator('#playerConfirmPassword').fill('secure-testing-123');
 await page.getByRole('button',{name:'送出註冊'}).click();
 await expect(page.getByRole('heading',{name:'驗證電子郵件'})).toBeVisible();
 expect(requests.filter(x=>x.path==='/auth/v1/signup')).toHaveLength(1);
});
test('weak signup password and invalid nickname are blocked without a network send',async({page})=>{
 const {requests}=await setup(page);
 await openSignup(page);await fillSignup(page,'short');
 await page.getByRole('button',{name:'送出註冊'}).click();
 await expect(page.locator('#playerAuthNotice')).toContainText('請檢查必填欄位及輸入格式');
 expect(requests.filter(x=>x.path==='/auth/v1/signup')).toHaveLength(0);
 await page.locator('#playerPassword').fill('secure-testing-123');
 await page.locator('#playerConfirmPassword').fill('secure-testing-123');
 await page.locator('#playerNickname').fill('a!');
 await page.getByRole('button',{name:'送出註冊'}).click();
 await expect(page.locator('#playerAuthNotice')).toContainText('暱稱需為 2～18 字');
 expect(requests.filter(x=>x.path==='/auth/v1/signup')).toHaveLength(0);
});
test('email quota failure explains SMTP and keeps signup fields for later retry',async({page})=>{
 const {requests}=await setup(page,{signupStatus:429});
 await openSignup(page);await fillSignup(page);
 await page.getByRole('button',{name:'送出註冊'}).click();
 await expect(page.locator('#playerAuthNotice')).toContainText('限額');
 await expect(page.locator('#playerAuthNotice')).toContainText('SMTP');
 await expect(page.getByRole('heading',{name:'建立數術挑戰帳號'})).toBeVisible();
 await expect(page.locator('#playerEmail')).toHaveValue('tester@example.test');
 expect(requests.filter(x=>x.path==='/auth/v1/signup')).toHaveLength(1);
});
test('verification state can go to login with prefilled email but no password stored',async({page})=>{
 await setup(page);await openSignup(page);await fillSignup(page);
 await page.getByRole('button',{name:'送出註冊'}).click();
 await page.getByRole('button',{name:'已完成驗證，前往登入'}).click();
 await expect(page.getByRole('heading',{name:'數術知識挑戰・帳號登入'})).toBeVisible();
 await expect(page.locator('#playerEmail')).toHaveValue('tester@example.test');
 await expect(page.locator('#playerPassword')).toHaveValue('');
 await expect(page.locator('#playerConfirmPassword')).toHaveValue('');
 await expect(page.locator('#playerPassword')).toHaveAttribute('autocomplete','current-password');
});
test('signup passwords are toggled accessibly; existing login still reaches current profile',async({page})=>{
 const {requests}=await setup(page);
 await page.locator('#playerSignInBtn').click();
 await page.locator('#playerEmail').fill('existing@example.test');
 await page.locator('#playerPassword').fill('existing-strong-password');
 await page.getByRole('button',{name:'顯示密碼'}).click();
 await expect(page.locator('#playerPassword')).toHaveAttribute('type','text');
 await expect(page.getByRole('button',{name:'隱藏密碼'})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'隱藏密碼'}).click();
 await expect(page.locator('#playerPassword')).toHaveAttribute('type','password');
 await page.getByRole('button',{name:'登入',exact:true}).click();
 await expect(page.locator('#playerStateText')).toContainText('測試會員');
 await expect(page.locator('#playerSignInBtn')).toBeHidden();
 expect(requests.filter(x=>x.path==='/auth/v1/token')).toHaveLength(1);
 expect(requests.filter(x=>x.path==='/auth/v1/signup')).toHaveLength(0);
});
test('mobile signup shows keyboard-friendly controls without horizontal overflow',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 await setup(page);await openSignup(page);
 const box=await page.locator('#playerAuthForm').boundingBox();
 expect(box.width).toBeLessThanOrEqual(375);
 await expect(page.getByRole('button',{name:'送出註冊'})).toBeVisible();
 await expect(page.locator('#playerEmail')).toHaveAttribute('inputmode','email');
});

test('verification resend is delayed, uses fresh captcha and never auto-retries',async({page})=>{
 await page.clock.install({time:new Date('2026-10-29T12:00:00Z')});
 const {requests}=await setup(page);
 await openSignup(page);await fillSignup(page);
 await page.getByRole('button',{name:'送出註冊'}).click();
 await expect(page.getByRole('heading',{name:'驗證電子郵件'})).toBeVisible();
 expect(requests.filter(x=>x.path==='/auth/v1/resend')).toHaveLength(0);
 await page.clock.fastForward(91000);
 const resend=page.getByRole('button',{name:'重新寄送驗證信'});
 await expect(resend).toBeEnabled();
 await resend.click();
 await expect(page.locator('#playerAuthNotice')).toContainText('重寄請求已受理');
 const sent=requests.filter(x=>x.path==='/auth/v1/resend');
 expect(sent).toHaveLength(1);
 expect(sent[0].body).toMatchObject({
   email:'tester@example.test',type:'signup',
   gotrue_meta_security:{captcha_token:'mock-turnstile-token'}
 });
 await expect(page.getByRole('button',{name:/可於 .* 秒後重寄/})).toBeDisabled();
});
