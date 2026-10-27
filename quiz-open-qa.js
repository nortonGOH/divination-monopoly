/* 開放式數術問答插件：與現有四選一題庫並存。原 Google 文件參考答案待學術核校。 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const mansionOrder = ['角木蛟','亢金龍','氐土貉','房日兔','心月狐','尾火虎','箕水豹','斗木獬','牛金牛','女土蝠','虛日鼠','危月燕','室火豬','壁水貐','奎木狼','婁金狗','胃土雉','昴日雞','畢月烏','觜火猴','參水猿','井木犴','鬼金羊','柳土獐','星日馬','張月鹿','翼火蛇','軫水蚓'];
  const fields = 'id,source_question_no,difficulty,category,mansion,prompt,reference_answer,source_title,source_url,review_status';
  const configured = Boolean(window.QUIZ_AUTH_CONFIG?.supabaseUrl && window.QUIZ_AUTH_CONFIG?.publishableKey);
  const isAdmin = () => typeof adminAccessToken !== 'undefined' && Boolean(adminAccessToken);
  const api = async (route, options={}, requireAuth=false) => {
    if (typeof cloudCall !== 'function') throw new Error('網站尚未載入 Supabase 連接程式');
    return cloudCall(route,options,requireAuth);
  };
  let rows=[], sourceLabel='尚未載入', active=null, activeId=null, reviewed=0, known=0, editorId=null;
  const make = (tag, name, text) => {
    const el=document.createElement(tag);
    if(name)el.className=name;
    if(text!==undefined)el.textContent=text;
    return el;
  };
  const setStatus = message => { if ($('openQaAdminStatus')) $('openQaAdminStatus').textContent=message; };
  const sheet = make('style');
  sheet.textContent=`
    #openQaChallenge{margin-top:20px;padding:18px;border:1px solid var(--stroke,#d9cfb9);border-radius:16px;background:rgba(255,255,255,.45)}
    #openQaChallenge h4{font-size:1.08rem;margin:.6rem 0;font-weight:700}
    #openQaChallenge .qa-tag{font-size:.75rem;color:var(--jade,#376d64);letter-spacing:.02em}
    #openQaChallenge .qa-copy{white-space:pre-wrap;line-height:1.85;margin:12px 0;background:#fffaf0;padding:14px;border-radius:8px;border-left:3px solid #b08548}
    #openQaChallenge .qa-hint{font-size:.78rem;line-height:1.65;color:var(--muted,#68717a);margin:8px 0}
    #openQaChallenge .qa-controls{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}
    #openQaChallenge button,#openQaManager button{cursor:pointer;border:1px solid #cebfa1;border-radius:8px;padding:8px 12px;background:#fffaf0;color:#26313a;font:inherit}
    #openQaChallenge button:hover,#openQaManager button:hover{background:#efe2c8}
    #openQaManager{border-top:2px solid #cbb890;margin-top:26px;padding-top:20px}
    #openQaManager h3{margin:0 0 10px;font-size:1.25rem}
    #openQaManager .qa-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    #openQaManager label{display:flex;flex-direction:column;gap:5px;font-size:.86rem;color:#4f514f;margin:8px 0}
    #openQaManager input,#openQaManager textarea,#openQaManager select{width:100%;padding:9px;background:#fff;border:1px solid #cabda4;border-radius:8px;font:inherit;color:#26313a}
    #openQaManager textarea{min-height:78px;resize:vertical}
    #openQaManager .qa-list{max-height:250px;overflow:auto;border:1px solid #d9cfb9;border-radius:8px;margin:8px 0}
    #openQaManager .qa-item{padding:10px;border-bottom:1px solid #eee4d3;display:flex;align-items:start;justify-content:space-between;gap:10px}
    #openQaManager .qa-item .qa-actions{display:flex;gap:5px;flex-shrink:0}
    #openQaManager .qa-muted{color:#68717a;font-size:.78rem;line-height:1.6}
    #openQaAdminStatus{margin-top:12px;white-space:pre-wrap}
    @media(max-width:640px){#openQaManager .qa-grid{grid-template-columns:1fr}#openQaManager .qa-item{flex-direction:column}}
  `;
  document.head.appendChild(sheet);

  const quizSection=document.querySelector('.quiz-section');
  if(!quizSection || !$('bankDialog'))return;
  const challenge=make('section');challenge.id='openQaChallenge';challenge.setAttribute('aria-label','開放式數術問答');
  const eyebrow=make('div','qa-tag','OPEN QUESTION · Google 文件 60 題');
  const head=make('h4','', '數術深究 · 開放問答');
  const meta=make('div','qa-hint','正在載入…');meta.id='openQaMeta';
  const prompt=make('p','', '正在讀取開放式問答題庫…');prompt.id='openQaPrompt';
  const answer=make('div','qa-copy');answer.id='openQaAnswer';answer.hidden=true;
  const actions=make('div','qa-controls');
  const reveal=make('button','', '顯示來源答案');reveal.type='button';
  const next=make('button','', '換一道問答 ↻');next.type='button';
  const mastery=make('button','', '✓ 已掌握');mastery.type='button';mastery.hidden=true;
  const retry=make('button','', '↻ 待複習');retry.type='button';retry.hidden=true;
  const notice=make('p','qa-hint','題目與二十八宿的分配是遊戲設計；文件答案保持原文，尚未逐題學術考證。');
  actions.append(reveal,next,mastery,retry);
  challenge.append(eyebrow,head,meta,prompt,answer,actions,notice);
  quizSection.appendChild(challenge);
  const mansionFromWheel=() => ($('quizScope')?.textContent||'').split('：').pop().trim();
  function showCurrent(){
    const mansion=mansionFromWheel();
    const subset=rows.filter(q=>q.mansion===mansion);
    answer.hidden=true;mastery.hidden=true;retry.hidden=true;reveal.hidden=false;
    if(!subset.length){active=null;meta.textContent=`${sourceLabel} · ${mansion} 尚無開放題`;prompt.textContent='請旋轉圓盤或前往管理題庫新增問答。';reveal.disabled=true;next.disabled=true;return;}
    const choices=subset.filter(q=>q.id!==activeId);
    const pool=choices.length?choices:subset;
    active=pool[Math.floor(Math.random()*pool.length)];activeId=active.id;
    reveal.disabled=false;next.disabled=false;
    meta.textContent=`${active.difficulty} · ${active.category} · ${mansion} · 本宿 ${subset.length} 題 · ${sourceLabel} · 已複習 ${reviewed} / 已掌握 ${known}`;
    prompt.textContent=active.prompt;
    answer.textContent=`原文件參考答案（${active.review_status||'待考'}）\n${active.reference_answer}\n\n出處：${active.source_title||'管理員自訂題目'}${active.source_question_no?'，第 '+active.source_question_no+' 題':''}`;
  }
  reveal.addEventListener('click',()=>{if(!active)return;answer.hidden=false;mastery.hidden=false;retry.hidden=false;reveal.hidden=true;});
  const mark=ok=>{if(!active)return;reviewed++;if(ok)known++;showCurrent();};
  mastery.addEventListener('click',()=>mark(true));retry.addEventListener('click',()=>mark(false));next.addEventListener('click',showCurrent);
  if($('quizScope'))new MutationObserver(showCurrent).observe($('quizScope'),{childList:true,subtree:true,characterData:true});
  const normalize = item => ({
    id:String(item.id||''),source_question_no:item.source_question_no===null?null:Number(item.source_question_no),
    difficulty:String(item.difficulty||'自訂'),category:String(item.category||'其他'),
    mansion:String(item.mansion||'角木蛟'),prompt:String(item.prompt||''),reference_answer:String(item.reference_answer||''),
    source_title:String(item.source_title||''),source_url:String(item.source_url||''),review_status:String(item.review_status||'待考')
  });
  async function refresh(){
    try {
      if(configured){
        const data=await api(`/rest/v1/quiz_open_questions?select=${fields}&order=source_question_no.asc.nullslast,id.asc&limit=3000`);
        if(!Array.isArray(data))throw new Error('題庫格式不符合預期');
        rows=data.map(normalize);sourceLabel='Supabase 開放式題庫';
      }else throw new Error('尚未啟用 Supabase');
    } catch(error){
      const resp=await fetch('./qa-source-60.json',{cache:'no-store'});
      if(!resp.ok){rows=[];sourceLabel='無法載入';meta.textContent='讀取失敗：'+error.message;return;}
      const obj=await resp.json();rows=(obj.questions||[]).map(normalize);
      sourceLabel='GitHub 示範題（需執行 SQL 才能雲端編輯）';
    }
    showCurrent();renderManager();
  }

  // 同一個管理員視窗內管理新增開放題；所有寫入由 Supabase RLS 判定，不是前端判定授權。
  const manager=make('section');manager.id='openQaManager';
  const mh=make('h3','', '開放式問答題庫管理');
  const descr=make('p','qa-muted','與原四選一題庫並存。原 Google 文件 60 題採問答形式，未自動生成干擾選項。修改內容直接送往 Supabase；尚未建立資料表時只能預覽。');
  const search=make('input');search.type='search';search.placeholder='搜尋問句、主題與參考答案';search.setAttribute('aria-label','搜尋開放題');
  const count=make('div','qa-muted');
  const list=make('div','qa-list');
  const form=make('form');form.id='openQaForm';
  const grid=make('div','qa-grid');
  const control=(label,element)=>{const l=make('label','',label);l.appendChild(element);return l;};
  const mansion=make('select');mansionOrder.forEach(n=>{const o=make('option','',n);o.value=n;mansion.append(o);});
  const difficulty=make('select');['初階','高階','自訂'].forEach(n=>{const o=make('option','',n);o.value=n;difficulty.append(o);});
  const category=make('input');category.maxLength=120;category.required=true;
  const question=make('textarea');question.maxLength=1000;question.required=true;
  const reference=make('textarea');reference.maxLength=12000;reference.required=true;reference.rows=6;
  const status=make('select');['待考','已核校'].forEach(n=>{const o=make('option','',n);o.value=n;status.append(o);});
  const sourceTitle=make('input');const sourceNo=make('input');sourceNo.type='number';sourceNo.min='1';
  grid.append(control('對應星宿（僅為遊戲分組）',mansion),control('難度',difficulty),control('分類／主題',category),control('校核狀態',status));
  form.append(grid,control('問句',question),control('來源稿參考答案',reference));
  const extra=make('div','qa-grid');extra.append(control('來源文件名',sourceTitle),control('來源題號（可留空）',sourceNo));form.append(extra);
  const save=make('button','', '新增開放題');save.type='submit';
  const clear=make('button','', '清空編輯器');clear.type='button';
  const actions2=make('div','qa-controls');actions2.append(save,clear);form.append(actions2);
  const msg=make('p','qa-muted');msg.id='openQaAdminStatus';msg.setAttribute('role','status');
  manager.append(mh,descr,search,count,list,form,msg);
  $('bankDialog').querySelector('.bank-content')?.insertAdjacentElement('afterend',manager);
  const resetForm=()=>{editorId=null;form.reset();save.textContent='新增開放題';mansion.value=mansionFromWheel()||'角木蛟';difficulty.value='自訂';category.value='其他';status.value='待考';};
  clear.addEventListener('click',resetForm);
  function renderManager(){
    if(!list)return;
    list.replaceChildren();
    const queryText=search.value.trim().toLocaleLowerCase();
    const filtered=rows.filter(r=>[r.prompt,r.reference_answer,r.category,r.mansion].join(' ').toLocaleLowerCase().includes(queryText));
    count.textContent=`開放式題目 ${filtered.length} / ${rows.length} 題 · ${sourceLabel}`;
    filtered.forEach(row=>{
      const item=make('div','qa-item');
      const brief=make('div','',`${row.difficulty} · ${row.category} · ${row.mansion}｜${row.prompt}`);
      const bwrap=make('div','qa-actions');
      const edit=make('button','', '編輯');edit.type='button';
      edit.addEventListener('click',()=>{
        editorId=row.id;save.textContent='儲存修改';mansion.value=row.mansion;difficulty.value=row.difficulty;
        category.value=row.category;question.value=row.prompt;reference.value=row.reference_answer;
        status.value=row.review_status;sourceTitle.value=row.source_title||'';sourceNo.value=row.source_question_no||'';
        question.focus();form.scrollIntoView({block:'nearest'});
      });
      const remove=make('button','', '刪除');remove.type='button';
      remove.addEventListener('click',async()=>{
        if(!isAdmin()){setStatus('請先登入授權管理員');return;}
        if(!confirm(`確定刪除「${row.prompt}」？`))return;
        try{await api('/rest/v1/quiz_open_questions?id=eq.'+encodeURIComponent(row.id),{method:'DELETE'},true);await refresh();setStatus('已刪除題目。');}
        catch(e){setStatus('刪除失敗：'+e.message);}
      });
      bwrap.append(edit,remove);item.append(brief,bwrap);list.append(item);
    });
  }
  search.addEventListener('input',renderManager);
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!isAdmin()){setStatus('請先登入授權管理員。');return;}
    const payload={
      id:editorId||`open-custom-${(crypto.randomUUID?.()||Date.now().toString(36))}`,
      source_question_no:sourceNo.value?Number(sourceNo.value):null,
      difficulty:difficulty.value,category:category.value.trim(),mansion:mansion.value,
      prompt:question.value.trim(),reference_answer:reference.value.trim(),
      source_title:sourceTitle.value.trim(),source_url:editorId?(rows.find(x=>x.id===editorId)?.source_url||''):'',review_status:status.value
    };
    if(!payload.prompt||!payload.reference_answer){setStatus('請填完整問句與參考答案。');return;}
    save.disabled=true;
    try{
      await api('/rest/v1/quiz_open_questions?on_conflict=id',{method:'POST',headers:{'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([payload])},true);
      await refresh();resetForm();setStatus('已儲存至 Supabase 開放題庫。');
    }catch(e){setStatus('儲存失敗：'+e.message);}
    finally{save.disabled=false;}
  });
  // Modal 的管理介面本身仍由既有登入程序管制；資料庫 RLS 才是最後權限界線。
  resetForm();
  refresh().catch(err=>{meta.textContent='題庫載入失敗：'+err.message;});
})();
