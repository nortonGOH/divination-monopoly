const {test,expect}=require('@playwright/test');
const MOCK='https://mock-nickname-trial.supabase.co';
const questions=[1,2,3,4,5,6].map(i=>({
 id:'beginner-q-'+i,mansion:'角木蛟',category:'二十八宿',difficulty:'初階',
 knowledge_type:'山',prompt:'初階暱稱題目 '+i,options:['甲','乙','丙','丁'],
 answer:0,explanation:'僅會員救援後才顯示的解析'
}));
async function boot(page){
 const state={calls:[],used:0,correct:0,answered:new Set(),name:''};
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.hostname==='127.0.0.1'){
   if(u.pathname==='/config.js')return route.fulfill({status:200,contentType:'application/javascript',
    body:`window.QUIZ_AUTH_CONFIG={supabaseUrl:'${MOCK}',publishableKey:'mock-public-key',turnstileSiteKey:''};`});
   return route.continue();
  }
  if(u.hostname!=='mock-nickname-trial.supabase.co')return route.abort();
  const headers={'access-control-allow-origin':'*',
   'access-control-allow-headers':'*','access-control-allow-methods':'POST,GET,OPTIONS'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  const path=u.pathname;let data={};
  try{data=JSON.parse(req.postData()||'{}')}catch(_){}
  state.calls.push({path,data,authorization:req.headers().authorization});
  const reply=(status,payload)=>route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(payload)});
  if(path.endsWith('/rpc/quiz_public_question_bank'))
   return reply(200,questions.map(({answer,explanation,...q})=>q));
  if(path.endsWith('/functions/v1/quiz-nickname-beginner')){
   if(data.action==='join'){state.name=data.nickname;return reply(200,{accepted:true,nickname:state.name,total_attempts:state.used,correct_attempts:state.correct});}
   if(data.action==='status')return reply(200,{accepted:true,nickname:state.name,total_attempts:state.used,correct_attempts:state.correct});
   if(data.action==='answer'){
    const q=questions.find(q=>q.id===data.question_id);
    if(!q||q.difficulty!=='初階')return reply(403,{error:'中、高階須註冊會員'});
    if(state.answered.has(q.id))return reply(200,{accepted:false,reason:'already_answered',nickname:state.name,total_attempts:state.used,correct_attempts:state.correct});
    state.answered.add(q.id);state.used++;if(q.answer===data.answer_index)state.correct++;
    return reply(200,{accepted:true,correct:q.answer===data.answer_index,nickname:state.name,total_attempts:state.used,correct_attempts:state.correct});
   }
  }
  if(path.endsWith('/functions/v1/quiz-guest-trial'))return reply(403,{error:'舊訪客答題已停用'});
  if(path.endsWith('/rpc/quiz_wenchang_status'))return reply(200,{credits:3,earned:3,spent:0,credit_source:'correct_answers'});
  return reply(200,[]);
 });
 await page.goto('/');
 return state;
}
test('anonymous must enter nickname; beginner records server score without old IP trial quota',async({page})=>{
 const state=await boot(page);
 const banner=page.locator('#trialBanner');
 await expect(banner).toContainText('請輸入暱稱');
 await expect(page.locator('#spinBtn')).toBeDisabled();
 await page.locator('#nicknameBeginnerInput').fill('試玩者甲');
 await page.getByRole('button',{name:'用暱稱挑戰初階'}).click();
 await expect(page.locator('#nicknameBeginnerStatus')).toContainText('暱稱 試玩者甲');
 await expect(page.locator('#spinBtn')).toBeEnabled();
 await expect(banner).toContainText('暱稱挑戰');
 for(let i=1;i<=6;i++){
  await page.evaluate(()=>{
   const slot=BOARD_SLOTS.findIndex(c=>c.type==='mansion'&&c.mansionIndex===0);
   finishSpin(slot);
  });
  await page.evaluate(id=>showQuestion(questionBank.find(q=>q.id===id),6),'beginner-q-'+i);
  await page.locator('#answerOptions button').first().click();
  await expect(page.locator('#answerFeedback')).toContainText('已計入暱稱排行榜');
  await expect(page.locator('#nicknameBeginnerStatus')).toContainText('答對 '+i+'／'+i+' 題');
 }
 expect(state.used).toBe(6);
 expect(state.calls.filter(c=>c.path.endsWith('/functions/v1/quiz-nickname-beginner')&&c.data.action==='answer')).toHaveLength(6);
 expect(state.calls.filter(c=>c.path.endsWith('/functions/v1/quiz-guest-trial')&&c.data.action==='answer')).toHaveLength(0);
 expect(state.calls.filter(c=>c.path.includes('quiz_wenchang_reveal'))).toHaveLength(0);
 expect(state.calls.filter(c=>c.path==='/rest/v1/quiz_questions')).toHaveLength(0);
 await page.reload();
 await expect(page.locator('#nicknameBeginnerStatus')).toContainText('答對 6／6 題');
 await expect(page.locator('#spinBtn')).toBeEnabled();
});
test('Wenchang remains reserved for registered members',async({page})=>{
 const state=await boot(page);
 await expect(page.locator('#wenchangCard')).toBeVisible();
 await expect(page.locator('#wenchangCardStatus')).toContainText('訪客試玩不累積');
 await page.locator('#wenchangCardAction').click();
 await expect(page.getByRole('heading',{name:'數術知識挑戰・帳號登入'})).toBeVisible();
 await page.getByRole('button',{name:'關閉',exact:true}).click();
 await page.evaluate(()=>{
   window.quizMemberToken=()=> 'mock-member';
   window.dispatchEvent(new Event('quiz-member-session-changed'));
 });
 await expect(page.locator('#wenchangCardAction')).toContainText('查看救援餘額');
 await page.locator('#wenchangCardAction').click();
 await expect(page.locator('#wenchangCardStatus')).toContainText('可用 3 點｜答對累積 3 點');
 const calls=state.calls.filter(c=>c.path.endsWith('/rpc/quiz_wenchang_status'));
 expect(calls).toHaveLength(1);
 expect(calls[0].authorization).toBe('Bearer mock-member');
});
