/* 二十八宿圖鑑：靜態教學資料；不存取會員、題庫或 Supabase。史料摘要依《史記・天官書》整理。 */
(()=>{
'use strict';
const SOURCE='https://guoxue3000.com/tw/books/266/chapters/30';
const groups=[
  {name:'東方青龍',color:'#286f67',label:'青龍',items:[
    ['角','角','左角稱李，右角稱將；同段另論大角與攝提。','大角、攝提（同段另述，非角宿的附屬星官）','左角為李、右角為將'],
    ['亢','亢','亢被解作疏廟，並與疾病占候相關。','南門（二星，史記在亢後接續記載）','疏廟'],
    ['氐','氐','氐被稱作天根。','本段未明列氐宿的附屬星官。','天根'],
    ['房','房','房稱府，又稱天駟。','右驂、衿、轄、旗、天市、市樓、騎官（見同段敘述）','府、天駟'],
    ['心','心','心被視為明堂，中央大星象徵天王。','史記述心宿大星及前後二星的象徵。','明堂'],
    ['尾','尾','尾被描述為九子，相關解說連於君臣關係。','本段未明列尾宿的附屬星官。','九子'],
    ['箕','箕','箕被稱為敖客，並連結口舌之象。','本段未明列箕宿的附屬星官。','敖客']
  ]},
  {name:'北方玄武',color:'#38668a',label:'玄武',items:[
    ['斗','南斗','南斗被視為廟。','建星（史記稱其在南斗北方）','廟'],
    ['牛','牽牛','牽牛被解作犧牲（祭祀供品）。','河鼓（史記稱其在牽牛北方）','犧牲'],
    ['女','婺女','文獻記婺女，並另提其北的織女。','織女（同段提及；不是婺女宿的別稱）','婺女之北有織女'],
    ['虛','虛','虛與哭泣之事相聯繫。','《史記》將虛、危並述，未據此推定附屬星官。','哭泣之事'],
    ['危','危','危被解作蓋屋。','司空（史記記危東有六星）、杵臼（記在危南）','蓋屋'],
    ['室','營室','營室被稱為清廟，也提及離宮、閣道。','王良、天駟、天潢等星官見同段敘述；不可直接等同室宿本體。','清廟'],
    ['壁','東壁','《史記》在歲星所經宿次中使用東壁一名；此處未核得獨立職掌說明。','此處保留缺項，未臆配相鄰星官。',null]
  ]},
  {name:'西方白虎',color:'#8b6d35',label:'白虎',items:[
    ['奎','奎','奎被稱作封豕，並關聯溝瀆。','本段未明列奎宿的附屬星官。','封豕、溝瀆'],
    ['婁','婁','婁與聚眾相關。','本段未明列婁宿的附屬星官。','聚眾'],
    ['胃','胃','胃被稱為天倉。','廥積（史記稱位在胃南方的眾星）','天倉'],
    ['昴','昴','昴被稱作髦頭，並與胡星之說相連。','天街（史記記位於昴、畢之間）','髦頭'],
    ['畢','畢','畢被稱為罕車，文獻連於邊兵、弋獵。','附耳（在畢大星旁）；天街（在昴、畢之間）','罕車'],
    ['觜','觜觿','觜觿被說成虎首，與葆旅之事相關。','史記將觜觿與參宿的虎形譬喻同段記載。','虎首'],
    ['參','參','參被比擬為白虎；另述衡石、罰等星象。','罰、天廁、天矢等（史記在參宿段落接續記述）','白虎']
  ]},
  {name:'南方朱雀',color:'#935247',label:'朱雀',items:[
    ['井','東井','東井被連於水事。','鉞、北河、南河（史記於東井附近敘述）','水事'],
    ['鬼','輿鬼','輿鬼與鬼祠事有關，中間白色者稱質。','質（史記稱鬼宿中白者為質）','鬼祠事'],
    ['柳','柳','柳被稱為鳥注，並被連於木草。','本段未明列柳宿的附屬星官。','鳥注'],
    ['星','七星','文獻稱七星為頸、員官，並連於急事。','本段未明列星宿的附屬星官。','頸、員官'],
    ['張','張','張被解作廚，連於宴飲賓客。','本段未明列張宿的附屬星官。','廚、觴客'],
    ['翼','翼','翼被比作羽翮，並連於遠客。','本段未明列翼宿的附屬星官。','羽翮'],
    ['軫','軫','軫被比作車，連於風。','長沙、天庫樓（史記於軫宿段落接續記載）','車、風']
  ]}
];
const mansions=groups.flatMap((g,gi)=>g.items.map((item,offset)=>({
 name:item[0],alias:item[1],evidence:item[2],nearby:item[3],quizAnswer:item[4],
 group:g.name,groupIndex:gi,groupPosition:offset+1,color:g.color,index:gi*7+offset
})));
const byId=id=>document.getElementById(id);
let chosen=mansions[0],filter='全部',search='',questionIndex=0,answered=false,score=0,total=0;
const svgNS='http://www.w3.org/2000/svg';
const wheel=byId('wheelSectors');
const polar=(radius,degrees)=>{
 const rad=degrees*Math.PI/180;
 return [300+radius*Math.cos(rad),300+radius*Math.sin(rad)];
};
const sectorPath=(index)=>{
 const a=-90+index*360/28+0.3,b=-90+(index+1)*360/28-0.3;
 const p1=polar(173,a),p2=polar(285,a),p3=polar(285,b),p4=polar(173,b);
 return 'M '+p1.join(' ')+' L '+p2.join(' ')+' A 285 285 0 0 1 '+p3.join(' ')+' L '+p4.join(' ')+' A 173 173 0 0 0 '+p1.join(' ')+' Z';
};
const svgNode=(tag,attrs)=>{
 const el=document.createElementNS(svgNS,tag);
 Object.entries(attrs).forEach(([key,value])=>el.setAttribute(key,String(value)));
 return el;
};
const matching=m=> (filter==='全部'||m.group===filter)&&
 (!search||m.name.includes(search)||m.alias.includes(search)||m.group.includes(search));
function buildWheel(){
 mansions.forEach(m=>{
  const g=svgNode('g',{class:'sector',role:'button',tabindex:0,'aria-label':m.group+' '+m.alias+'宿','aria-pressed':'false','data-name':m.name});
  const path=svgNode('path',{d:sectorPath(m.index),fill:m.color});
  const angle=-90+(m.index+.5)*360/28,point=polar(232,angle);
  const text=svgNode('text',{x:point[0].toFixed(2),y:(point[1]+7).toFixed(2),'text-anchor':'middle'});
  text.textContent=m.name;
  const title=svgNode('title',{});title.textContent=m.group+' · '+m.alias+'宿';
  g.append(title,path,text);
  g.addEventListener('click',()=>selectMansion(m.name));
  g.addEventListener('keydown',event=>{
   if(event.key==='Enter'||event.key===' '){event.preventDefault();selectMansion(m.name);}
  });
  wheel.append(g);
 });
}
function renderList(){
 const list=byId('mansionList');list.replaceChildren();
 const visible=mansions.filter(matching);
 visible.forEach(m=>{
  const btn=document.createElement('button');
  btn.type='button';btn.textContent=m.name;btn.title=m.group+' '+m.alias+'宿';
  btn.setAttribute('aria-label',m.group+' '+m.alias+'宿');
  btn.setAttribute('aria-pressed',String(chosen===m));
  btn.addEventListener('click',()=>selectMansion(m.name));
  list.append(btn);
 });
 byId('searchEmpty').hidden=visible.length!==0;
 byId('wheelCenter').setAttribute('data-selected',chosen.name);
 byId('centerName').textContent=chosen.name;
 byId('centerQuad').textContent=chosen.group;
 for(const g of wheel.children){
  const m=mansions.find(item=>item.name===g.getAttribute('data-name'));
  g.setAttribute('aria-pressed',String(m===chosen));
  g.classList.toggle('filtered-out',!matching(m));
 }
 for(const b of byId('quadrantFilters').querySelectorAll('button')){
  b.setAttribute('aria-pressed',String(b.dataset.filter===filter));
 }
}
function renderDetail(){
 const m=chosen;
 byId('detailOrder').textContent=m.group+' · 第 '+m.groupPosition+' 宿';
 byId('detailCode').textContent=String(m.index+1).padStart(2,'0')+' / 28';
 byId('detailQuad').textContent=m.group;
 byId('detailTitle').textContent=m.name+'宿';
 byId('detailGlyph').textContent=m.name;
 byId('detailOfficer').textContent=m.alias;
 byId('detailAlias').textContent=m.name===m.alias?m.name:m.name+'（史記作「'+m.alias+'」）';
 byId('detailNearby').textContent=m.nearby;
 byId('detailEvidence').textContent=m.evidence;
 byId('detailQualification').textContent=m.quizAnswer?
 '本段是依《史記・天官書》整理的語義摘要，不是逐字引文；占候內容屬歷史材料，不表示今日可驗證的預測。':
 '目前僅採列名證據，不補造文獻未明言的職掌或星官。';
 byId('detailSource').href=SOURCE;
}
function makeQuestion(){
 const m=chosen;
 const useEvidence=questionIndex%2===0&&m.quizAnswer!==null;
 let prompt,answer,choices;
 if(useEvidence){
  prompt='依《史記・天官書》的記載，與「'+m.alias+'」宿相關的是哪一項？';
  answer=m.quizAnswer;
  const pool=mansions.filter(x=>x.quizAnswer!==null&&x.quizAnswer!==answer);
  const indexes=[m.index+5,m.index+11,m.index+19];
  const distractors=indexes.map(i=>pool[i%pool.length].quizAnswer);
  choices=[answer,...distractors];
 }else{
  prompt='「'+m.name+'」宿在二十八宿四象分類中屬於哪一象？';
  answer=m.group;
  choices=groups.map(g=>g.name);
 }
 // Deterministic rotation, while preserving four distinct answer choices.
 choices=[...new Set(choices)];
 if(choices.length!==4)throw Error('測驗選項資料重複，請檢查題庫。');
 const shift=(m.index+questionIndex)%4;
 choices=choices.slice(shift).concat(choices.slice(0,shift));
 return {prompt,answer,choices,explanation:useEvidence?m.evidence:m.group+'共含七宿；「'+m.name+'」位列其中。'};
}
function renderQuiz(){
 answered=false;
 const quiz=makeQuestion();
 byId('quizQuestion').textContent=quiz.prompt;
 byId('quizFeedback').textContent='';
 const options=byId('quizOptions');options.replaceChildren();
 quiz.choices.forEach((choice,i)=>{
  const button=document.createElement('button');
  button.type='button';
  button.textContent=String.fromCharCode(65+i)+' · '+choice;
  button.dataset.answer=choice;
  button.addEventListener('click',()=>{
   if(answered)return;
   answered=true;total++;
   const correct=choice===quiz.answer;
   if(correct)score++;
   for(const item of options.querySelectorAll('button')){
    item.disabled=true;
    if(item.dataset.answer===quiz.answer)item.classList.add('correct');
    else if(item===button)item.classList.add('wrong');
   }
   byId('quizFeedback').textContent=(correct?'答對了。':'尚未答對，正確答案是「'+quiz.answer+'」。')+' '+quiz.explanation;
   byId('quizScore').textContent='本次 '+score+' / '+total+' 題答對';
  });
  options.append(button);
 });
}
function selectMansion(name){
 const next=mansions.find(m=>m.name===name||m.alias===name);
 if(!next)return;
 chosen=next;questionIndex=0;
 renderList();renderDetail();renderQuiz();
 const url=new URL(window.location.href);
 url.searchParams.set('m',chosen.name);
 window.history.replaceState(null,'',url.pathname+url.search+url.hash);
}
byId('quadrantFilters').addEventListener('click',event=>{
 const button=event.target.closest('button[data-filter]');
 if(!button)return;
 filter=button.dataset.filter;
 renderList();
});
byId('mansionSearch').addEventListener('input',event=>{
 search=event.target.value.trim();
 renderList();
});
byId('nextQuiz').addEventListener('click',()=>{
 questionIndex++;renderQuiz();
});
buildWheel();
const params=new URLSearchParams(window.location.search);
selectMansion(params.get('m')||mansions[0].name);
})();
