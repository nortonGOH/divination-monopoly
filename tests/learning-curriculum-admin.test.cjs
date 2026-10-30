'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const code=fs.readFileSync(path.join(root,'learning-curriculum-admin.js'),'utf8');
const sql=fs.readFileSync(path.join(root,'database/learning-curriculum-admin-editor.sql'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
test('administrator curriculum editor JavaScript parses and is installed',()=>{
 new vm.Script(code);
 assert.match(html,/<script src="\.\/learning-curriculum-admin\.js"><\/script>/);
});
test('editor restricts updates to member-only lessons with a revision precondition',()=>{
 assert.match(code,/access_tier=eq\.member/);
 assert.match(code,/revision=eq\./);
 assert.match(code,/method:'PATCH'/);
 assert.match(code,/adminAccessToken/);
 assert.match(code,/請先完成管理員登入/);
 assert.match(code,/learning-curriculum-admin-updated/);
 assert.doesNotMatch(code,/service_role|secret_key|quiz_questions|replace_quiz_bank|quiz_answer/);
});
test('database script allows changes only to selected content columns',()=>{
 assert.match(sql,/grant update \(lead, points, method, question, caution, sources\)/i);
 assert.match(sql,/exists \(select 1 from public\.quiz_admins/i);
 assert.match(sql,/for update to authenticated/i);
 assert.match(sql,/with check/i);
 assert.match(sql,/new\.revision := old\.revision \+ 1/i);
 assert.doesNotMatch(sql,/grant\s+all\s+on\s+.*learning_curriculum_lessons\s+to\s+authenticated/i);
 assert.doesNotMatch(sql,/security definer/i);
});
