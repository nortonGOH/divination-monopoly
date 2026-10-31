'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ctx={window:{}};
vm.runInNewContext(fs.readFileSync('config.js','utf8'),ctx,{timeout:1000});
const cfg=ctx.window.QUIZ_AUTH_CONFIG;
assert.ok(cfg?.supabaseUrl?.startsWith('https://'));
assert.ok(cfg?.publishableKey?.startsWith('sb_publishable_'));
const endpoint=cfg.supabaseUrl.replace(/\/$/,'')+'/functions/v1/quiz-ip-monitor';
async function call(method,body,origin='https://nortongoh.github.io',extra={}){
 const headers={apikey:cfg.publishableKey,'content-type':'application/json',...extra};
 if(origin!==null)headers.origin=origin;
 const res=await fetch(endpoint,{method,headers,body:body===undefined?undefined:JSON.stringify(body),
  signal:AbortSignal.timeout(18000),redirect:'error'});
 const raw=await res.text();
 let json={};try{json=JSON.parse(raw);}catch(_){}
 return {status:res.status,json};
}
(async()=>{
 const notAllowed=await call('GET');
 console.log('GET rejected:',notAllowed.status);
 assert.equal(notAllowed.status,405);
 const forbidden=await call('POST',{kind:'click',page:'home',source:'internal',target:'button'},'https://untrusted.example');
 console.log('Untrusted origin rejected:',forbidden.status);
 assert.equal(forbidden.status,403);
 const invalid=await call('POST',{kind:'click',page:'home',source:'internal',target:'untrusted@text'});
 console.log('Invalid control rejected:',invalid.status);
 assert.equal(invalid.status,400,'A 503 here can mean no trustworthy IP header');
 const good=await call('POST',{kind:'click',page:'home',source:'internal',target:'button'});
 console.log('Valid observation:',good.status,Boolean(good.json?.ok));
 assert.equal(good.status,200);
 assert.equal(good.json?.ok,true);
 assert.equal(good.json?.recorded,true);
 // This header is controlled by the caller. Verify separately in the database
 // that the gateway did NOT store this RFC5737 TEST-NET address as the source.
 const spoof=await call('POST',{kind:'click',page:'home',source:'internal',target:'button'},
  'https://nortongoh.github.io',{'cf-connecting-ip':'198.51.100.29'});
 console.log('Caller-supplied IP attempt:',spoof.status);
 assert.equal(spoof.status,403,'Gateway must reject caller-supplied provider IP header');
 console.log('Live smoke passed: GET 405, origin 403, invalid 400, valid 200, forged IP 403.');
})().catch(e=>{console.error(String(e));process.exitCode=1;});
