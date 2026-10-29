const {test,expect}=require('@playwright/test');
const MOCK='https://mock-leader-reset.supabase.co';
async function setup(page,{members=7,recoveryError=false}={}){
 const calls=[],entries=[
  {position:1,nickname:'甲',total_attempts:11,correct_attempts:10,success_rate:90.9},
  {position:2,nickname:'乙',total_attempts:10,correct_attempts:8,success_rate:80},
  {position:3,nickname:'丙',total_attempts:10,correct_attempts:5,success_rate:50},
  {position:4,nickname:'丁',total_attempts:3,correct_attempts:0,success_rate:0},
  {position:5,nickname:'戊',total_attempts:0,correct_attempts:0,success_rate:0}
 ];
 await page.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.hostname==='127.0.0.1'){
     if(url.pathname==='/config.js')return route.fulfill({status:200,contentType:'application/javascript',
       body:"window.QUIZ_AUTH_CONFIG={supabaseUrl:'"+MOCK+"',publishableKey:'mock-publishable-1234567890',turnstileSiteKey:''};"});
     return route.continue();
   }
   if(url.hostname!=='mock-leader-reset.supabase.co')return route.abort();
   const h={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST,PUT,GET,OPTIONS'};
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:h});
   const path=url.pathname,payload=JSON.parse(req.postData()||'{}');
   calls.push({path,url:req.url(),method:req.method(),payload,auth:req.headers().authorization});
   let status=200,result=[];
   if(path.endsWith('/rpc/quiz_public_leaderboard'))result=entries;
   else if(path.endsWith('/rpc/quiz_public_registration_count'))result={registered_count:members};
   else if(path==='/auth/v1/recover')result={};
   else if(path==='/auth/v1/user'&&req.method()==='PUT'){
     if(recoveryError){status=401;result={message:'Invalid recovery token'};}
     else result={id:'safe-user',email:'redacted@example.test'};
   }else if(path.endsWith('/rpc/quiz_my_profile'))result={nickname:'測試會員',leaderboard_opt_in:false};
   else if(path.endsWith('/rpc/quiz_set_player_profile'))result={nickname:payload.p_nickname};
   else if(path.endsWith('/rpc/quiz_player_status'))result={wrong_count:0,locked:false,total_attempts:0,correct_attempts:0};
   else if(path.endsWith('/rpc/quiz_answered_question_ids'))result=[];
   else if(path==='/auth/v1/token')result={access_token:'mock-user-token'};
   return route.fulfill({status,contentType:'application/json',headers:h,body:JSON.stringify(result)});
 });
 return calls;
}
test('leaderboard shows exactly top five and full registered member count without emails',async({page})=>{
 const requests=await setup(page);
 await page.goto('/');
 const board=page.locator('.challenge-leaderboard');
 await expect(board).toContainText('註冊人數 7 人｜顯示排行榜前 5 名');
 await expect(board.locator('tbody tr')).toHaveCount(5);
 await expect(board).not.toContainText('redacted@example.test');
 await expect(board).toContainText('戊');
 expect(requests.filter(x=>x.path.endsWith('quiz_public_leaderboard'))).toHaveLength(1);
 expect(requests.filter(x=>x.path.endsWith('quiz_public_registration_count'))).toHaveLength(1);
});
test('all members participate without a public/private checkbox in signup or profile',async({page})=>{
 await setup(page);await page.goto('/');
 await page.locator('#playerSignInBtn').click();
 await page.getByRole('button',{name:'建立新帳號'}).click();
 await expect(page.getByRole('heading',{name:'建立數術挑戰帳號'})).toBeVisible();
 await expect(page.locator('#playerAuthForm input[type=checkbox]')).toHaveCount(0);
 await expect(page.locator('#playerAuthForm')).toContainText('所有註冊會員自動參與前五名');
 await expect(page.locator('#playerAuthForm')).not.toContainText('我同意公開');
});
test('forgot password sends one generic response with exact project redirect, no user disclosure',async({page})=>{
 const calls=await setup(page);await page.goto('/');
 await page.evaluate(()=>{window.quizCaptcha.token=()=> 'mock-captcha';window.quizCaptcha.reset=()=>{};});
 await page.locator('#playerSignInBtn').click();
 await page.getByRole('button',{name:'忘記密碼？'}).click();
 await expect(page.getByRole('heading',{name:'忘記密碼・寄送重設信'})).toBeVisible();
 await page.locator('#playerEmail').fill('member@example.test');
 await page.getByRole('button',{name:'寄送密碼重設信'}).click();
 await expect(page.locator('#playerAuthNotice')).toContainText('若此電子郵件已註冊');
 const sent=calls.filter(x=>x.path==='/auth/v1/recover');
 expect(sent).toHaveLength(1);
 expect(new URL(sent[0].url).searchParams.get('redirect_to')).toBe('https://nortongoh.github.io/divination-monopoly/');
 expect(sent[0].payload).toMatchObject({email:'member@example.test',gotrue_meta_security:{captcha_token:'mock-captcha'}});
 await page.getByRole('button',{name:'寄送密碼重設信'}).click();
 expect(calls.filter(x=>x.path==='/auth/v1/recover')).toHaveLength(1);
});
test('recovery link strips bearer from URL and updates password with recovery token only',async({page})=>{
 const calls=await setup(page);
 await page.goto('/#access_token=mock-recovery-access-token&refresh_token=mock-refresh&type=recovery');
 await expect(page.getByRole('heading',{name:'設定新密碼'})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>location.hash)).toBe('');
 await page.locator('#playerPassword').fill('a-strong-new-password-2026');
 await page.locator('#playerConfirmPassword').fill('a-strong-new-password-2026');
 await page.getByRole('button',{name:'儲存新密碼'}).click();
 await expect(page.locator('#playerAuthNotice')).toContainText('密碼已更新成功');
 await expect(page.getByRole('heading',{name:'數術知識挑戰・帳號登入'})).toBeVisible();
 const update=calls.filter(x=>x.path==='/auth/v1/user'&&x.method==='PUT');
 expect(update).toHaveLength(1);
 expect(update[0].auth).toBe('Bearer mock-recovery-access-token');
 expect(update[0].payload).toEqual({password:'a-strong-new-password-2026'});
 expect(calls.filter(x=>x.path==='/auth/v1/token')).toHaveLength(0);
 await expect(page.locator('#playerPassword')).toHaveValue('');
});
test('expired recovery link is rejected with new-email request, not claimed as success',async({page})=>{
 await setup(page,{recoveryError:true});
 await page.goto('/#access_token=expired-recovery-token&type=recovery');
 await page.locator('#playerPassword').fill('new-test-password-123');
 await page.locator('#playerConfirmPassword').fill('new-test-password-123');
 await page.getByRole('button',{name:'儲存新密碼'}).click();
 await expect(page.locator('#playerAuthNotice')).toContainText('連結已失效或過期');
 await expect(page.getByRole('heading',{name:'忘記密碼・寄送重設信'})).toBeVisible();
});
test('invalid recovery callback never displays password update or leaked token',async({page})=>{
 await setup(page);await page.goto('/#error=access_denied&error_code=otp_expired&error_description=Link+expired');
 await expect(page.getByRole('heading',{name:'忘記密碼・寄送重設信'})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>location.hash)).toBe('');
 await expect(page.locator('#playerAuthNotice')).toContainText('重設連結無效');
});
