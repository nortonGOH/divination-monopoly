const { test, expect } = require('@playwright/test');
const MOCK_URL='https://mock-open-qa.supabase.co';
const question={id:'isolated-open-001',source_question_no:1,difficulty:'初階',category:'命',mansion:'角木蛟',prompt:'隔離測試題目：請說明測試原則',source_title:'虛構測試資料',source_url:'',review_status:'待考'};
const answer='僅供 Mock 測試的參考答案，絕非正式題庫資料';
async function setup(page,{mode='anon',locked=false}={}){
 const seen=[];
 await page.route('**/config.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:`window.QUIZ_AUTH_CONFIG={supabaseUrl:'${MOCK_URL}',publishableKey:'mock-public-key-0123456789'};`}));
 await page.route('**/quiz-challenge-v7.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:`window.quizRevealOpenAnswer=async(id)=>{const r=await fetch('${MOCK_URL}/rest/v1/rpc/quiz_reveal_open_answer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_question_id:id})});const j=await r.json();if(!r.ok)throw Error(j.message);return j;};`}));
 await page.route('**/rest/v1/**',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname;
  seen.push({path,method:req.method(),url:req.url(),body:req.postData()});
  const json=(status,data)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(path.endsWith('/rpc/quiz_public_question_bank'))return json(200,[]);
  if(path.endsWith('/quiz_open_questions') && req.method()==='GET'){
    const select=url.searchParams.get('select')||'';
    if(select.includes('reference_answer')||select==='*')return json(403,{message:'Answer selection forbidden'});
    return json(200,[question]);
  }
  if(path.endsWith('/rpc/quiz_admin_open_question_bank'))
    return mode==='admin'?json(200,[{...question,reference_answer:answer}]):json(403,{message:'Admin required'});
  if(path.endsWith('/rpc/quiz_reveal_open_answer'))
    return mode==='anon'?json(401,{message:'Please log in'}):locked?json(403,{message:'Challenge locked'}):json(200,{reference_answer:answer});
  if(path.endsWith('/quiz_open_questions')&&req.method()==='POST')
    return mode==='admin'?json(204,{}):json(403,{message:'Admin required'});
  return json(200,[]);
 });
 await page.route('**/auth/v1/**',route=>route.fulfill({status:401,contentType:'application/json',body:'{"message":"No test session"}'}));
 await page.goto('/');
 await expect(page.locator('#quizDifficulty')).toBeVisible();
 await expect(page.locator('#questionText')).toContainText(question.prompt);
 return seen;
}
test('anonymous sees question without answer in public API, reveal denied',async({page})=>{
 const seen=await setup(page);
 const publicReq=seen.find(x=>x.path.endsWith('/quiz_open_questions')&&x.method==='GET');
 expect(publicReq).toBeTruthy();
 expect(new URL(publicReq.url).searchParams.get('select')).not.toContain('reference_answer');
 await expect(page.getByText(answer)).toHaveCount(0);
 await page.getByRole('button',{name:'顯示參考答案'}).click();
 await expect(page.locator('#answerFeedback')).toContainText('Please log in');
 expect(seen.some(x=>x.path.endsWith('/rpc/quiz_reveal_open_answer'))).toBeTruthy();
});
test('member reveals answer only on explicit click',async({page})=>{
 const seen=await setup(page,{mode:'member'});
 expect(seen.some(x=>x.path.endsWith('/rpc/quiz_reveal_open_answer'))).toBeFalsy();
 await page.getByRole('button',{name:'顯示參考答案'}).click();
 await expect(page.getByText(/僅供 Mock 測試的參考答案/)).toBeVisible();
 const req=seen.find(x=>x.path.endsWith('/rpc/quiz_reveal_open_answer'));
 expect(JSON.parse(req.body)).toEqual({p_question_id:question.id});
});
test('locked member cannot reveal answer',async({page})=>{
 await setup(page,{mode:'member',locked:true});
 await page.getByRole('button',{name:'顯示參考答案'}).click();
 await expect(page.locator('#answerFeedback')).toContainText('Challenge locked');
 await expect(page.getByText(answer)).toHaveCount(0);
});
test('admin loads answer via privileged RPC and uses isolated upsert only',async({page})=>{
 const seen=await setup(page,{mode:'admin'});
 await page.evaluate(()=>{adminAccessToken='mock-admin-token';return window.quizRefreshOpenBank();});
 await expect.poll(()=>seen.filter(x=>x.path.endsWith('/rpc/quiz_admin_open_question_bank')).length).toBeGreaterThan(0);
 const rows=await page.evaluate(()=>window.quizGetOpenQuestions());
 expect(rows[0].reference_answer).toBe(answer);
 // Mocked write: never reaches any Supabase project, only the local route.
 const write=await page.evaluate(async()=>cloudCall('/rest/v1/quiz_open_questions?on_conflict=id',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify([{...window.quizGetOpenQuestions()[0],reference_answer:'已修改的隔離答案'}])},true));
 const request=seen.find(x=>x.path.endsWith('/quiz_open_questions')&&x.method==='POST');
 expect(request).toBeTruthy();
 expect(request.url.startsWith(MOCK_URL)).toBe(true);
 expect(JSON.parse(request.body)[0].reference_answer).toBe('已修改的隔離答案');
});
