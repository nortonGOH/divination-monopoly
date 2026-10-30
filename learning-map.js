/* Independent, editorial learning curriculum.
 * Do not read the quiz bank or any scoring, membership or server state.
 * Reading markers are opt-in local-device notes, not formal examination scores.
 */
(() => {
  'use strict';
  const rootData=window.NUMEROLOGY_CURRICULUM;
  const anchor=document.getElementById('guestbook');
  if(!anchor||document.getElementById('learningMap'))return;
  const el=(tag,content='',cls='')=>{
    const node=document.createElement(tag);
    node.textContent=content;
    if(cls)node.className=cls;
    return node;
  };
  const fallback=el('section','','learn-map');
  fallback.id='learningMap';
  if(!rootData||!Array.isArray(rootData.topics)||!Array.isArray(rootData.mansions)
    ||!rootData.sources||typeof rootData.sources!=='object'){
    fallback.append(el('h2','數術知識學習地圖'),el('p','獨立教材尚未成功載入，請重新整理頁面。'));
    anchor.before(fallback);
    return;
  }
  const topics=rootData.topics, mansions=rootData.mansions;
  const full=[...topics,...mansions];
  const ids=new Set(full.map(x=>x.id));
  if(ids.size!==full.length||full.some(x=>!x.id||!x.title||!Array.isArray(x.points))){
    fallback.append(el('h2','數術知識學習地圖'),el('p','教材資料的單元識別碼或結構有誤，請檢查教材檔案。'));
    anchor.before(fallback);
    return;
  }
  const css=el('style');
  css.textContent=[
    '.learn-map{margin:26px 0 28px;padding:25px;border:1px solid #cfc3a8;border-radius:18px;background:linear-gradient(130deg,#fffcf4,#f0e7d8);box-shadow:0 8px 24px #473e2710}',
    '.learn-map *{box-sizing:border-box}',
    '.learn-map-head{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:18px}',
    '.learn-map-kicker{font-weight:700;font-size:.75rem;letter-spacing:.19em;color:#8a6f3d;margin:0 0 8px}',
    '.learn-map h2{margin:0;font-size:clamp(1.35rem,2.5vw,1.8rem);letter-spacing:.06em}',
    '.learn-map-intro{max-width:700px;font-size:.88rem;color:#50616a;line-height:1.85;margin:9px 0}',
    '.learn-map-meter{background:#fffcf5;border:1px solid #daceb6;border-radius:12px;padding:13px 15px;min-width:220px;flex:1;max-width:300px}',
    '.learn-map-meter strong{display:block;font-size:.89rem}',
    '.learn-map-track,.learn-map-node-track{height:8px;border-radius:99px;background:#e2e6df;overflow:hidden;margin-top:10px}',
    '.learn-map-fill,.learn-map-node-fill{height:100%;background:#447c6c;border-radius:99px;width:0;display:block}',
    '.learn-map-tabs{display:flex;gap:9px;flex-wrap:wrap;margin:18px 0}',
    '.learn-map-tabs button{font:inherit;cursor:pointer;padding:10px 15px;background:#fffdf5;color:#3b4a50;border:1px solid #cbbb9e;border-radius:10px}',
    '.learn-map-tabs button[aria-pressed=true]{background:#244e4a;color:#fff;border-color:#244e4a}',
    '.learn-map-body{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(320px,1fr);gap:17px;align-items:start}',
    '.learn-map-path{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;align-content:start}',
    '.learn-map-path-heading{grid-column:1/-1;margin:10px 0 0;border-bottom:1px solid #dfd2b8;padding:7px 0;font-size:.95rem;color:#416259}',
    '.learn-map-node{display:flex;flex-direction:column;gap:9px;min-width:0;text-align:left;min-height:132px;background:#fffef9;border:1px solid #d3c6af;border-radius:13px;padding:13px 14px;color:#263b42;font:inherit;cursor:pointer}',
    '.learn-map-node:hover,.learn-map-node:focus-visible{border-color:#8e6c3c;box-shadow:0 4px 13px #54482922}',
    '.learn-map-node[aria-pressed=true]{border:2px solid #417866;background:#edf7ef}',
    '.learn-map-node-top{display:flex;justify-content:space-between;align-items:center;gap:8px}',
    '.learn-map-node-group{font-size:.71rem;color:#886a3e}',
    '.learn-map-node-number{background:#ede3d0;border-radius:100px;min-width:31px;height:31px;display:grid;place-items:center;font:700 .8rem system-ui,sans-serif}',
    '.learn-map-node strong{font-size:.94rem}',
    '.learn-map-node-desc{font-size:.77rem;line-height:1.55;color:#65706d;flex:1}',
    '.learn-map-node-meta{font-size:.75rem;color:#3f7561;font-weight:600}',
    '.learn-map-detail{min-width:0;background:#fffdf8;border:1px solid #d3c29f;border-radius:13px;padding:20px;position:sticky;top:12px;max-height:88vh;overflow:auto}',
    '.learn-map-detail h3{font-size:1.25rem;line-height:1.45;margin:6px 0 13px}',
    '.learn-map-detail h4{font-size:.93rem;color:#345d58;margin:18px 0 6px}',
    '.learn-map-detail p,.learn-map-detail li{font-size:.85rem;line-height:1.85;color:#44545b}',
    '.learn-map-detail ul{padding-left:22px;margin:6px 0}',
    '.learn-map-detail-label{font-size:.72rem!important;color:#927040!important;font-weight:700;letter-spacing:.09em;margin:0}',
    '.learn-map-notice{background:#f6f0e4;border-left:3px solid #bd9350;padding:10px 12px;border-radius:3px}',
    '.learn-map-action{display:block;width:100%;background:#245b54;color:#fff;font:inherit;font-weight:700;cursor:pointer;border:0;border-radius:9px;padding:12px;margin-top:16px}',
    '.learn-map-action[aria-pressed=true]{background:#e5f2ec;color:#245b54;border:1px solid #568f79}',
    '.learn-map-sources{display:grid;gap:7px;margin:10px 0 0}',
    '.learn-map-sources a,.learn-map-atlas{display:block;font-size:.83rem;color:#1c6868;line-height:1.7;overflow-wrap:anywhere}',
    '.learn-map-disclaimer{border-top:1px solid #dbcfb8;margin:20px 0 0;padding-top:13px;font-size:.78rem;color:#65716e;line-height:1.8}',
    '.learn-map-status{font-size:.8rem;color:#446b60;margin:9px 0;min-height:1.5em}',
    '@media(max-width:880px){.learn-map-body{grid-template-columns:1fr}.learn-map-detail{position:static;max-height:none}.learn-map-meter{max-width:none}}',
    '@media(max-width:550px){.learn-map{padding:14px}.learn-map-path{grid-template-columns:1fr}.learn-map-node{min-height:110px}.learn-map-detail{padding:14px}}'
  ].join('\n');
  document.head.append(css);

  const STORAGE_KEY='numerology-standalone-learning-reading-v1';
  let saved=new Set(),canSave=true;
  try {
    const parsed=JSON.parse(window.localStorage.getItem(STORAGE_KEY)||'[]');
    if(Array.isArray(parsed))saved=new Set(parsed.filter(id=>typeof id==='string'&&ids.has(id)));
  } catch (_) {canSave=false; }
  function persist(){
    try{window.localStorage.setItem(STORAGE_KEY,JSON.stringify([...saved]));canSave=true;return true;}
    catch(_){canSave=false;return false;}
  }
  const root=el('section','','learn-map');root.id='learningMap';root.setAttribute('aria-labelledby','learningMapTitle');
  const head=el('header','','learn-map-head');
  const intro=el('div');
  intro.append(el('p','INDEPENDENT STUDY CURRICULUM','learn-map-kicker'));
  const title=el('h2','數術知識學習地圖');title.id='learningMapTitle';intro.append(title);
  intro.append(el('p','獨立撰寫的數術知識導讀：經典、書目分類、天文史、傳統技術與二十八宿。所有教材都來自本課程資料檔，與遊戲題庫、答題成績及文昌點數完全分開。','learn-map-intro'));
  const meter=el('div','','learn-map-meter');
  const meterLabel=el('strong','已閱讀 0／'+full.length+' 單元');
  const meterTrack=el('div','','learn-map-track');meterTrack.setAttribute('role','progressbar');
  meterTrack.setAttribute('aria-label','教材閱讀標記進度');
  meterTrack.setAttribute('aria-valuemin','0');meterTrack.setAttribute('aria-valuemax','100');
  const meterFill=el('span','','learn-map-fill');meterTrack.append(meterFill);meter.append(meterLabel,meterTrack);
  head.append(intro,meter);

  const tabs=el('nav','','learn-map-tabs');tabs.setAttribute('aria-label','學習地圖分區');
  const tabTopics=el('button','數術專題 11 單元'),tabMansions=el('button','四象二十八宿 28 單元');
  tabTopics.id='learn-map-tab-topics';tabMansions.id='learn-map-tab-mansions';
  tabTopics.type=tabMansions.type='button';
  tabs.append(tabTopics,tabMansions);
  const body=el('div','','learn-map-body');
  const path=el('div','','learn-map-path'),detail=el('article','','learn-map-detail');
  detail.setAttribute('aria-live','polite');
  body.append(path,detail);
  const status=el('p','','learn-map-status');status.setAttribute('role','status');
  const disclaimer=el('p','教材摘要為編輯性研究提要，不是逐字古籍引文。路徑排序是現代教學安排，不代表數術史存在單一發展階段。閱讀標記只儲存在目前瀏覽器，不登入也可以閱讀；不會改變會員紀錄、救援點數或排行榜。','learn-map-disclaimer');
  root.append(head,tabs,body,status,disclaimer);
  anchor.before(root);

  let route='topics',selected=topics[0].id;
  tabTopics.addEventListener('click',()=>{route='topics';selected=topics[0].id;render();});
  tabMansions.addEventListener('click',()=>{route='mansions';selected=mansions[0].id;render();});

  function renderNode(lesson,index){
    const btn=el('button','','learn-map-node');
    btn.type='button';btn.dataset.lessonId=lesson.id;
    btn.setAttribute('aria-pressed',String(selected===lesson.id));
    const top=el('div','','learn-map-node-top');
    top.append(el('span',lesson.group,'learn-map-node-group'),
      el('span',String(index+1).padStart(2,'0'),'learn-map-node-number'));
    const p=el('div','','learn-map-node-track');
    const fill=el('span','','learn-map-node-fill');fill.style.width=saved.has(lesson.id)?'100%':'0%';p.append(fill);
    btn.append(top,el('strong',lesson.title),el('span',lesson.lead,'learn-map-node-desc'),
      el('span',saved.has(lesson.id)?'✓ 已標記閱讀':'尚未標記閱讀','learn-map-node-meta'),p);
    btn.addEventListener('click',()=>{
      selected=lesson.id;render();
      [...path.querySelectorAll('button')].find(x=>x.dataset.lessonId===selected)?.focus({preventScroll:true});
    });
    path.append(btn);
  }
  function renderDetail(lesson){
    detail.replaceChildren();
    detail.append(el('p',lesson.group+'・獨立教材','learn-map-detail-label'),el('h3',lesson.title),
      el('p',lesson.lead));
    detail.append(el('h4','學習重點'));
    const ul=el('ul');
    lesson.points.forEach(point=>ul.append(el('li',point)));
    detail.append(ul);
    detail.append(el('h4','史料與研究方法'),el('p',lesson.method));
    detail.append(el('h4','值得思考的問題'),el('p',lesson.question));
    detail.append(el('h4','證據界線'),el('p',lesson.caution,'learn-map-notice'));
    detail.append(el('h4','參考來源'));
    const sources=el('div','','learn-map-sources');
    lesson.sources.forEach(key=>{
      const source=rootData.sources[key];if(!source||!/^https:\/\//.test(source.url))return;
      const link=el('a',source.label+'（'+source.type+'）');
      link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';
      sources.append(link);
    });
    detail.append(sources);
    if(lesson.atlasName){
      const atlas=el('a','延伸：開啟「'+lesson.atlasName+'宿」互動圖鑑','learn-map-atlas');
      atlas.href='./mansions-atlas.html?m='+encodeURIComponent(lesson.atlasName);
      detail.append(atlas);
    }
    const mark=el('button',saved.has(lesson.id)?'✓ 已閱讀（點擊取消標記）':'閱讀後標記本單元','learn-map-action');
    mark.type='button';mark.setAttribute('aria-pressed',String(saved.has(lesson.id)));
    mark.addEventListener('click',()=>{
      if(saved.has(lesson.id))saved.delete(lesson.id);else saved.add(lesson.id);
      const ok=persist();render();
      status.textContent=ok?'已儲存此裝置的閱讀標記；不會改動任何正式答題資料。':
        '目前瀏覽器無法儲存；本頁仍可使用閱讀標記，重新載入後可能消失。';
    });
    detail.append(mark);
  }
  function render(){
    const list=route==='topics'?topics:mansions;
    if(!list.some(x=>x.id===selected))selected=list[0].id;
    tabTopics.setAttribute('aria-pressed',String(route==='topics'));
    tabMansions.setAttribute('aria-pressed',String(route==='mansions'));
    const progress=full.filter(x=>saved.has(x.id)).length;
    const pct=Math.round(100*progress/full.length);
    meterLabel.textContent='獨立教材：已標記閱讀 '+progress+'／'+full.length+' 單元';
    meterFill.style.width=pct+'%';meterTrack.setAttribute('aria-valuenow',String(pct));
    meterTrack.setAttribute('aria-valuetext','已標記閱讀 '+progress+'／'+full.length+' 單元');
    path.replaceChildren();let lastGroup='';
    list.forEach((lesson,index)=>{
      if(lesson.group!==lastGroup){
        path.append(el('h3',lesson.group,'learn-map-path-heading'));
        lastGroup=lesson.group;
      }
      renderNode(lesson,index);
    });
    renderDetail(list.find(x=>x.id===selected));
    if(!canSave)status.textContent='本瀏覽器可能無法儲存閱讀進度；教材內容仍可正常使用。';
  }
  render();
})();
