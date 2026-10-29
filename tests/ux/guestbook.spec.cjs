const {test,expect}=require('@playwright/test');
const BASE='https://mock-guestbook.supabase.co';
const start=()=>[
 {id:'message-a',nickname:'學習者甲',body:'第一則測試心得',created_at:'2026-10-29T02:00:00Z',updated_at:'2026-10-29T02:00:00Z',author:'member-a',awarded_points:null},
 {id:'message-b',nickname:'學習者乙',body:'<img src=x onerror=alert(1)>',created_at:'2026-10-29T01:00:00Z',updated_at:'2026-10-29T01:00:00Z',author:'member-b',awarded_points:null}
];
async function boot(page){
 const messages=start(),calls=[],wallet={a:3,b:3};
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.hostname==='127.0.0.1'){
   if(u.pathname==='/config.js')return route.fulfill({status:200,contentType:'application/javascript',
     body:"window.QUIZ_AUTH_CONFIG={supabaseUrl:'"+BASE+"',publishableKey:'mock-public-key-123456789',turnstileSiteKey:''};"});
   return route.continue();
  }
  if(u.hostname!=='mock-guestbook.supabase.co')return route.abort();
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*',
    'access-control-allow-methods':'POST,GET,OPTIONS'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers,body:''});
  const path=u.pathname,token=(req.headers().authorization||'').replace('Bearer ','');
  const p=JSON.parse(req.postData()||'{}');
  calls.push({path,token,p});
  const send=(status,data)=>route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(data)});
  if(path.endsWith('/rpc/quiz_guestbook_list')){
   return send(200,messages.filter(x=>!x.deleted).map(({author,...m})=>({...m,is_owner:author===token})));
  }
  if(path.endsWith('/rpc/quiz_guestbook_save')){
   if(!['member-a','member-b'].includes(token))return send(403,{message:'請先登入'});
   if(p.p_id){
    const row=messages.find(x=>x.id===p.p_id&&!x.deleted);
    if(!row||row.author!==token)return send(403,{message:'只能修改自己的留言'});
    row.body=p.p_body;row.updated_at='2026-10-29T03:00:00Z';
    return send(200,{id:row.id,saved:true});
   }
   const row={id:'new-'+messages.length,author:token,nickname:'會員',
    body:p.p_body,created_at:'2026-10-29T04:00:00Z',updated_at:'2026-10-29T04:00:00Z',awarded_points:null};
   messages.unshift(row);return send(200,{id:row.id,saved:true});
  }
  if(path.endsWith('/rpc/quiz_guestbook_delete')){
   const row=messages.find(x=>x.id===p.p_id&&!x.deleted);
   if(!row||!(row.author===token||token==='admin-token'))return send(403,{message:'不能刪除別人的留言'});
   row.deleted=true;return send(200,{deleted:true});
  }
  if(path.endsWith('/rpc/quiz_guestbook_grant_wenchang')){
   const row=messages.find(x=>x.id===p.p_id&&!x.deleted);
   if(token!=='admin-token')return send(403,{message:'只有管理員可以贈點'});
   if(!row||row.awarded_points)return send(409,{message:'不能重複贈送'});
   if(wallet.b+p.p_amount>10)return send(400,{message:'餘額上限'});
   row.awarded_points=p.p_amount;wallet.b+=p.p_amount;
   return send(200,{success:true,granted_points:p.p_amount,wallet_after:wallet.b});
  }
  return send(200,[]);
 });
 await page.goto('/');
 await expect(page.locator('.guestbook-item')).toHaveCount(2);
 return {messages,calls,wallet};
}
async function asMember(page,token){
 await page.evaluate(value=>{window.quizMemberToken=()=>value;
  window.dispatchEvent(new Event('quiz-member-session-changed'));},token);
 await expect(page.locator('#guestbookSubmit')).toBeEnabled();
}
async function asAdmin(page){
 await page.evaluate(()=>{adminAccessToken='admin-token';
  window.dispatchEvent(new Event('quiz-admin-session-changed'));});
 await expect(page.getByRole('button',{name:'管理員贈點'})).toHaveCount(2);
}
test('anonymous reads sanitized public messages, cannot post or modify',async({page})=>{
 const state=await boot(page);
 await expect(page.locator('#guestbookSubmit')).toBeDisabled();
 await expect(page.getByRole('button',{name:'修改我的留言'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'管理員贈點'})).toHaveCount(0);
 await expect(page.locator('.guestbook-item-content').nth(1)).toHaveText('<img src=x onerror=alert(1)>');
 await expect(page.locator('.guestbook-item img')).toHaveCount(0);
 expect(state.calls.some(q=>q.path.endsWith('/rpc/quiz_guestbook_save'))).toBe(false);
});
test('member can post, edit and delete only their own messages',async({page})=>{
 const state=await boot(page);await asMember(page,'member-a');
 await expect(page.getByRole('button',{name:'修改我的留言'})).toHaveCount(1);
 await expect(page.getByRole('button',{name:'刪除我的留言'})).toHaveCount(1);
 await page.locator('#guestbookBody').fill('新發表的測試留言');
 await page.locator('#guestbookSubmit').click();
 await expect(page.getByText('新發表的測試留言',{exact:true})).toBeVisible();
 const owned=page.locator('.guestbook-item[data-message-id="message-a"]');
 await owned.getByRole('button',{name:'修改我的留言'}).click();
 await expect(page.locator('#guestbookBody')).toHaveValue('第一則測試心得');
 await page.locator('#guestbookBody').fill('更新自己的留言');
 await page.locator('#guestbookSubmit').click();
 await expect(owned.getByText('更新自己的留言',{exact:true})).toBeVisible();
 page.once('dialog',dlg=>dlg.accept());
 await owned.getByRole('button',{name:'刪除我的留言'}).click();
 await expect(owned).toHaveCount(0);
 expect(state.messages.find(x=>x.id==='message-b').deleted).not.toBe(true);
 expect(state.calls.filter(x=>/quiz_guestbook_save|quiz_guestbook_delete/.test(x.path)).every(x=>x.token==='member-a')).toBe(true);
});
test('unprivileged users cannot edit or delete another member even with crafted RPC',async({page})=>{
 const state=await boot(page);await asMember(page,'member-a');
 const result=await page.evaluate(async()=> {
  const url='https://mock-guestbook.supabase.co/rest/v1/rpc/quiz_guestbook_delete';
  const r=await fetch(url,{method:'POST',headers:{apikey:'mock-public-key-123456789','Content-Type':'application/json',Authorization:'Bearer member-a'},body:JSON.stringify({p_id:'message-b'})});
  return {status:r.status,body:await r.json()};
 });
 expect(result.status).toBe(403);
 expect(result.body.message).toContain('不能刪除');
 expect(state.messages.find(x=>x.id==='message-b').deleted).not.toBe(true);
});
test('only administrator has delete and discretionary grant controls, cannot grant twice',async({page})=>{
 const state=await boot(page);await asAdmin(page);
 const b=page.locator('.guestbook-item[data-message-id="message-b"]');
 await b.getByRole('combobox',{name:'贈送文昌星救援點數'}).selectOption('2');
 page.once('dialog',dlg=>dlg.accept());
 await b.getByRole('button',{name:'管理員贈點'}).click();
 await expect(b).toContainText('已獲管理員贈送文昌星救援 2 點');
 await expect(b.getByRole('button',{name:'管理員贈點'})).toHaveCount(0);
 expect(state.wallet.b).toBe(5);
 const grants=state.calls.filter(x=>x.path.endsWith('/rpc/quiz_guestbook_grant_wenchang'));
 expect(grants).toHaveLength(1);
 expect(grants[0]).toMatchObject({token:'admin-token',p:{p_id:'message-b',p_amount:2}});
 page.once('dialog',dlg=>dlg.accept());
 await b.getByRole('button',{name:'管理員刪除'}).click();
 await expect(b).toHaveCount(0);
 expect(state.wallet.b).toBe(5);
});
test('mobile guestbook width and touch targets fit',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 await boot(page);
 const dimension=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 expect(dimension.scroll).toBeLessThanOrEqual(dimension.client+2);
 const btn=await page.locator('#guestbookRefresh').boundingBox();
 expect(btn.height).toBeGreaterThanOrEqual(44);
});
