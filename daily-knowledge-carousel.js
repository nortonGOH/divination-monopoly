(()=>{'use strict';
const cfg=window.QUIZ_AUTH_CONFIG||{},base=String(cfg.supabaseUrl||'').replace(/\/$/,''),key=String(cfg.publishableKey||'');
// Public editorial cards are fetched separately; no member-only or answer-key content is used.
let pool=[];
const section=document.createElement('section');section.id='dailyKnowledgeCarousel';section.className='daily-knowledge-carousel';section.hidden=true;
section.setAttribute('aria-label','每日知識解析卡');
const style=document.createElement('style');style.textContent=`
.daily-knowledge-carousel{max-width:880px;margin:16px auto;padding:18px;border:1px solid #c5aa7c;border-radius:16px;background:linear-gradient(125deg,#fffaf0,#f3ead8);box-shadow:0 6px 26px #1a29300d}
.daily-knowledge-carousel[hidden]{display:none!important}
.daily-knowledge-carousel h2{font-size:1.14rem;margin:0 0 4px;color:#294d47}
.daily-knowledge-carousel .daily-knowledge-card{min-height:120px;padding:15px;border-radius:11px;background:#fffdf8;border:1px solid #e1d2b6}
.daily-knowledge-carousel .daily-knowledge-card h3{font-size:1rem;margin:0 0 8px}
.daily-knowledge-carousel .daily-knowledge-card p{line-height:1.75;margin:6px 0}
.daily-knowledge-carousel .daily-knowledge-source{font-size:.78rem;color:#5d665e}
.daily-knowledge-carousel .daily-knowledge-controls{display:flex;align-items:center;justify-content:space-between;gap:9px;margin-top:10px;flex-wrap:wrap}
.daily-knowledge-carousel button{font:inherit;cursor:pointer;border:1px solid #ad976c;border-radius:8px;background:#fff;padding:8px 12px;min-height:40px}
.daily-knowledge-carousel .daily-knowledge-meta{font-size:.77rem;color:#6b655a;margin-bottom:10px}
@media(prefers-reduced-motion:reduce){.daily-knowledge-carousel *{scroll-behavior:auto!important}}
`;document.head.append(style);
const make=(tag,text='')=>{const e=document.createElement(tag);e.textContent=text;return e;};
const header=make('h2','✦ 每日知識解析卡'),meta=make('p','','');meta.className='daily-knowledge-meta';
const card=make('article');card.className='daily-knowledge-card';
const controls=make('div');controls.className='daily-knowledge-controls';
const previous=make('button','上一則'),next=make('button','下一則'),pause=make('button','暫停輪播'),counter=make('span');
[previous,next,pause].forEach(b=>b.type='button');
controls.append(previous,counter,next,pause);section.append(header,meta,card,controls);
const target=document.querySelector('.learning-hub')||document.querySelector('#quizTitle')?.closest('.quiz-section');
if(!target)return;target.before(section);
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let date='',selected=[],index=0,playing=true,timer=null;
function hash(str){let n=2166136261;for(let i=0;i<str.length;i++){n=Math.imul(n^str.charCodeAt(i),16777619)}return n>>>0;}
function pick(day){const shuffled=pool.map(x=>({x,score:hash(day+':'+x.id)})).sort((a,b)=>a.score-b.score);return shuffled.slice(0,3).map(x=>x.x);}
function render(){
 const item=selected[index];if(!item)return;
 card.replaceChildren(make('h3',item.title),make('p',item.content));
 if(item.knowledge_type)card.insertBefore(make('p','數術類型：'+item.knowledge_type),card.firstChild);
 if(item.caution)card.append(make('p','研究提醒：'+item.caution));
 if(item.source.length){const wrap=make('p','資料來源：');wrap.className='daily-knowledge-source';for(const [i,source] of item.source.entries()){if(i)wrap.append(document.createTextNode('、'));const a=make('a',source.label);a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';wrap.append(a);}card.append(wrap);}
 counter.textContent=(index+1)+'／3';meta.textContent='臺灣日期 '+date+'｜每日精選三則，隔日更新';
}
function sync(){const d=today();if(d!==date){date=d;selected=pick(d);index=0;render();}}
function advance(step){sync();index=(index+step+3)%3;render();}
function start(){if(timer)clearInterval(timer);timer=setInterval(()=>{if(document.hidden||section.hidden||!playing)return;advance(1)},8500);}
previous.onclick=()=>advance(-1);next.onclick=()=>advance(1);
pause.onclick=()=>{playing=!playing;pause.textContent=playing?'暫停輪播':'繼續輪播';};
const visibility=()=>{const flags=window.quizFeatureVisibility;section.hidden=!flags||flags.daily_knowledge_visible!==true;if(!section.hidden&&pool.length>=3)sync();section.hidden=section.hidden||pool.length<3;};
window.addEventListener('quiz-feature-visibility-changed',visibility);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});
async function loadPublic(){
 if(!base||!key){section.hidden=true;return;}
 try{
 const response=await fetch(base+'/rest/v1/rpc/quiz_public_daily_knowledge_cards',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:'{}',cache:'no-store'});
 if(!response.ok)throw Error('card read failed');
 const data=await response.json();if(!Array.isArray(data?.cards))throw Error('invalid cards');
 pool=data.cards.map(x=>({id:x.id,title:x.title,content:x.content,knowledge_type:x.knowledge_type||'',caution:x.caution||'',source:[{label:x.source_label,url:x.source_url}]}));
 date='';sync();visibility();
 }catch(_){section.hidden=true;}
}
// Expose only today's three approved public notes for the shared homepage popup.
window.quizPickDailyKnowledgeForPopup=()=>{
 if(pool.length<3)return null;
 sync();
 if(selected.length!==3)return null;
 return selected[Math.floor(Math.random()*selected.length)]||null;
};
visibility();start();
window.quizDailyKnowledgeReady=loadPublic();
})();