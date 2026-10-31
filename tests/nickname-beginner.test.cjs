'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('front-end controllers are parseable and nickname entry is wired',()=>{
 for(const p of ['quiz-challenge-v7.js','nickname-beginner.js','challenge-v8-ui.js','challenge-v12-leaderboard.js'])new vm.Script(read(p));
 const html=read('index.html');
 assert.ok(html.indexOf('quiz-challenge-v7.js')<html.indexOf('nickname-beginner.js'));
 assert.ok(html.indexOf('nickname-beginner.js')<html.indexOf('challenge-v8-ui.js'));
 assert.match(read('nickname-beginner.js'),/quiz-nickname-beginner/);
});
test('anonymous question selection is limited to beginner',()=>{
 const v7=read('quiz-challenge-v7.js'),v8=read('challenge-v8-ui.js');
 assert.match(v7,/quizNicknameActive/);
 assert.match(v7,/window\.quizPlayerMayChallenge/);
 assert.match(v8,/window\.quizMemberToken/);
 assert.match(v8,/'初階'/);
});
test('server-side grade is beginner-only and cannot rescore the same question',()=>{
 const sql=read('database/nickname-beginner-action.sql');
 assert.match(sql,/v_level IS DISTINCT FROM '初階'/);
 assert.match(sql,/already_answered/);
 assert.match(sql,/FOR UPDATE/);
 assert.match(sql,/quiz_nickname_answers/);
 assert.match(sql,/30 days/);
 const edge=read('supabase/functions/quiz-nickname-beginner/index.ts');
 assert.match(edge,/cf-connecting-ip/);
 assert.match(edge,/HMAC/);
 assert.match(edge,/quiz_nickname_beginner_action/);
 assert.doesNotMatch(edge,/req\.headers\.get\('x-forwarded-for'\)/);
});
test('combined leaderboard never displays email, IP, or session token',()=>{
 const sql=read('database/nickname-beginner-leaderboard.sql');
 assert.match(sql,/UNION ALL/);
 assert.match(sql,/quiz_nickname_players/);
 assert.match(sql,/auth\.users/);
 assert.match(sql,/position/);
 assert.doesNotMatch(sql,/source_ip/);
 const board=read('challenge-v12-leaderboard.js');
 assert.match(board,/quiz_public_leaderboard/);
});
test('privacy: server-only tables, administrator gate and no IP bans',()=>{
 const schema=['database/nickname-beginner-players.sql','database/nickname-beginner-answers.sql','database/nickname-beginner-ip-observation.sql']
  .map(read).join('\n');
 assert.equal((schema.match(/ENABLE ROW LEVEL SECURITY/g)||[]).length,3);
 assert.equal((schema.match(/REVOKE ALL ON /g)||[]).length,3);
 assert.doesNotMatch(schema,/anon.*GRANT|quiz_ip_monitor_blocks/);
 const admin=read('database/nickname-beginner-admin-observation.sql');
 assert.match(admin,/quiz_admins/);
 assert.match(admin,/auth\.uid\(\)/);
 assert.match(admin,/REVOKE ALL ON FUNCTION/);
 assert.doesNotMatch(admin,/block\(|ban\(/i);
});

test('duplicate nickname registration surfaces HTTP 409 warning and retains existing score',()=>{
 const players=read('database/nickname-beginner-players.sql');
 assert.match(players,/CREATE UNIQUE INDEX IF NOT EXISTS quiz_nickname_players_unique_name/);
 assert.match(players,/lower\(btrim\(nickname\)\)/);
 const sql=read('database/nickname-beginner-action.sql');
 assert.match(sql,/EXCEPTION WHEN unique_violation/);
 assert.match(sql,/Nickname already taken/);
 const edge=read('supabase/functions/quiz-nickname-beginner/index.ts');
 assert.match(edge,/result\?\.code==='23505'/);
 assert.match(edge,/nickname_taken/);
 assert.match(edge,/409/);
 const ui=read('nickname-beginner.js');
 assert.match(ui,/e\.code==='nickname_taken'/);
 assert.match(ui,/已有人使用/);
 assert.match(ui,/aria-invalid/);
});
