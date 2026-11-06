/* Three Sections and Eight Scenes: 24 body-spirit atlas.
 * Primary source: Yunji Qiqian, juan 31, "Taiwei Dijun ... Ershisi Shen Huiyuan Jing".
 * Historical, source-based reading aid only; DOES NOT replace the 28-mansion quiz.
 */
(()=>{
'use strict';
const host=document.getElementById('adventureJourney');
const scene=host?.querySelector('.adventure-map-scene');
const heading=document.getElementById('adventureHeading');
const kicker=host?.querySelector('.adventure-kicker');
const description=host?.querySelector('.adventure-description');
if(!host||!scene||!heading)return;
const source='https://zh.wikisource.org/zh-hant/%E9%9B%B2%E7%AC%88%E4%B8%83%E7%B1%A4/31';
const groups=[
 {part:'上部八景',subtitle:'頭面與上身',id:'upper',items:[
  ['腦神','覺元子','道都','形長一寸一分；色正白'],
  ['髮神','玄文華','道衡','形長二寸一分；色玄'],
  ['皮膚神','通眾仲','道連','形長一寸五分；色黃'],
  ['目神','虛監生','道童','形長三寸六分；衣五色'],
  ['項髓神','靈謨蓋','道周','形長五寸；色白素衣'],
  ['膂神','益歷輔','道柱','形長三寸；半白玉素衣'],
  ['鼻神','沖龍玉','道微','形長二寸五分；青白黃色衣'],
  ['舌神','始梁峙','道歧','形長七寸；正赤色']
 ]},
 {part:'中部八景',subtitle:'臟腑與氣機',id:'middle',items:[
  ['喉神','百流放','道通','形長八寸八分；九色衣'],
  ['肺神','素靈生','道平','形長八寸一分；純白'],
  ['心神','煥陽昌','道明','形長九寸；色赤'],
  ['肝神','開君童','道青','形長六寸；色青黃'],
  ['膽神','龍德拘','道放','形長三寸六分；色青黃綠'],
  ['左腎神','春元真','道卿','形長三寸七分；數變白赤青五色無常'],
  ['右腎神','象地無','道生','形長三寸五分；色白或黑'],
  ['脾神','寶元全','道騫','形長七寸三分；色正黃']
 ]},
 {part:'下部八景',subtitle:'內腑與陰陽',id:'lower',items:[
  ['胃神','同來育','道展','形長七寸；色黃'],
  ['窮腸中神','兆滕康','道還','形長二寸四分；黃赤色'],
  ['大小腸中神','蓬送留','道廚','形長二寸一分；色赤黃'],
  ['胴中神','受厚勃','道虛','形長九寸一分；九色衣'],
  ['胸膈神','廣瑛宅','道仲','形長五寸；色白'],
  ['兩脅神','闢假馬','道成','形長四寸一分；赤白色'],
  ['左陰左陽神','扶流起','道圭','形長二寸三分；青黃白色；男存左陽、女存左陰'],
  ['右陰右陽神','苞表明','道生','形長二寸三分；青黃白色；男存右陽、女存右陰']
 ]}
];
const make=(tag,value='',cls='')=>{const node=document.createElement(tag);node.textContent=value;if(cls)node.className=cls;return node;};
const atlas=make('div','','dao-body-atlas');
atlas.setAttribute('aria-label','三部八景二十四神身神地圖');
const notice=make('p','上、中、下三部各八景，共二十四神。點擊身神可查看經文記載；中央北斗圓盤仍屬原有二十八宿抽題遊戲。','dao-body-notice');
atlas.append(notice);
const dialog=document.createElement('dialog');dialog.className='dao-spirit-dialog';dialog.id='daoSpiritDialog';dialog.setAttribute('aria-labelledby','daoSpiritTitle');
const header=make('div','','dao-spirit-dialog-head');
const title=make('h2','','');title.id='daoSpiritTitle';
const close=make('button','關閉','dao-spirit-close');close.type='button';close.addEventListener('click',()=>dialog.close());
header.append(title,close);
const details=make('div','','dao-spirit-details');
const footer=make('p','','dao-spirit-reference');
const link=make('a','查看《雲笈七籤》卷三十一原文');link.href=source;link.target='_blank';link.rel='noopener noreferrer';footer.append(link);
dialog.append(header,details,footer);document.body.append(dialog);
dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
let serial=0;
for(const group of groups){
 const layer=make('section','','dao-body-layer');layer.dataset.part=group.id;
 const label=make('div','','dao-layer-heading');
 label.append(make('strong',group.part),make('small',group.subtitle+' · 八位身神'));
 layer.append(label);
 const grid=make('div','','dao-layer-grid');
 group.items.forEach(([place,name,zi,appearance],j)=>{
  const index=++serial;
  const button=make('button','','dao-spirit-node');button.type='button';
  button.dataset.part=group.id;
  button.setAttribute('aria-label',group.part+'第'+(j+1)+'景，'+place+'，名'+name+'，開啟文獻資料');
  button.append(make('span',String(index).padStart(2,'0'),'dao-spirit-index'),make('strong',place),make('small',name));
  button.addEventListener('click',()=>{
   title.textContent=group.part+' · '+place;
   details.replaceChildren();
   for(const [key,value] of [['部位',place],['神名',name],['字',zi],['形色',appearance],['經文分部',group.part]]){
    const row=make('p');row.append(make('strong',key+'：'),document.createTextNode(value));details.append(row);
   }
   details.append(make('p','以上名目、字號與形色據《雲笈七籤》卷三十一所載。這是經典文本中的存思身神體系，不是現代解剖學或醫療建議。','dao-spirit-disclaimer'));
   if(!dialog.open)dialog.showModal();
  });
  grid.append(button);
 });
 layer.append(grid);atlas.append(layer);
}
const foot=make('p','','dao-body-source');
foot.append(document.createTextNode('文獻底本：《雲笈七籤》卷三十一〈太微帝君太一造形紫元內二十四神回元經〉。本圖為文獻索引，區位排列為現代視覺設計，不主張復原古代原圖。'));
atlas.append(foot);
scene.append(atlas);
const original={heading:heading.textContent,kicker:kicker?.textContent,description:description?.textContent};
const apply=()=>{
 const isMap=host.dataset.layout==='map';
 if(isMap){
  heading.textContent='道教三部八景・二十四神存思地圖';
  if(kicker)kicker.textContent='上部八景 · 中部八景 · 下部八景';
  if(description)description.textContent='依《雲笈七籤》卷三十一建置二十四位身神的文獻互動索引；點擊節點查看神名、字、形色與經典來源。北斗圓盤維持原有二十八宿測驗功能，兩者不作歷史上的直接對應。';
 }else{
  heading.textContent=original.heading;
  if(kicker)kicker.textContent=original.kicker;
  if(description)description.textContent=original.description;
  if(dialog.open)dialog.close();
 }
};
new MutationObserver(apply).observe(host,{attributes:true,attributeFilter:['data-layout']});
apply();
})();