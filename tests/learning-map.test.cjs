'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','learning-map.js'),'utf8');
const catalog=fs.readFileSync(path.join(__dirname,'..','learning-curriculum.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
class FakeNode{
 constructor(tag){this.tagName=tag.toLowerCase();this.children=[];this.attributes={};this.listeners={};this.style={};this.dataset={};this.textContent='';this.className='';this.parentNode=null;this.hidden=false;}
 append(...nodes){for(const node of nodes){if(node.parentNode)node.parentNode.children=node.parentNode.children.filter(x=>x!==node);node.parentNode=this;this.children.push(node);}}
 before(node){assert.ok(this.parentNode);node.parentNode=this.parentNode;this.parentNode.children.splice(this.parentNode.children.indexOf(this),0,node);}
 replaceChildren(...nodes){this.children.forEach(n=>n.parentNode=null);this.children=[];this.append(...nodes);}
 get lastChild(){return this.children.at(-1)||null;}
 addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}
 setAttribute(a,b){this.attributes[a]=String(b);}
 getAttribute(a){return this.attributes[a]??null;}
 click(){for(const fn of this.listeners.click||[])fn({type:'click'});}
 focus(){this.focused=true;}
 querySelectorAll(selector){if(selector!=='button')throw Error('unsupported selector');return walk(this).filter(n=>n.tagName==='button');}
}
const walk=n=>[n,...n.children.flatMap(walk)];
const text=n=>[n.textContent,...n.children.map(text)].join(' ');
const byClass=(node,cls)=>walk(node).filter(n=>n.className.split(' ').includes(cls));
const memory=()=>({data:new Map(),getItem(k){return this.data.get(k)||null;},setItem(k,v){this.data.set(k,v);}});
function context(saved=memory()){
 const body=new FakeNode('body'),head=new FakeNode('head'),guest=new FakeNode('section');
 const placeholder=new FakeNode('section');placeholder.id='learningMap';placeholder.className='learn-map-fallback';
 const fallbackTitle=new FakeNode('h2');fallbackTitle.textContent='數術知識學習地圖';placeholder.append(fallbackTitle);
 guest.id='guestbook';body.append(placeholder,guest);
 const login=new FakeNode('button');login.id='playerSignInBtn';
 const events={};let memberToken='';
 const requests=[];let responses=[];
 const window={localStorage:saved,QUIZ_AUTH_CONFIG:{supabaseUrl:'https://mock.supabase.co',publishableKey:'test-publishable'},quizMemberToken:()=>memberToken,
  addEventListener(name,fn){(events[name]||=[]).push(fn);},
  dispatchEvent(event){for(const fn of events[event.type]||[])fn(event);}
 };
 const document={body,head,createElement:tag=>new FakeNode(tag),getElementById:id=>id==='playerSignInBtn'?login:walk(body).find(n=>n.id===id)||null};
 vm.runInNewContext(catalog,{window},{timeout:1000});
 const data=window.NUMEROLOGY_CURRICULUM;
 const fetch=(url,options)=>{requests.push({url,options});const resolve=responses.shift();return resolve?resolve(url,options):Promise.resolve({ok:false,status:403,json:async()=>[]});};
 vm.runInNewContext(source,{window,document,fetch,console},{timeout:1000});
 const root=document.getElementById('learningMap');
 assert.equal(root,placeholder,'must hydrate the existing permanent section');
 assert.equal(root.dataset.mapEnhanced,'true');
 assert.equal(root.className,'learn-map');
 return {root,window,data,login,requests,responses,byClass:cls=>byClass(root,cls),byId:id=>document.getElementById(id),
  setMember(value){memberToken=value;window.dispatchEvent({type:'quiz-member-session-changed'});},
  makeMemberRows(){return [...data.topics,...data.mansions].filter(x=>x.access_tier==='member').map(x=>({
   id:x.id,access_tier:'member',lead:'已核實的會員教材：'+x.title,
   points:['會員專屬重點一','會員專屬重點二','會員專屬重點三'],method:'研究方法',question:'思考問題',caution:'證據界線',
   sources:['han'],atlas_name:x.id.startsWith('mansion-')?x.title.slice(0,1):null
  }));}
 };
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('catalog publishes only 3 intro bodies, 36 titles and no member content',()=>{
 const f=context();
 assert.equal(f.data.topics.length,11);assert.equal(f.data.mansions.length,28);
 assert.equal(f.data.sources.shi.url,'https://zh.wikisource.org/zh-hant/%E5%8F%B2%E8%A8%98/%E5%8D%B7027');
 assert.equal([...f.data.topics,...f.data.mansions].filter(x=>x.access_tier==='intro').length,3);
 for(const x of [...f.data.topics,...f.data.mansions].filter(x=>x.access_tier==='member')){
  assert.equal(x.lead,undefined);
  for(const k of ['points','method','question','caution','sources','atlasName'])assert.equal(x[k],undefined);
 }
 assert.doesNotMatch(source,/questionBank|quizCompletedIds|inferKnowledgeType|quiz-answer-graded|challenge-bank-loaded/);
 assert.match(html,/<script src="\.\/learning-curriculum\.js"><\/script>\s*<script src="\.\/learning-map\.js"><\/script>/);
 assert.match(html,/<section id="learningMap" class="learn-map-fallback"/);
 assert.match(html,/入門一｜數術文獻與歷史分類/);
 assert.match(html,/入門二｜陰陽、五行與關聯思維/);
 assert.match(html,/入門三｜干支、曆譜與歲時/);
});
test('guests can read only 3 intro modules and never call protected API',()=>{
 const f=context();assert.equal(f.requests.length,0);
 assert.equal(f.byClass('learn-map-node').length,11);
 assert.match(text(f.root),/遊客入門：已標記閱讀 0／3 單元/);
 assert.match(text(f.byClass('learn-map-detail')[0]),/《漢書》/);
 f.byClass('learn-map-node')[4].click();
 assert.match(text(f.byClass('learn-map-detail')[0]),/註冊／登入會員解鎖全部教材/);
 assert.doesNotMatch(text(f.byClass('learn-map-detail')[0]),/學習重點/);
 assert.equal(f.requests.length,0);
 f.byClass('learn-map-action')[0].click();assert.equal(f.login.listeners.click?.length||0,0);
});
test('member requests 36 rows with Bearer token and displays protected content after verification',async()=>{
 const f=context();
 f.responses.push(async()=>({ok:true,json:async()=>f.makeMemberRows()}));
 f.setMember('verified-test-token');await settle();
 assert.equal(f.requests.length,1);
 assert.match(f.requests[0].url,/access_tier=eq.member/);
 assert.equal(f.requests[0].options.headers.Authorization,'Bearer verified-test-token');
 assert.match(text(f.root),/會員教材：已標記閱讀 0／39 單元/);
 f.byClass('learn-map-node')[4].click();
 assert.match(text(f.byClass('learn-map-detail')[0]),/已核實的會員教材/);
 assert.match(text(f.byClass('learn-map-detail')[0]),/會員專屬重點一/);
});
test('logout immediately purges protected content; previous reading is not exposed to guests',async()=>{
 const f=context();f.responses.push(async()=>({ok:true,json:async()=>f.makeMemberRows()}));
 f.setMember('test-token');await settle();
 f.byClass('learn-map-node')[4].click();
 f.byClass('learn-map-action')[0].click();
 assert.match(text(f.root),/已標記閱讀 1／39 單元/);
 f.setMember('');
 assert.match(text(f.root),/遊客入門：已標記閱讀 0／3 單元/);
 assert.doesNotMatch(text(f.byClass('learn-map-detail')[0]),/會員專屬重點一/);
 assert.equal(f.requests.length,1);
});
test('HTTP 403 and incomplete data fail closed, while intro remains readable',async()=>{
 const f=context();f.responses.push(async()=>({ok:false,status:403,json:async()=>[]}));
 f.setMember('expired');await settle();
 assert.match(text(f.byClass('learn-map-detail')[0]),/數術文獻與歷史分類/);
 f.byClass('learn-map-node')[5].click();
 assert.match(text(f.byClass('learn-map-detail')[0]),/未能通過會員教材驗證/);
 assert.doesNotMatch(text(f.root),/會員專屬重點一/);
 f.responses.push(async()=>({ok:true,json:async()=>f.makeMemberRows().slice(0,1)}));
 f.setMember('incomplete');await settle();
 assert.match(text(f.byClass('learn-map-detail')[0]),/會員教材回傳不完整/);
});
test('stale response after logout never restores member lessons',async()=>{
 const f=context();let deliver;
 f.responses.push(()=>new Promise(resolve=>{deliver=resolve;}));
 f.setMember('temporary-token');await settle();
 f.setMember('');
 deliver({ok:true,json:async()=>f.makeMemberRows()});
 await settle();await settle();
 assert.match(text(f.root),/遊客入門：已標記閱讀 0／3 單元/);
 f.byClass('learn-map-node')[6].click();
 assert.doesNotMatch(text(f.byClass('learn-map-detail')[0]),/會員專屬重點一/);
});

test('missing curriculum scripts preserve the public introductory fallback instead of an empty region',()=>{
 const body=new FakeNode('body'),head=new FakeNode('head'),guest=new FakeNode('section');
 guest.id='guestbook';
 const fallback=new FakeNode('section');fallback.id='learningMap';fallback.className='learn-map-fallback';
 const heading=new FakeNode('h2');heading.textContent='數術知識學習地圖';
 const intro=new FakeNode('p');intro.textContent='遊客可閱讀入門教材';
 fallback.append(heading,intro);body.append(fallback,guest);
 const window={localStorage:memory()};
 const document={body,head,createElement:tag=>new FakeNode(tag),getElementById:id=>walk(body).find(x=>x.id===id)||null};
 vm.runInNewContext(source,{window,document},{timeout:1000});
 assert.equal(document.getElementById('learningMap'),fallback);
 assert.equal(fallback.className,'learn-map-fallback');
 assert.match(text(fallback),/數術知識學習地圖/);
 assert.match(text(fallback),/遊客可閱讀入門教材/);
});
