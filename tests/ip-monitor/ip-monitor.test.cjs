'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..','..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
test('frontend scripts parse and IP console is installed',()=>{
 new vm.Script(read('traffic-tracker.js'));
 new vm.Script(read('ip-monitor-admin.js'));
 new vm.Script(read('traffic-admin-dashboard.js'));
 assert.match(read('traffic-admin-dashboard.js'),/ip-monitor-admin\.js/);
});
test('browser never submits raw IP or user-entered values',()=>{
 const code=read('traffic-tracker.js');
 assert.match(code,/functions\/v1\/quiz-ip-monitor/);
 assert.match(code,/safeIds/);
 assert.doesNotMatch(code,/localStorage|sessionStorage|navigator\.clipboard|document\.cookie/);
 assert.doesNotMatch(code,/\bclient_ip\b|\bsource_ip\b|\bx-forwarded-for\b/i);
});
test('monitoring endpoints require edge IP and trusted service-role RPC',()=>{
 const monitor=read('supabase/functions/quiz-ip-monitor/index.ts');
 const trial=read('supabase/functions/quiz-guest-trial/index.ts');
 assert.match(monitor,/cf-connecting-ip/);
 assert.doesNotMatch(monitor,/req\.headers\.get\('x-forwarded-for'\)/);
 assert.match(monitor,/quiz_ip_monitor_record/);
 assert.match(trial,/quiz_ip_monitor_record/);
 assert.match(trial,/gate\?\.blocked/);
 assert.match(trial,/respond\(\{error:.*\},403\)/);
});
test('IP audit tables deny browser read and admin RPC checks membership',()=>{
 const schema=read('database/ip-monitor-schema.sql');
 const admin=read('database/ip-monitor-admin.sql');
 const report=read('database/ip-monitor-report.sql');
 const intake=read('database/ip-monitor-intake.sql');
 assert.match(schema,/ENABLE ROW LEVEL SECURITY/);
 assert.match(schema,/REVOKE ALL ON public\.quiz_ip_monitor_events FROM public,anon,authenticated/);
 assert.match(schema,/REVOKE ALL ON public\.quiz_ip_monitor_blocks FROM public,anon,authenticated/);
 assert.match(admin,/quiz_admins/);
 assert.match(report,/quiz_admins/);
 assert.match(admin,/p_action NOT IN \('block','unblock'\)/);
 assert.match(intake,/GRANT EXECUTE ON FUNCTION public\.quiz_ip_monitor_record\(inet,text,text,text,text\)\s+TO service_role/);
 assert.match(report,/threshold_5m_total',80/);
 assert.match(report,/threshold_5m_clicks',40/);
 assert.match(intake,/interval '30 days'/);
});
