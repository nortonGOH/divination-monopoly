'use strict';
/* Isolated DOM/quiz fixture. No browser network, credentials, live Supabase or answer keys. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname,'..','learning-map.js'),'utf8');
const html = fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');

class FakeNode {
  constructor(tag) {
    this.tagName = tag.toLowerCase();
    this.children = [];
    this.attributes = {};
    this.listeners = {};
    this.style = {};
    this.className = '';
    this.dataset = {};
    this.textContent = '';
    this.hidden = false;
    this.parentNode = null;
  }
  append(...nodes) {
    for (const child of nodes) {
      if (child.parentNode) child.parentNode.children = child.parentNode.children.filter(n => n !== child);
      child.parentNode = this; this.children.push(child);
    }
  }
  before(node) {
    assert.ok(this.parentNode, 'must have a parent');
    node.parentNode = this.parentNode;
    this.parentNode.children.splice(this.parentNode.children.indexOf(this), 0, node);
  }
  replaceChildren(...nodes) {
    this.children.forEach(n => { n.parentNode = null; });
    this.children = [];
    this.append(...nodes);
  }
  get lastChild() { return this.children[this.children.length - 1] || null; }
  addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] || null; }
  dispatchEvent(event) { (this.listeners[event.type] || []).forEach(fn => fn(event)); }
  click() { this.dispatchEvent({type:'click'}); }
  focus() { this.focused = true; }
  scrollIntoView() { this.scrolled = true; }
  querySelectorAll(selector) {
    if (selector !== 'button') throw Error('unsupported fixture selector');
    return walk(this).filter(n => n.tagName === 'button');
  }
}
function walk(node) { return [node,...node.children.flatMap(walk)]; }
function content(node) { return [node.textContent,...node.children.map(content)].join(' '); }
function nodesByClass(root, cl) {
  return walk(root).filter(n => n.className.split(/\s+/).includes(cl));
}
function fixture() {
  const body = new FakeNode('body'), head = new FakeNode('head');
  const wheel = new FakeNode('button'), guestbook = new FakeNode('section');
  wheel.id = 'spinBtn'; guestbook.id = 'guestbook'; body.append(wheel, guestbook);
  const select = new FakeNode('select');
  select.id = 'challengeKnowledgeType';
  select.options = [{value:'all'},...['通識','易學','天文曆法','山','醫','命','卜','相','式占','兵陰陽','待分類'].map(value=>({value}))];
  select.value='all';
  const login = new FakeNode('button');
  login.id='playerSignInBtn';
  const ids = {spinBtn:wheel,guestbook,challengeKnowledgeType:select,playerSignInBtn:login};
  const events = {};
  let token='';
  const window = {
    quizMemberToken: () => token,
    quizCompletedIds: new Set(),
    addEventListener(event, callback) { (events[event] ||= []).push(callback); },
    dispatchEvent(evt) { (events[evt.type] || []).forEach(fn => fn(evt)); }
  };
  const fixtureMansions = Array.from({length:28},(_,i)=>({
    name: i===0 ? '角木蛟' : '測試宿'+i,
    quad:['東方青龍','北方玄武','西方白虎','南方朱雀'][Math.floor(i/7)]
  }));
  const questions=[
    {id:'q1',knowledge_type:'易學',mansion:'角木蛟'},
    {id:'q2',knowledge_type:'易學',mansion:'測試宿1'},
    {id:'q3',knowledge_type:'通識',mansion:'測試宿7'},
    {id:'q4',knowledge_type:'命',mansion:'測試宿14'}
  ];
  const document={body,head,createElement:tag=>new FakeNode(tag),getElementById:id=>ids[id] || (id==='learningMap' ? walk(body).find(n=>n.id==='learningMap') : null)};
  const context={window,document,questionBank:questions,MANSIONS:fixtureMansions,Event:class{constructor(type,detail){this.type=type;this.detail=detail;}},console};
  vm.runInNewContext(source,context,{filename:'learning-map.js',timeout:1000});
  const map = walk(body).find(n => n.id === 'learningMap');
  assert.ok(map,'the learning map was inserted');
  return {
    map,wheel,select,login,body,window,questions,
    setToken(value) {token = value;window.dispatchEvent({type:'quiz-member-session-changed'});},
    emit(type) { window.dispatchEvent({type}); },
    nodes: cl=>nodesByClass(map,cl)
  };
}

test('syntax and install points preserve the existing quiz controllers',()=>{
  new vm.Script(source,{filename:'learning-map.js'});
  assert.match(html, /<a href="#learningMap">互動學習地圖<\/a>/);
  assert.match(html, /<script src="\.\/quiz-question-modal\.js"><\/script>\s*<script src="\.\/learning-map\.js"><\/script>/);
  assert.match(html,/dispatchEvent\(new Event\("challenge-bank-loaded"\)\)/);
  assert.doesNotMatch(source,/localStorage|sessionStorage|quiz_submit_choice|correct_answer|quiz_rescue_purchase|service_role|fetch\(/);
});

test('guest map has eleven topic nodes and displays no artificial progress',()=>{
  const f=fixture();
  assert.equal(f.nodes('learn-map-node').length,11);
  assert.match(content(f.map),/尚未登入/);
  assert.match(content(f.map),/易學基礎/);
  assert.match(content(f.map),/登入會員可查看進度/);
  assert.ok(!f.nodes('learn-map-node').some(x=>x.textContent.includes('正確答案')));
});

test('server-confirmed correct IDs drive progress and topic filtering',()=>{
  const f=fixture();
  f.window.quizCompletedIds = new Set(['q1']);
  f.setToken('fake-test-token');
  assert.match(content(f.map),/正式掌握 1／4 題/);
  const yi = f.nodes('learn-map-node').find(n=>content(n).includes('易學基礎'));
  yi.click();
  assert.match(content(f.nodes('learn-map-detail')[0]),/已掌握 1／2 題/);
  const action = f.nodes('learn-map-detail-action')[0];
  action.click();
  assert.equal(f.select.value,'易學');
  assert.equal(f.wheel.scrolled,true);
  assert.equal(f.wheel.focused,true);
  f.window.quizCompletedIds.add('q2');
  f.emit('quiz-answer-graded');
  assert.match(content(f.map),/正式掌握 2／4 題/);
  assert.match(content(f.map),/✓ 已完成本關/);
});

test('the astronomy route has all twenty-eight distinct mansion milestones',()=>{
  const f=fixture();
  f.window.quizCompletedIds = new Set(['q1']);
  f.setToken('fake-test-token');
  const tab=walk(f.map).find(n=>n.id==='learn-map-tab-mansions');
  tab.click();
  assert.equal(f.nodes('learn-map-node').length,28);
  assert.equal(f.nodes('learn-map-path-heading').length,4);
  const first=f.nodes('learn-map-node')[0];
  first.click();
  assert.match(content(f.nodes('learn-map-detail')[0]),/已完成本關/);
  assert.match(content(f.nodes('learn-map-detail')[0]),/前往二十八宿互動圖鑑/);
  assert.match(content(f.nodes('learn-map-detail')[0]),/原有轉盤隨機抽宿/);
});

test('logout clears personal progress and bank refresh updates denominator',()=>{
  const f=fixture();
  f.window.quizCompletedIds = new Set(['q1','q2']);
  f.setToken('fake-test-token');
  assert.match(content(f.map),/正式掌握 2／4 題/);
  f.questions.push({id:'q5',knowledge_type:'式占',mansion:'測試宿3'});
  f.emit('challenge-bank-loaded');
  assert.match(content(f.map),/正式掌握 2／5 題/);
  f.setToken('');
  assert.match(content(f.map),/尚未登入/);
  assert.doesNotMatch(content(f.map),/正式掌握 2／5 題/);
});
