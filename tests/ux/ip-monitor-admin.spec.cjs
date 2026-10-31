const {test,expect}=require('@playwright/test');
const MOCK='https://mock-ip-monitor.supabase.co';
test('admin can inspect anomaly, manually block and unblock IP while guests cannot see reports',async({page})=>{
 const calls=[];
 let blocks=[];
 const snapshot=()=>({
  timezone:'Asia/Taipei',retention_days:30,threshold_5m_total:80,threshold_5m_clicks:40,
  top_ips:[{ip:'203.0.113.42',events24h:95,views24h:54,events5m:85,clicks5m:41,alert:true,
    last_seen:'2026-10-31T03:00:00Z'}],
  blocks, recent:[{ip:'203.0.113.42',occurred_at:'2026-10-31T03:00:00Z',
    kind:'click',page:'home',source:'direct',target:'spinBtn',denied:false}]
 });
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.hostname==='127.0.0.1'){
   if(u.pathname==='/config.js')return route.fulfill({status:200,contentType:'application/javascript',
    body:`window.QUIZ_AUTH_CONFIG={supabaseUrl:'${MOCK}',publishableKey:'mock-public-key',turnstileSiteKey:''};`});
   return route.continue();
  }
  if(u.hostname!=='mock-ip-monitor.supabase.co')return route.abort();
  const h={'access-control-allow-origin':'*','access-control-allow-methods':'POST,GET,OPTIONS',
   'access-control-allow-headers':'*'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:h});
  const endpoint=u.pathname,payload=JSON.parse(req.postData()||'{}');
  calls.push({endpoint,payload,auth:req.headers().authorization||''});
  const reply=(status,obj)=>route.fulfill({status,contentType:'application/json',headers:h,body:JSON.stringify(obj)});
  if(endpoint.endsWith('/rpc/quiz_admin_ip_monitor_report')){
   if(req.headers().authorization!=='Bearer mock-admin-token')return reply(403,{message:'Administrator required'});
   return reply(200,snapshot());
  }
  if(endpoint.endsWith('/rpc/quiz_admin_ip_monitor_action')){
   if(req.headers().authorization!=='Bearer mock-admin-token')return reply(403,{message:'Administrator required'});
   if(payload.p_action==='block')blocks=[{ip:payload.p_ip,reason:payload.p_reason,
     blocked_at:'2026-10-31T03:00:00Z',expires_at:'2026-11-01T03:00:00Z'}];
   else blocks=[];
   return reply(200,{ok:true});
  }
  return reply(200,[]);
 });
 await page.goto('/');
 await expect(page.getByRole('button',{name:'IP 流量監控'})).toBeVisible();
 await page.getByRole('button',{name:'IP 流量監控'}).click();
 expect(calls.some(x=>x.endpoint.endsWith('quiz_admin_ip_monitor_report'))).toBe(false);
 await page.evaluate(()=>{adminAccessToken='mock-admin-token';document.getElementById('bankDialog').showModal();});
 await page.getByRole('button',{name:'IP 流量監控'}).click();
 await expect(page.getByRole('heading',{name:'IP 監控與異常流量警示'})).toBeVisible();
 await expect(page.locator('#ipMonitorDialog')).toContainText('203.0.113.42');
 await expect(page.locator('#ipMonitorDialog')).toContainText('⚠ 頻繁流量');
 await page.getByRole('textbox',{name:'欲鎖定的 IP'}).fill('203.0.113.42');
 await page.getByRole('textbox',{name:'操作原因'}).fill('高頻流量檢查');
 await page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'鎖定 IP'}).click();
 await expect(page.locator('#ipMonitorDialog')).toContainText('高頻流量檢查');
 await expect(page.locator('#ipMonitorDialog').getByRole('button',{name:'解鎖'})).toBeVisible();
 await page.once('dialog',dialog=>dialog.accept());
 await page.locator('#ipMonitorDialog').getByRole('button',{name:'解鎖'}).click();
 await expect(page.locator('#ipMonitorDialog').getByRole('button',{name:'解鎖'})).toHaveCount(0);
 expect(calls.filter(x=>x.endpoint.endsWith('quiz_admin_ip_monitor_action')).map(x=>x.payload.p_action))
   .toEqual(['block','unblock']);
 expect(calls.filter(x=>x.endpoint.includes('quiz_admin_ip_monitor_')).every(x=>x.auth==='Bearer mock-admin-token')).toBe(true);
});
