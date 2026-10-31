'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const sql=fs.readFileSync(path.join(root,'database/admin-traffic-analytics.sql'),'utf8');
const tracker=fs.readFileSync(path.join(root,'traffic-tracker.js'),'utf8');
const dashboard=fs.readFileSync(path.join(root,'traffic-admin-dashboard.js'),'utf8');
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
const atlas=fs.readFileSync(path.join(root,'mansions-atlas.html'),'utf8');
test('scripts parse and are installed on both pages',()=>{
 new vm.Script(tracker);new vm.Script(dashboard);
 assert.match(home,/src="\.\/traffic-tracker\.js"/);
 assert.match(home,/src="\.\/traffic-admin-dashboard\.js"/);
 assert.match(atlas,/src="\.\/traffic-tracker\.js"/);
});
test('visitor tracker counts without identity or raw referrer capture',()=>{
 assert.match(tracker,/quiz-ip-monitor/);
 assert.match(tracker,/kind,page,source,target/);
 const edge=fs.readFileSync(path.join(root,'supabase/functions/quiz-ip-monitor/index.ts'),'utf8');
 assert.match(edge,/quiz_track_page_view/);
 assert.match(edge,/p_page:page,p_source:source/);
 assert.doesNotMatch(tracker,/localStorage|sessionStorage|cookie|fingerprint|email|user_id|visitor_id|ip_address|document\.referrer\s*:/i);
 assert.doesNotMatch(tracker,/Authorization:\s*['"]Bearer/);
});
test('admin report access checked by server; traffic data stores only aggregate dimensions',()=>{
 assert.match(sql,/create table if not exists public\.quiz_traffic_daily/);
 assert.match(sql,/primary key \(visit_day,source,page\)/);
 assert.match(sql,/enable row level security/i);
 assert.match(sql,/revoke all on public\.quiz_traffic_daily from public,anon,authenticated/i);
 assert.match(sql,/quiz_admins/);
 assert.match(sql,/grant execute on function public\.quiz_admin_traffic_report\(\) to authenticated/);
 assert.doesNotMatch(sql,/ip_address|visitor_id|user_id\s+uuid|referrer_url|email\s+text/i);
 assert.match(dashboard,/quiz_admin_traffic_report/);
 assert.match(dashboard,/daily.*weekly.*monthly/);
});
