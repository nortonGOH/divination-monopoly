'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','challenge-v12-leaderboard.js'),'utf8');
test('public leaderboard hides registration count and does not fetch the count RPC',()=>{
 assert.doesNotMatch(source,/\/rest\/v1\/rpc\/quiz_public_registration_count/);
 assert.doesNotMatch(source,/registered_count/);
 assert.doesNotMatch(source,/註冊人數 \+/);
 assert.match(source,/顯示排行榜前/);
 assert.match(source,/目前尚無排行/);
});
test('leaderboard still retrieves top five without changing score or membership',()=>{
 assert.match(source,/\/rest\/v1\/rpc\/quiz_public_leaderboard/);
 assert.match(source,/payload\.slice\(0,5\)/);
 assert.match(source,/p\.correct_attempts/);
 assert.doesNotMatch(source,/\/rest\/v1\/rpc\/(?:quiz_set_player_profile|quiz_record)/);
});
