'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('editor and carousel scripts parse',()=>{new vm.Script(read('daily-knowledge-editor-admin.js'));new vm.Script(read('daily-knowledge-carousel.js'));});
test('type options originate in live quiz knowledge types',()=>{const sql=read('database/daily-knowledge-types.sql');assert.match(sql,/select distinct knowledge_type from public.quiz_questions/);assert.match(sql,/not exists\(select 1 from public.quiz_questions where knowledge_type=v_type\)/);assert.match(sql,/quiz_daily_card_type_guard/);});
test('existing cards preserved without inferred labels; admin must choose',()=>{const s=read('database/daily-knowledge-types.sql');assert.match(s,/add column if not exists knowledge_type text/);assert.doesNotMatch(s,/update public.quiz_daily_knowledge_cards set knowledge_type=/);const js=read('daily-knowledge-editor-admin.js');assert.match(js,/data.types\|\|\[\]/);assert.match(js,/p_knowledge_type:typeSelect.value/);});
test('public data has type but keeps approved cards only',()=>{const s=read('database/daily-knowledge-types.sql');assert.match(s,/where is_active=true/);assert.match(s,/'knowledge_type',z.knowledge_type/);});
