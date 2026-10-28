/* v19: admin bank inventory by knowledge type, level and question format. */
(()=>{
'use strict';
const dialog=document.getElementById('bankDialog');
const toolbar=dialog?.querySelector('.bank-toolbar');
if(!dialog||!toolbar||typeof renderBankList!=='function')return;
const types=['山','醫','命','卜','相','天文曆法','易學','待分類'];
const levels=['初階','中階','高階'];
const styles=document.createElement('style');
styles.textContent=`
.bank-inventory{padding:17px 25px 20px;background:#fcf7ed;border-bottom:1px solid #e3d7c2}
.bank-inventory h3{font-size:1.06rem;margin:0 0 6px}
.bank-inventory p{font-size:.79rem;color:#6c6b65;margin:0 0 12px;line-height:1.6}
.bank-inventory-summary{display:flex;flex-wrap:wrap;gap:9px;margin:0 0 12px}
.bank-inventory-summary span{padding:7px 11px;border-radius:8px;border:1px solid #dfd1b8;background:#fffdf7;font-size:.83rem}
.bank-inventory-scroll{overflow:auto;border:1px solid #dfd1b8;border-radius:11px;background:#fffdfa}
.bank-inventory table{border-collapse:collapse;width:100%;min-width:490px;font-size:.83rem}
.bank-inventory th,.bank-inventory td{padding:9px 10px;border-bottom:1px solid #ebe1ce;text-align:center;white-space:nowrap}
.bank-inventory th:first-child,.bank-inventory td:first-child{text-align:left}
.bank-inventory thead th{background:#f2e9d9;color:#605340}
.bank-inventory tbody tr:last-child td{border-bottom:0}
.bank-inventory button{border:1px solid transparent;background:transparent;font:inherit;color:#365c5c;cursor:pointer;padding:5px 8px;border-radius:6px;min-width:35px}
.bank-inventory button:hover,.bank-inventory button:focus-visible{background:#e9eee6;border-color:#aebda8}
.bank-inventory button[aria-pressed=true]{background:#dae9df;border-color:#477f63;font-weight:800}
.bank-inventory .bank-muted{color:#a7a09a}
.bank-inventory .bank-insufficient{color:#a05b3a;font-weight:700}
.bank-inventory .bank-inventory-footer{margin:11px 0 0}
@media(max-width:760px){.bank-inventory{padding:14px 16px}}
`;
document.head.append(styles);
const section=document.createElement('section');section.className='bank-inventory';
section.setAttribute('aria-label','數術題庫類型與難度統計');
const heading=document.createElement('h3');heading.textContent='題庫類型與難度統計';
const description=document.createElement('p');description.textContent='四選一題目可用於抽宿挑戰；開放問答另行統計。點選題數可篩選題庫並修改難度。';
const summary=document.createElement('div');summary.className='bank-inventory-summary';
const scroller=document.createElement('div');scroller.className='bank-inventory-scroll';
const foot=document.createElement('p');foot.className='bank-inventory-footer';
section.append(heading,description,summary,scroller,foot);toolbar.after(section);
const filterType=document.getElementById('bankKnowledgeType');
const filterLevel=document.getElementById('bankDifficulty');
const mansion=document.getElementById('bankFilter');
const keyword=document.getElementById('bankSearch');
let openSource=()=>typeof window.quizGetOpenQuestions==='function'?window.quizGetOpenQuestions():[];
const classify=q=>typeof inferKnowledgeType==='function'?inferKnowledgeType(q):'待分類';
function renderStats(){
 const choice=Array.isArray(questionBank)?questionBank:[];
 const opens=openSource();
 const matrix=new Map();
 for(const type of types)matrix.set(type,[0,0,0]);
 for(const q of choice){
  const type=classify(q),level=q.difficulty||'中階',i=levels.indexOf(level);
  if(!matrix.has(type))matrix.set(type,[0,0,0]);
  if(i>=0)matrix.get(type)[i]++;
 }
 summary.replaceChildren();
 const totals=[['四選一',choice.length],['開放問答',opens.length],['題庫總計',choice.length+opens.length]];
 for(const [label,n] of totals){const span=document.createElement('span');span.textContent=label+'：'+n+' 題';summary.append(span);}
 const table=document.createElement('table');
 const head=document.createElement('thead'),hr=document.createElement('tr');
 for(const label of ['數術類型',...levels,'四選一合計']){const th=document.createElement('th');th.textContent=label;hr.append(th);}
 head.append(hr);table.append(head);
 const body=document.createElement('tbody');
 let totalsByLevel=[0,0,0];
 const selectCell=(type,level)=>{
  if(filterType)filterType.value=type;
  if(filterLevel)filterLevel.value=level;
  if(mansion)mansion.value='all';
  if(keyword)keyword.value='';
  renderBankList();
  document.getElementById('listHeading')?.scrollIntoView({block:'nearest',behavior:'smooth'});
 };
 function cell(row,label,type,level,number){
  const td=document.createElement('td');
  if(number===0){td.className='bank-muted';td.textContent='0';}
  else{const button=document.createElement('button');button.type='button';button.textContent=String(number);button.setAttribute('aria-label',label+'：'+number+'題，點擊篩選');button.setAttribute('aria-pressed',String(filterType?.value===type&&filterLevel?.value===level));button.onclick=()=>selectCell(type,level);td.append(button);}
  row.append(td);
 }
 for(const [type,counts] of matrix){
  const tr=document.createElement('tr'),name=document.createElement('td');name.textContent=type;tr.append(name);
  counts.forEach((n,i)=>{totalsByLevel[i]+=n;cell(tr,type+'／'+levels[i],type,levels[i],n);});
  cell(tr,type+'四選一合計',type,'all',counts.reduce((a,b)=>a+b,0));body.append(tr);
 }
 const totalRow=document.createElement('tr'),name=document.createElement('td');name.textContent='各難度合計';name.style.fontWeight='700';totalRow.append(name);
 totalsByLevel.forEach((n,i)=>cell(totalRow,levels[i]+'合計','all',levels[i],n));
 cell(totalRow,'四選一總計','all','all',choice.length);body.append(totalRow);
 table.append(body);scroller.replaceChildren(table);
 const insufficient=types.filter(type=>matrix.get(type)?.some(n=>n<28)&&matrix.get(type)?.some(n=>n>0)).length;
 foot.textContent='分類 × 難度以四選一題目計算。單一分類／難度未達 28 題時，無法保證每宿都有尚未作答的題目。'+(insufficient?'目前有 '+insufficient+' 個類型至少一個難度不足 28 題。':'');
}
const prior=renderBankList;
renderBankList=function(){prior();renderStats();};
for(const e of [filterType,filterLevel])e?.addEventListener('change',()=>renderStats());
renderStats();
})();
