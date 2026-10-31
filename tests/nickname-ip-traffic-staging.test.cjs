'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
test('registration admin script parses and is loaded from the traffic admin module',()=>{
 new vm.Script(read('registration-mode-admin.js'));
 assert.match(read('traffic-admin-dashboard.js'),/registration-mode-admin\.js/);
});
test('registration mode is administrator-editable, starts enabled, and cannot be silently called a server block',()=>{
 const sql=read('database/nickname-ip-registration-traffic.sql');
 assert.match(sql,/email_signup_enabled boolean NOT NULL DEFAULT true/i);
 assert.match(sql,/quiz_admin_set_registration_mode/);
 assert.match(sql,/quiz_admins/);
 assert.match(sql,/REVOKE ALL ON public\.quiz_registration_mode FROM public,anon,authenticated/i);
 assert.match(read('registration-mode-admin.js'),/Supabase Authentication/);
 assert.match(read('docs/nickname-ip-traffic-rollout.md'),/尚未封鎖 Auth signup API/);
});
test('raw IP table has no direct visitor read permission',()=>{
 const sql=read('database/ip-traffic-events.sql');
 assert.match(sql,/source_ip inet NOT NULL/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/i);
 assert.match(sql,/REVOKE ALL ON public\.quiz_traffic_ip_events FROM PUBLIC, anon, authenticated/i);
});
