const {test,expect}=require('@playwright/test');
const MOCK='https://mock-ip-observation.supabase.co';
test('administrator can view source IP anomaly without any IP restriction controls',async({page})=>{
 const calls=[];
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.hostname==='127.0.0.1'){
   if(url.pathname==='/config.js')return route.fulfill({status:200,contentType:'application/javascript',
    body:`window.QUIZ_AUTH_CONFIG={supabaseUrl:'${MOCK}',publishableKey:'test-public-key',turnstileSiteKey:''};`});
   return route.continue();
  }
  if(url.hostname!=='mock-ip-observation.supabase.co')return route.abort();
  const h={'access-control-allow-origin':'*','access-control-allow-methods':'POST,GET,OPTIONS','access-control-allow-headers':'*'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:h});
  const endpoint=url.pathname;
  calls.push({endpoint,authorization:req.headers().authorization||''});
  const reply=(status,body)=>route.fulfill({status,contentType:'application/json',headers:h,body:JSON.stringify(body)});
  if(endpoint.endsWith('/rpc/quiz_admin_ip_monitor_report')){
   if(req.headers().authorization!=='Bearer test-admin-token')return reply(403,{message:'Administrator required'});
   return reply(200,{timezone:'Asia/Taipei',retention_days:30,threshold_5m_total:80,threshold_5m_clicks:40,
    top_ips:[{ip:'203.0.113.42',events24h:95,views24h:54,events5m:85,clicks5m:41,alert:true}],
    recent:[{occurred_at:'2026-10-31T03:00:00Z',ip:'203.0.113.42',kind:'click',page:'home',target:'spinBtn'}]});
  }
  return reply(200,[]);
 });
 await page.goto('/');
 await page.evaluate(()=>document.getElementById('bankDialog').showModal());
 await expect(page.getByRole('button',{name:'IP 流量觀測'})).toBeVisible();
 await page.getByRole('button',{name:'IP 流量觀測'}).click();
 expect(calls.some(x=>x.endpoint.endsWith('/rpc/quiz_admin_ip_monitor_report'))).toBe(false);
 await page.evaluate(()=>{adminAccessToken='test-admin-token'});
 await page.getByRole('button',{name:'IP 流量觀測'}).click();
 const dialog=page.locator('#ipMonitorDialog');
 await expect(dialog.getByRole('heading',{name:'IP 來源流量與異常警示'})).toBeVisible();
 await expect(dialog).toContainText('203.0.113.42');
 await expect(dialog).toContainText('⚠ 頻繁流量');
 await expect(dialog.getByRole('button',{name:'鎖定'})).toHaveCount(0);
 await expect(dialog.getByRole('button',{name:'解鎖'})).toHaveCount(0);
 expect(calls.filter(x=>x.endpoint.includes('quiz_admin_ip_monitor_action'))).toHaveLength(0);
 expect(calls.filter(x=>x.endpoint.endsWith('quiz_admin_ip_monitor_report')).every(x=>x.authorization==='Bearer test-admin-token')).toBe(true);
});
