const {test,expect}=require('@playwright/test');
const MOCK='https://mock-wenchang-cards.supabase.co';
const QUESTION={
 id:'wenchang-test-1',mansion:'角木蛟',category:'天文曆法',
 knowledge_type:'天文曆法',difficulty:'初階',
 prompt:'四象中，北方七宿傳統上歸於何象？',
 options:['青龍','白虎','玄武','朱雀']
};

async function setup(page,{initialCredits=3,revealFails=false,alreadyUnlocked=false,legacyStatus=false}={}) {
 const calls=[],state={credits:initialCredits,earned:initialCredits,spent:0,revealed:false,alreadyUnlocked};
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.hostname==='127.0.0.1'){
   if(url.pathname==='/config.js')return route.fulfill({
    status:200,contentType:'application/javascript',
    body:"window.QUIZ_AUTH_CONFIG={supabaseUrl:'"+MOCK+"',publishableKey:'test-publishable-key-123456789',turnstileSiteKey:''};"
   });
   return route.continue();
  }
  if(url.hostname!=='mock-wenchang-cards.supabase.co')return route.abort();
  const headers={'access-control-allow-origin':'*',
    'access-control-allow-headers':'*','access-control-allow-methods':'POST,GET,OPTIONS'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  const path=url.pathname,payload=JSON.parse(req.postData()||'{}');
  calls.push({path,payload,authorization:req.headers().authorization});
  let result=[],status=200;
  if(path.endsWith('/rpc/quiz_public_question_bank'))result=[QUESTION];
  else if(path==='/functions/v1/quiz-guest-trial')result={used:0,remaining:5,limit:5,locked:false};
  else if(path==='/auth/v1/token')result={access_token:'mock-wenchang-member-token'};
  else if(path.endsWith('/rpc/quiz_my_profile'))result={nickname:'測試玩家'};
  else if(path.endsWith('/rpc/quiz_player_status'))
   result={wrong_count:0,locked:false,total_attempts:state.earned,correct_attempts:state.earned,success_rate:0};
  else if(path.endsWith('/rpc/quiz_answered_question_ids'))result=[];
  else if(path.endsWith('/rpc/quiz_submit_choice')){
   result={accepted:true,correct:false,wrong_count:1,locked:false,total_attempts:1,
    correct_attempts:state.earned,success_rate:0,correct_answer:null,explanation:''};
  }else if(path.endsWith('/rpc/quiz_wenchang_status')){
   result={credits:state.credits,earned:state.earned,spent:state.spent,credit_source:legacyStatus?'legacy_wallet':'correct_answers'};
  }else if(path.endsWith('/rpc/quiz_wenchang_question_access')){
   result={can_reveal_without_points:state.alreadyUnlocked,already_unlocked:state.alreadyUnlocked,administrator_exempt:false};
  }else if(path.endsWith('/rpc/quiz_wenchang_reveal')){
   if(revealFails){status=503;result={message:'mock rescue unavailable'};}
   else{
    const used=!state.revealed&&!state.alreadyUnlocked;
    if(used){state.credits--;state.spent++;}
    state.revealed=true;state.alreadyUnlocked=true;
    result={correct_answer:2,explanation:'此為測試解析：北方七宿屬玄武。',
      used_credit:used,status:{credits:state.credits,earned:state.earned,spent:state.spent}};
   }
  }else if(path.endsWith('/rpc/quiz_learning_dashboard')){
   result={date:'2026-10-30',assigned:0,done:0,mastered:0,recovered:0,days:0,streak:0,
      daily:[],wrong:[]};
  }else if(path.endsWith('/rpc/quiz_public_leaderboard'))result=[];
  else if(path.endsWith('/rpc/quiz_public_registration_count'))result={registered_count:0};
  return route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(result)});
 });
 await page.goto('/');
 await expect.poll(()=>page.evaluate(()=>questionBank.length)).toBe(1);
 await page.evaluate(()=>{window.quizCaptcha.token=()=> 'isolated-mock-captcha';window.quizCaptcha.reset=()=>{};});
 await page.locator('#playerSignInBtn').click();
 await page.locator('#playerEmail').fill('player@example.test');
 await page.locator('#playerPassword').fill('mock-password-123');
 await page.getByRole('button',{name:'登入',exact:true}).click();
 await expect(page.locator('#playerStateText')).toContainText('測試玩家');
 await page.evaluate(()=>{
  const slot=BOARD_SLOTS.findIndex(s=>s.type==='mansion'&&s.mansionIndex===0);
  finishSpin(slot);
  showQuestion(questionBank[0],6);
 });
 await expect(page.locator('.quiz-panel')).toBeVisible();
 await expect(page.locator('#answerOptions button')).toHaveCount(4);
 await page.locator('#answerOptions button').first().click();
 await expect(page.locator('dialog.wenchang-dialog')).toBeVisible();
 await expect(page.locator('.wenchang-card-choice')).toHaveCount(4);
 return {calls,state};
}
const revealCalls=calls=>calls.filter(x=>x.path.endsWith('/rpc/quiz_wenchang_reveal'));

