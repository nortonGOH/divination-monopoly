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

test('Wenchang rescue cards require signed-in email membership',()=>{
 const cards=read('wenchang-rescue-cards.js');
 const player=read('quiz-challenge-v7.js');
 const sql=read('database/wenchang-email-member-only.sql');
 assert.match(player,/window\.quizEmailMemberSession=\(\)=>Boolean\(playerToken && playerEmail\)/);
 assert.match(cards,/window\.quizEmailMemberSession\?\.\(\) !== true/);
 assert.match(cards,/暱稱與 IP 登記不具救援權限/);
 assert.match(sql,/u\.email_confirmed_at IS NOT NULL/);
 assert.match(sql,/is_anonymous/);
 for(const fn of ['quiz_wenchang_status','quiz_wenchang_question_access','quiz_wenchang_reveal']){
  assert.match(sql,new RegExp('CREATE OR REPLACE FUNCTION public\\.'+fn+'\\('));
 }
 const count=(sql.match(/PERFORM public\.quiz_require_email_member\(\);/g)||[]).length;
 assert.equal(count,3,'All three server RPCs must enforce email membership');
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.quiz_wenchang_reveal\(text\) TO authenticated/);
});
