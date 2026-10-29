const {test,expect}=require('@playwright/test');
const MOCK='https://mock-guest-trial.supabase.co';
function question(i){return {id:'trial-q-'+i,mansion:'角木蛟',category:'二十八宿',
 difficulty:'初階',knowledge_type:'山',prompt:'第 '+i+' 題匿名試玩題目',
 options:['甲','乙','丙','丁'],answer:0,explanation:'不應公開的解析'};}
async function boot(page,{fail=false}={}){
 const state={used:0,answered:new Set(),calls:[],questions:[1,2,3,4,5,6].map(question)};
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.hostname==='127.0.0.1'){
   if(url.pathname==='/config.js')return route.fulfill({status:200,contentType:'application/javascript',
     body:"window.QUIZ_AUTH_CONFIG={supabaseUrl:'"+MOCK+"',publishableKey:'mock-publishable-key-0123456789',turnstileSiteKey:''};"});
   return route.continue();
  }
  if(url.hostname!=='mock-guest-trial.supabase.co')return route.abort();
  const path=url.pathname;
  const h={'access-control-allow-origin':'*','access-control-allow-headers':'*',
    'access-control-allow-methods':'POST,GET,OPTIONS'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:h});
  const data=JSON.parse(req.postData()||'{}');
  state.calls.push({path,data,token:req.headers().authorization});
  const reply=(status,body)=>route.fulfill({status,headers:h,contentType:'application/json',body:JSON.stringify(body)});
  if(path.endsWith('/rpc/quiz_public_question_bank'))
    return reply(200,state.questions.map(({answer,explanation,...q})=>q));
  if(path.endsWith('/functions/v1/quiz-guest-trial')){
   if(fail)return reply(503,{error:'無法確認訪客 IP'});
   if(data.action==='status')return reply(200,{used:state.used,remaining:5-state.used,limit:5,locked:state.used>=5});
   if(data.action==='answer'){
    if(state.used>=5)return reply(200,{accepted:false,reason:'limit_reached',used:state.used,remaining:0,limit:5,locked:true});
    if(state.answered.has(data.question_id))
      return reply(200,{accepted:false,reason:'already_answered',used:state.used,remaining:5-state.used,limit:5,locked:false});
    const q=state.questions.find(item=>item.id===data.question_id);
    if(!q)return reply(400,{error:'invalid question'});
    state.answered.add(data.question_id);state.used++;
    return reply(200,{accepted:true,correct:data.answer_index===q.answer,used:state.used,remaining:5-state.used,limit:5,locked:state.used>=5});
   }
  }
  if(path.endsWith('/rpc/quiz_wenchang_status'))return reply(200,{credits:3,next_grant_at:null});
  return reply(200,[]);
 });
 await page.goto('/');
 if(!fail)await expect(page.locator('#trialBanner')).toContainText('剩餘 5 次');
 return state;
}
test('five anonymous graded answers permanently exhaust IP quota after reload; no answer leaks',async({page})=>{
 const state=await boot(page);
 await expect(page.locator('#spinBtn')).toBeEnabled();
 await expect(page.locator('#wenchangCard')).toBeVisible();
 await expect(page.locator('#wenchangCardStatus')).toContainText('訪客試玩不消耗');
 for(let i=1;i<=5;i++){
  await page.evaluate(id=>showQuestion(questionBank.find(q=>q.id===id),6),'trial-q-'+i);
  await page.locator('#answerOptions button').nth(i===1?0:1).click();
  await expect(page.locator('#trialBanner')).toContainText('已答 '+i+'／5');
  expect(state.used).toBe(i);
  if(i===2)await expect(page.locator('#answerFeedback')).not.toContainText('不應公開的解析');
 }
 await expect(page.locator('#trialBanner')).toHaveAttribute('data-state','locked');
 await expect(page.locator('#spinBtn')).toBeDisabled();
 await page.reload();
 await expect(page.locator('#trialBanner')).toContainText('5／5');
 await expect(page.locator('#spinBtn')).toBeDisabled();
 expect(state.used).toBe(5);
 expect(state.calls.filter(x=>x.path.endsWith('/functions/v1/quiz-guest-trial')&&x.data.action==='answer')).toHaveLength(5);
 expect(state.calls.filter(x=>x.path.includes('quiz_wenchang_reveal'))).toHaveLength(0);
 expect(state.calls.filter(x=>x.path==='/rest/v1/quiz_questions')).toHaveLength(0);
});
test('failed trial status blocks all anonymous gameplay instead of inventing quota',async({page})=>{
 const state=await boot(page,{fail:true});
 await expect(page.locator('#trialBanner')).toHaveAttribute('data-state','error');
 await expect(page.locator('#trialBanner')).toContainText('無法確認訪客 IP');
 await expect(page.locator('#spinBtn')).toBeDisabled();
 expect(state.used).toBe(0);
});
test('Wenchang rescue card shows member balance and guest signup entry',async({page})=>{
 const state=await boot(page);
 await page.locator('#wenchangCardAction').click();
 await expect(page.getByRole('heading',{name:'數術知識挑戰・帳號登入'})).toBeVisible();
 await page.getByRole('button',{name:'關閉',exact:true}).click();
 await page.evaluate(()=>{
   window.quizMemberToken=()=> 'mock-member';
   window.dispatchEvent(new Event('quiz-member-session-changed'));
 });
 await expect(page.locator('#wenchangCardAction')).toContainText('查看救援餘額');
 await page.locator('#wenchangCardAction').click();
 await expect(page.locator('#wenchangCardStatus')).toContainText('可用救援 3／10 點');
 const calls=state.calls.filter(x=>x.path.endsWith('/rpc/quiz_wenchang_status'));
 expect(calls).toHaveLength(1);
 expect(calls[0].token).toBe('Bearer mock-member');
});