test('all four rescue card types are accessible and free guidance does not debit credits',async({page})=>{
 const {calls,state}=await setup(page);
 await page.locator('[data-card="read"]').click();
 await expect(page.locator('#wenchangCardDetail')).toContainText('北方七宿');
 await expect(page.locator('#wenchangCardDetail')).toContainText('思考方向');
 await page.locator('[data-card="compare"]').click();
 const option=page.locator('.wenchang-compare-option').first();
 await expect(option).toHaveAttribute('aria-pressed','false');
 await option.click();
 await expect(option).toHaveAttribute('aria-pressed','true');
 await option.click();
 await expect(option).toHaveAttribute('aria-pressed','false');
 await page.locator('[data-card="notes"]').click();
 await page.locator('#wenchangReflectionText').fill('先整理四象概念，再查證出處。');
 await page.locator('[data-card="read"]').click();
 await page.locator('[data-card="notes"]').click();
 await expect(page.locator('#wenchangReflectionText')).toHaveValue('先整理四象概念，再查證出處。');
 expect(revealCalls(calls)).toHaveLength(0);
 expect(state.credits).toBe(3);
 await expect(page.locator('#wenchangCardDetail')).not.toContainText('此為測試解析');
});

test('paid reveal requires explicit click and uses only the original authenticated RPC once',async({page})=>{
 const {calls,state}=await setup(page);
 await page.locator('[data-card="reveal"]').click();
 const button=page.locator('#wenchangCardRevealAction');
 await expect(button).toBeEnabled();
 expect(revealCalls(calls)).toHaveLength(0);
 await button.click();
 await expect(page.locator('.wenchang-answer')).toContainText('正確答案：C');
 await expect(page.locator('.wenchang-answer')).toContainText('此為測試解析');
 await expect(button).toBeDisabled();
 expect(revealCalls(calls)).toHaveLength(1);
 expect(revealCalls(calls)[0].authorization).toBe('Bearer mock-wenchang-member-token');
 expect(revealCalls(calls)[0].payload).toEqual({p_question_id:QUESTION.id});
 expect(state.credits).toBe(2);
 await page.locator('[data-card="read"]').click();
 await page.locator('[data-card="reveal"]').click();
 await expect(page.locator('.wenchang-answer')).toContainText('正確答案：C');
 expect(revealCalls(calls)).toHaveLength(1);
});

test('failed server rescue never invents a result and allows a controlled retry',async({page})=>{
 const {calls,state}=await setup(page,{revealFails:true});
 await page.locator('[data-card="reveal"]').click();
 const button=page.locator('#wenchangCardRevealAction');
 await button.click();
 await expect(page.locator('dialog.wenchang-dialog')).toContainText('mock rescue unavailable');
 await expect(button).toBeEnabled();
 await expect(page.locator('.wenchang-answer')).toBeHidden();
 expect(revealCalls(calls)).toHaveLength(1);
 expect(state.credits).toBe(3);
 await button.click();
 await expect.poll(()=>revealCalls(calls).length).toBe(2);
});

test('lack of credits disables paid card but keeps free cards available',async({page})=>{
 const {calls,state}=await setup(page,{initialCredits:0});
 await page.locator('[data-card="reveal"]').click();
 await expect(page.locator('#wenchangCardRevealAction')).toBeDisabled();
 await page.locator('[data-card="read"]').click();
 await expect(page.locator('#wenchangCardDetail')).toContainText('北方七宿');
 expect(revealCalls(calls)).toHaveLength(0);
 expect(state.credits).toBe(0);
});


test('earned point balance appears in the member rescue card, without timed-refill claims',async({page})=>{
 const {calls}=await setup(page,{initialCredits:4});
 const dialog=page.locator('dialog.wenchang-dialog');
 await expect(dialog).toContainText('答對 4 題');
 await expect(dialog).not.toContainText('每兩小時');
 await page.locator('.wenchang-actions button:not(.wenchang-primary)').click();
 await expect(page.locator('#quizQuestionDialog')).toBeVisible();
 await page.locator('#quizQuestionDialogClose').click();
 await expect(page.locator('#quizQuestionDialog')).toBeHidden();
 await page.locator('#wenchangCardAction').click();
 await expect(page.locator('#wenchangCardStatus')).toContainText('答對累積 4 點');
 await expect(page.locator('#wenchangCardStatus')).toContainText('無定時補點');
 expect(calls.some(x=>x.path.endsWith('/rpc/quiz_wenchang_status'))).toBe(true);
});

test('a prior unlock is still free to re-view when zero points remain',async({page})=>{
 const {calls,state}=await setup(page,{initialCredits:0,alreadyUnlocked:true});
 await page.locator('[data-card="reveal"]').click();
 const button=page.locator('#wenchangCardRevealAction');
 await expect(button).toBeEnabled();
 await button.click();
 await expect(page.locator('.wenchang-answer')).toContainText('正確答案：C');
 expect(revealCalls(calls)).toHaveLength(1);
 expect(state.credits).toBe(0);
 expect(state.spent).toBe(0);
});

test('old backend status fails closed rather than advertising obsolete credits',async({page})=>{
 const {calls}=await setup(page,{legacyStatus:true});
 await page.locator('[data-card="reveal"]').click();
 await expect(page.locator('#wenchangCardRevealAction')).toBeDisabled();
 await expect(page.locator('dialog.wenchang-dialog')).toContainText('新文昌點數制度尚未啟用');
 expect(revealCalls(calls)).toHaveLength(0);
});
