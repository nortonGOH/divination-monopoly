'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.join(__dirname,'..');
const entry=fs.readFileSync(path.join(base,'challenge-v9-library-bank.js'),'utf8');
const safe=fs.readFileSync(path.join(base,'challenge-v23-bank-tools.js'),'utf8');
test('bank shortcut is preserved without any rebalance or bulk distribution handler',()=>{
 new vm.Script(entry);
 assert.match(entry,/開啟題庫管理/);
 assert.match(entry,/manage\.click\(\)/);
 assert.doesNotMatch(entry,/balancedRows|upsertCloud|persistBank|fetchCloudBank|validBank|MANSION_NAMES|\.mansion\s*=|input\.type='file'/);
 assert.doesNotMatch(entry,/匯入新增題目並均分28宿|重新均分現有題庫/);
});
test('guarded JSON diff-and-review import is preserved',()=>{
 assert.match(safe,/校正版 JSON：比對後更新/);
 assert.match(safe,/確認套用勾選的題目/);
 assert.match(safe,/quiz_admin_apply_question_changes/);
 assert.doesNotMatch(safe,/匯入新增題目並均分28宿|重新均分現有題庫/);
});
