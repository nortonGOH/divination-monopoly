'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const sql=fs.readFileSync(path.join(root,'database/wenchang-signup-five-credits.sql'),'utf8');
const app=fs.readFileSync(path.join(root,'quiz-challenge-v7.js'),'utf8');
const card=fs.readFileSync(path.join(root,'trial-wenchang-card.js'),'utf8');
test('welcome grant comes only from authenticated registration trigger and never backfills',()=>{
 assert.match(sql,/after insert on auth\.users/i);
 assert.match(sql,/new\.is_anonymous is false and new\.email is not null/i);
 assert.match(sql,/values\(new\.id,5\) on conflict\(user_id\) do nothing/i);
 assert.match(sql,/points integer not null default 5 check \(points=5\)/i);
 assert.doesNotMatch(sql,/insert into public\.quiz_wenchang_signup_grants\s*select/i);
 assert.match(sql,/revoke all on public\.quiz_wenchang_signup_grants from public,anon,authenticated/i);
});
test('the bonus applies to both status and paid reveal, but not former refill wallet',()=>{
 assert.match(sql,/v_bonus\+v_earned-v_spent/i);
 assert.match(sql,/v_row\.correct_attempts\+v_bonus<=v_spent/i);
 assert.match(sql,/'signup_bonus',v_bonus/i);
 assert.match(sql,/'credit_source','correct_answers'/i);
 assert.doesNotMatch(sql,/quiz_wenchang_wallet|last_refill_at|interval '2 hours'/i);
});
test('UI communicates welcome points with no unsafe browser credit mutation',()=>{
 assert.match(app,/新註冊會員一次獲贈 5 點/);
 assert.match(app,/status\.signup_bonus/);
 assert.match(card,/註冊贈送/);
 assert.doesNotMatch(card,/insert into|update public\.quiz_wenchang/i);
});
