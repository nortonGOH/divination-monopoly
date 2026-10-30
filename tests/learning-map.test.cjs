'use strict';
/* Standalone curriculum verification without browser network, Supabase or live scores. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const base=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(base,'learning-map.js'),'utf8');
const curriculum=fs.readFileSync(path.join(base,'learning-curriculum.js'),'utf8');
const html=fs.readFileSync(path.join(base,'index.html'),'utf8');

class FakeNode {
  constructor(tag) {
    this.tagName=tag.toLowerCase();this.children=[];this.attributes={};
    this.listeners={};this.style={};this.className='';this.dataset={};
    this.textContent='';this.parentNode=null;this.hidden=false;
  }
  append(...nodes){
    for(const child of nodes){
      if(child.parentNode)child.parentNode.children=child.parentNode.children.filter(x=>x!==child);
      child.parentNode=this;this.children.push(child);
    }
  }
  before(node){assert.ok(this.parentNode);node.parentNode=this.parentNode;this.parentNode.children.splice(this.parentNode.children.indexOf(this),0,node);}
  replaceChildren(...nodes){this.children.forEach(x=>x.parentNode=null);this.children=[];this.append(...nodes);}
  get lastChild(){return this.children.at(-1)||null;}
  setAttribute(name,value){this.attributes[name]=String(value);}
  getAttribute(name){return this.attributes[name]??null;}
  addEventListener(type,handler){(this.listeners[type]||=[]).push(handler);}
  click(){(this.listeners.click||[]).forEach(fn=>fn({type:'click'}));}
  focus(){this.focused=true;}
  querySelectorAll(selector){
    if(selector!=='button')throw Error('unimplemented selector '+selector);
    return walk(this).filter(x=>x.tagName==='button');
  }
}
function walk(node){return [node,...node.children.flatMap(walk)];}
function content(node){return [node.textContent,...node.children.map(content)].join(' ');}
const named=(root,name)=>walk(root).filter(x=>x.className.split(' ').includes(name));
const store=()=>({
  values:new Map(),
  getItem(key){return this.values.get(key)||null;},
  setItem(key,value){this.values.set(key,value);}
});
function fixture(memory=store()){
  const body=new FakeNode('body'),head=new FakeNode('head'),guest=new FakeNode('section');
  guest.id='guestbook';body.append(guest);
  const window={localStorage:memory};
  const document={body,head,createElement:tag=>new FakeNode(tag),
    getElementById:id=>walk(body).find(node=>node.id===id)||null};
  // Poison objects that previously provided map topics and score progress:
  const poisoned=new Proxy({}, {get(){throw Error('question bank is forbidden');}});
  const context={window,document,questionBank:poisoned,MANSIONS:poisoned,
    quizCompletedIds:poisoned,console};
  vm.runInNewContext(curriculum,context,{filename:'learning-curriculum.js',timeout:1000});
  vm.runInNewContext(source,context,{filename:'learning-map.js',timeout:1000});
  const root=document.getElementById('learningMap');
  assert.ok(root,'map mounted');
  return{window,root,memory,byClass:name=>named(root,name),
    byId:id=>document.getElementById(id)};
}
test('independent curriculum has 11 editorial topics, 28 unique mansion lessons and linked sources',()=>{
  const w={};vm.runInNewContext(curriculum,{window:w},{timeout:1000});
  const d=w.NUMEROLOGY_CURRICULUM;
  assert.equal(d.topics.length,11);assert.equal(d.mansions.length,28);
  assert.equal(new Set([...d.topics,...d.mansions].map(x=>x.id)).size,39);
  for(const x of [...d.topics,...d.mansions]){
    assert.ok(x.lead.length>15&&x.method.length>12&&x.question.length>10);
    assert.ok(x.points.length>=3&&x.caution.length>12);
    assert.ok(x.sources.length>=1);
    for(const ref of x.sources)assert.match(d.sources[ref].url,/^https:\/\//);
  }
  assert.equal(d.mansions.filter(x=>x.group==='東方青龍').length,7);
  assert.equal(d.mansions.filter(x=>x.group==='北方玄武').length,7);
  assert.equal(d.mansions.filter(x=>x.group==='西方白虎').length,7);
  assert.equal(d.mansions.filter(x=>x.group==='南方朱雀').length,7);
});
test('index uses standalone material and no quiz bank event dependency',()=>{
  new vm.Script(curriculum);new vm.Script(source);
  assert.match(html, /<script src="\.\/learning-curriculum\.js"><\/script>\s*<script src="\.\/learning-map\.js"><\/script>/);
  assert.doesNotMatch(source,/questionBank|quizMemberToken|quizCompletedIds|inferKnowledgeType|Supabase|quiz-answer-graded|challenge-bank-loaded|fetch\(/);
  assert.doesNotMatch(curriculum,/questionBank|quizMemberToken|quizCompletedIds|quiz_submit_choice|fetch\(/);
});
test('map displays 11 written lessons with citations independent of any quiz state',()=>{
  const f=fixture();
  assert.equal(f.byClass('learn-map-node').length,11);
  const article=f.byClass('learn-map-detail')[0];
  assert.match(content(article),/數術文獻與歷史分類/);
  assert.match(content(article),/學習重點/);
  assert.match(content(article),/史料與研究方法/);
  assert.match(content(article),/證據界線/);
  assert.match(content(article),/《漢書》卷三十/);
  assert.match(content(f.root),/獨立教材：已標記閱讀 0／39 單元/);
  assert.doesNotMatch(content(f.root),/對應題庫|答對.*題/);
});
test('read markers are local, reversible and never modify scored challenge state',()=>{
  const memory=store();const f=fixture(memory);
  const action=f.byClass('learn-map-action')[0];
  action.click();
  assert.match(content(f.root),/獨立教材：已標記閱讀 1／39 單元/);
  assert.match(content(f.root),/✓ 已標記閱讀/);
  assert.equal(JSON.parse(memory.getItem('numerology-standalone-learning-reading-v1')).length,1);
  const second=fixture(memory);
  assert.match(content(second.root),/已標記閱讀 1／39 單元/);
  second.byClass('learn-map-action')[0].click();
  assert.match(content(second.root),/已標記閱讀 0／39 單元/);
});
test('28 mansion lessons show group headings and exact atlas deep-link',()=>{
  const f=fixture();
  f.byId('learn-map-tab-mansions').click();
  assert.equal(f.byClass('learn-map-node').length,28);
  assert.equal(f.byClass('learn-map-path-heading').length,4);
  assert.match(content(f.root),/角宿/);
  const link=walk(f.byClass('learn-map-detail')[0]).find(x=>x.className==='learn-map-atlas');
  assert.equal(link.href,'./mansions-atlas.html?m='+encodeURIComponent('角'));
  assert.match(content(f.root),/史料與研究方法/);
});
test('storage failures do not block lesson reading',()=>{
  const f=fixture({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}});
  assert.equal(f.byClass('learn-map-node').length,11);
  f.byClass('learn-map-action')[0].click();
  assert.match(content(f.root),/無法儲存/);
  assert.match(content(f.root),/已標記閱讀 1／39 單元/);
});
