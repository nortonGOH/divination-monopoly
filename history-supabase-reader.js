/*
 * 二十四史站內閱覽器（Supabase 安全讀取插件）
 * 使用範圍：nortonGOH/divination-monopoly 第四版及其衍生版。
 * 無需重寫二十八宿圓盤／題庫；先執行 history_reader_rls.sql。
 * 僅使用 config.js 中的可公開 Project URL 與 publishable key。
 * 僅已列入 quiz_admins 的 Supabase Auth 帳號可查閱史料全文。
 * 不將密碼與 access token 存入 localStorage / GitHub。
 */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const need = ['libraryDialog','libraryText','libraryBook','libraryChapter',
    'librarySearch','librarySearchBtn','libraryMeta','historyLink','libraryOpenBtn'];
  if (need.some(id => !$(id))) {
    console.error('史料閱覽插件：頁面缺少閱覽室元素，請確認 index.html 版本。');
    return;
  }
  const cfg = window.QUIZ_AUTH_CONFIG || {};
  const api = String(cfg.supabaseUrl || '').trim().replace(/\/$/, '');
  const key = String(cfg.publishableKey || '').trim();
  const ready = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(api) && key.length > 15;
  const state = { token: null, userId: null, books: [], sections: [], book: null, section: null,
    offset: 0, search: '', count: 0, total: 0, requestSeq: 0, pendingRef: null };
  const PER_PAGE = 200;
  const MAX_SEARCH = 100;

  // 首頁史料卡片預設隱藏：只保留獨立文獻庫入口。
  const style = document.createElement('style');
  style.textContent = `
    .history-panel[hidden]{display:none!important}
    #libraryStandaloneBtn{margin:0 0 14px;border:1px solid #cbb797;border-radius:9px;background:#fffaf0;color:#5a4b36;padding:9px 15px;font:inherit;cursor:pointer}
    #libraryStandaloneBtn:hover{background:#eee2cf}
    .history-editor-tools{padding:12px 24px;background:#fffaf0;display:flex;gap:12px;flex-wrap:wrap;align-items:center;border-bottom:1px solid #e2d5be}
    .history-editor-tools button,.history-edit-panel button,.history-paragraph button{border:1px solid #c9b89b;border-radius:7px;background:#fffdf7;color:#60513d;padding:6px 10px;cursor:pointer;font:inherit;font-size:.78rem}
    .history-editor-help{font-size:.76rem;color:#716a5e;line-height:1.7}
    .history-para-block{position:relative;border-bottom:1px dashed #e7dcc8;padding:7px 0 12px;margin:0 0 8px}
    .history-para-original{font-size:1rem;line-height:2;white-space:pre-wrap;overflow-wrap:anywhere;margin:0 0 7px!important}
    .history-para-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:7px}
    .history-edit-badge{font-size:.73rem;color:#78572d;background:#fff0ce;padding:3px 7px;border-radius:6px}
    .history-correction{white-space:pre-wrap;background:#edf5eb;border-left:3px solid #5b8a69;padding:9px 12px;margin:8px 0;line-height:1.9}
    .history-note{white-space:pre-wrap;color:#66564e;font-size:.83rem;margin:5px 0}
    .history-edit-panel{margin:12px 0 8px;padding:16px;border:1px solid #dbcaaa;background:#fffbf3;border-radius:10px;display:grid;gap:10px}
    .history-edit-panel h4{margin:0;font-size:1rem}
    .history-section-editor-shell{padding:10px 24px;background:#fff8e9}
    .history-edit-panel label{display:grid;gap:5px;font-size:.82rem;font-weight:700}
    .history-edit-panel textarea,.history-edit-panel select{width:100%;padding:9px;font:inherit;border:1px solid #d5c6af;border-radius:7px;background:white;line-height:1.65;resize:vertical}
    .history-edit-panel .history-editor-actions{display:flex;flex-wrap:wrap;gap:8px}
    .history-edit-status{min-height:1.1em;color:#6b5532;font-size:.8rem;line-height:1.5}
    .history-revision-list{font-size:.76rem;line-height:1.7;max-height:200px;overflow:auto;border:1px solid #e0d3bf;padding:9px}
    .history-section-note{padding:12px 24px;background:#f9f1e2;color:#635343;white-space:pre-wrap;font-size:.85rem;line-height:1.8}
    @media(max-width:740px){.history-editor-tools{padding:11px 15px}.history-section-note{padding:11px 15px}.history-section-editor-shell{padding:10px 15px}}
  `;
  document.head.append(style);
  const historicalCard = document.querySelector('.history-panel');
  if (historicalCard) { historicalCard.hidden = true; historicalCard.setAttribute('aria-hidden','true'); }
  const standalone = document.createElement('button');
  standalone.id = 'libraryStandaloneBtn';
  standalone.type = 'button';
  standalone.textContent = '文獻庫 · 站內查閱／管理';
  standalone.setAttribute('aria-label','開啟站內文獻庫（需管理員登入）');
  const spin = $('spinBtn');
  if (spin) spin.before(standalone);
  const tools = document.createElement('div');
  tools.className = 'history-editor-tools';
  tools.innerHTML = '<button id="historySectionEditBtn" type="button">編輯篇章註釋</button><span class="history-editor-help">原文唯讀；校訂稿及註釋另存，保留每次修改紀錄</span>';
  const meta = $('libraryMeta');
  meta.after(tools);
  const sectionNote = document.createElement('div');
  sectionNote.className = 'history-section-note';
  sectionNote.hidden = true;
  tools.after(sectionNote);
  const sectionEditor = document.createElement('div');
  sectionEditor.id = 'historySectionEditor';
  sectionEditor.hidden = true;
  sectionEditor.className = 'history-section-editor-shell';
  sectionNote.after(sectionEditor);
  const editCache = new Map();
  const sectionCache = new Map();

  // 調整畫面文案，避免把 Supabase 資料庫誤顯示為尚未上傳的本地 EPUB。
  const dialog = $('libraryDialog');
  const subtitle = dialog.querySelector('.bank-description');
  if (subtitle) subtitle.textContent = '史料來自已匯入 Supabase 的正史 EPUB 擷取稿；管理員登入後可在本站閱覽，不開啟外部文獻連結。';
  const eyebrow = dialog.querySelector('.side-label');
  if (eyebrow) eyebrow.textContent = 'HISTORICAL SOURCES · SUPABASE 史料庫';
  const foot = dialog.querySelector('.library-foot');
  if (foot) foot.textContent = '目前為 EPUB 轉錄文字，非古籍校勘定本。段序與來源檔路徑可供追索；正式引用仍應對照指定版本。';
  const searchLabel = $('librarySearch').closest('label');
  if (searchLabel) searchLabel.firstChild.textContent = '本章原文檢索 ';

  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'outline-btn';
  more.textContent = '載入更多段落';
  more.style.cssText = 'display:none;margin:14px 24px 18px;';
  $('libraryText').after(more);

  function message(text) {
    $('libraryText').replaceChildren();
    const p = document.createElement('p');
    p.className = 'library-placeholder';
    p.textContent = text;
    $('libraryText').append(p);
  }
  function opt(id, text) { const o = document.createElement('option'); o.value = id; o.textContent = text; return o; }
  function currentToken() {
    // 若已透過原本的題庫管理介面登入，沿用其短期存於記憶體的憑證。
    return state.token || (typeof adminAccessToken !== 'undefined' ? adminAccessToken : null);
  }
  async function request(path, opts = {}, token = currentToken()) {
    if (!ready) throw new Error('config.js 尚未填入 Supabase Project URL 與 publishable key。');
    if (!token) throw new Error('請先登入授權管理員帳號。');
    const response = await fetch(api + path, {
      ...opts,
      cache: 'no-store',
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + token,
        Accept: 'application/json',
        ...(opts.headers || {})
      }
    });
    const payload = await response.text();
    let data;
    try { data = payload ? JSON.parse(payload) : null; }
    catch { data = null; }
    if (!response.ok) {
      const detail = typeof data?.message === 'string' ? data.message : (typeof data?.error_description === 'string' ? data.error_description : '');
      const hint = response.status === 401 ? '登入已失效，請重新登入。' : `Supabase HTTP ${response.status}${detail ? '：' + detail.slice(0, 120) : ''}`;
      throw new Error(hint);
    }
    return data;
  }
  async function login(email, password, form) {
    if (!ready) throw new Error('網站尚未正確設定 Supabase 連線。');
    const response = await fetch(api + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, gotrue_meta_security: { captcha_token: window.quizCaptcha.token(form) } }),
      cache: 'no-store'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) throw new Error(data.msg || data.error_description || data.message || '登入失敗，請檢查帳密及電子郵件確認狀態。');
    // 未取得允許讀取的 quiz_admins 紀錄，不授權登入史料閱覽室。
    const membership = await request('/rest/v1/quiz_admins?select=user_id&limit=1', {}, data.access_token);
    if (!Array.isArray(membership) || !membership.length) throw new Error('帳號登入成功，但尚未加入 quiz_admins 管理員清單。');
    state.token = data.access_token;
    const account = await request('/auth/v1/user', {}, data.access_token);
    state.userId = account?.id || null;
  }
  function showLogin() {
    more.style.display = 'none';
    $('libraryMeta').textContent = '史料庫採管理員登入保護；不公開展示原始 EPUB 轉製全文。';
    const pane = $('libraryText');
    pane.replaceChildren();
    const form = document.createElement('form');
    form.style.cssText = 'max-width:420px;display:grid;gap:12px;padding:20px;margin:12px auto;';
    const heading = document.createElement('h3'); heading.textContent = '登入後閱覽二十四史';
    const eLabel = document.createElement('label'); eLabel.textContent = '管理員電子郵件';
    const email = document.createElement('input'); email.type = 'email'; email.required = true;
    email.autocomplete = 'username'; email.style.cssText = 'display:block;width:100%;padding:10px;'; eLabel.append(email);
    const pLabel = document.createElement('label'); pLabel.textContent = '密碼';
    const pass = document.createElement('input'); pass.type = 'password'; pass.required = true;
    pass.autocomplete = 'current-password'; pass.style.cssText = 'display:block;width:100%;padding:10px;'; pLabel.append(pass);
    const btn = document.createElement('button'); btn.className = 'primary'; btn.type = 'submit'; btn.textContent = '登入閱讀史料';
    const status = document.createElement('p'); status.setAttribute('role', 'status');
    status.style.color = '#9e2a2b';
    const help = document.createElement('p'); help.textContent = '密碼僅送往 Supabase Auth；不會寫入 GitHub 或儲存於本站。';
    help.style.cssText = 'font-size:.85rem;color:#68717a;';
    form.append(heading, eLabel, pLabel, btn, status, help);
    form.addEventListener('submit', async evt => {
      evt.preventDefault(); btn.disabled = true; status.textContent = '正在驗證…';
      try { await login(email.value.trim(), pass.value, form); pass.value = ''; await loadIndex(state.pendingRef); }
      catch (err) { status.textContent = err.message; }
      finally { window.quizCaptcha.reset(form); btn.disabled = false; pass.value = ''; }
    });
    pane.append(form);
  }
  async function loadIndex(ref = null) {
    state.userId = null;
    if (!currentToken()) { showLogin(); return; }
    $('libraryMeta').textContent = '正在從 Supabase 讀取史書與篇章…';
    message('正在載入資料庫目錄…');
    more.style.display = 'none';
    try {
      const [books, sections] = await Promise.all([
        request('/rest/v1/history_books?select=id,title,book_no,author,status&order=book_no.asc&limit=100'),
        request('/rest/v1/history_sections?select=id,book_id,title_original,category,paragraph_count,source_path,review_status&order=id.asc&limit=300')
      ]);
      if (!Array.isArray(books) || !Array.isArray(sections)) throw new Error('史料資料表格式不符。');
      state.sections = sections;
      const active = new Set(sections.map(s => s.book_id));
      state.books = books.filter(b => active.has(b.id));
      const chooser = $('libraryBook'); chooser.replaceChildren();
      for (const b of state.books) chooser.append(opt(b.id, b.title));
      if (!state.books.length) {
        $('libraryChapter').replaceChildren();
        message('沒有可閱讀的史書篇章。請確認已匯入 78 篇原文，並在 Supabase 執行 history_reader_rls.sql，且帳號已加入 quiz_admins。');
        return;
      }
      const citedBook = ref?.book?.match(/《([^》]+)》/)?.[1] || '';
      const match = citedBook ? state.books.find(b => b.title.includes(citedBook) || citedBook.includes(b.title)) : null;
      chooser.value = match?.id || state.books[0].id;
      await selectBook(ref);
    } catch (err) {
      $('libraryMeta').textContent = '資料庫存取失敗';
      message(err.message + ' 請確認 RLS、管理員授權、資料表與 config.js。');
    }
  }
  async function selectBook(ref = null) {
    const book = state.books.find(b => b.id === $('libraryBook').value);
    if (!book) return;
    state.book = book;
    const list = state.sections.filter(s => s.book_id === book.id);
    const chooser = $('libraryChapter'); chooser.replaceChildren();
    for (const s of list) chooser.append(opt(s.id, s.title_original));
    let sel = list[0];
    if (ref?.book) {
      const text = ref.book;
      const match = list.find(s => text.includes(s.title_original) || s.title_original.includes(text))
        || list.find(s => /天官書/.test(text) && /天官/.test(s.title_original))
        || list.find(s => /五行/.test(text) && /五行/.test(s.title_original))
        || list.find(s => /天文/.test(text) && /天文|天象|司天/.test(s.title_original));
      if (match) sel = match;
    }
    if (!sel) { message('此書沒有辨識出符合指定研究類別的篇章。'); return; }
    chooser.value = sel.id;
    await selectSection();
  }
  async function selectSection() {
    const s = state.sections.find(s => s.id === $('libraryChapter').value);
    if (!s) return;
    state.section = s;
    state.requestSeq++;
    sectionEditor.hidden = true;
    sectionEditor.replaceChildren();
    state.offset = 0; state.count = 0; state.search = '';
    state.total = Number(s.paragraph_count || 0);
    $('librarySearch').value = '';
    $('libraryText').replaceChildren();
    $('libraryMeta').textContent = `書名：${state.book.title}｜篇章：${s.title_original}｜來源 EPUB：${s.source_path || '未標記'}｜校核狀態：${s.review_status || '待校'}`;
    await loadParagraphs(true);
    await loadSectionNote(s.id);
  }
  function edKey(sectionId, paragraphNo) { return sectionId + '|' + paragraphNo; }
  async function editorId() {
    if (state.userId) return state.userId;
    const user = await request('/auth/v1/user');
    if (!user?.id) throw new Error('登入狀態已失效，請重新登入。');
    state.userId = user.id;
    return user.id;
  }
  async function fetchEdits(rows, sectionId) {
    if (!rows.length) return new Map();
    const nos = rows.map(p => Number(p.paragraph_no));
    const min = Math.min(...nos), max = Math.max(...nos);
    let data=[];
    try {
      data = await request(`/rest/v1/history_paragraph_edits?select=section_id,paragraph_no,revised_body,editor_note,review_status,updated_by,updated_at&section_id=eq.${encodeURIComponent(sectionId)}&paragraph_no=gte.${min}&paragraph_no=lte.${max}&limit=1000`);
      state.editorReady = true;
    } catch (error) {
      state.editorReady = false;
      console.warn('校訂資料表尚未就緒；維持原文唯讀：', error.message);
    }
    const result = new Map();
    for (const e of data) { result.set(Number(e.paragraph_no), e); editCache.set(edKey(sectionId,e.paragraph_no), e); }
    return result;
  }
  function renderParagraph(p, edit) {
    const wrap = document.createElement('section');
    wrap.className = 'history-para-block';
    wrap.dataset.paragraph = String(p.paragraph_no);
    const original = document.createElement('p');
    original.className = 'history-para-original';
    const num = document.createElement('span');
    num.className = 'para-index';
    num.textContent = `[${p.paragraph_no}] 原文　`;
    original.append(num, document.createTextNode(String(p.body || '')));
    if (p.source_path) original.title = `EPUB：${p.source_path}／來源段落序號：${p.source_paragraph_index ?? '未記錄'}`;
    wrap.append(original);
    if (edit?.revised_body) {
      const corrected = document.createElement('div');
      corrected.className = 'history-correction';
      corrected.textContent = '校訂稿（非原 EPUB 文字）｜' + edit.revised_body;
      wrap.append(corrected);
    }
    if (edit?.editor_note) {
      const note = document.createElement('div');
      note.className = 'history-note';
      note.textContent = '校勘註記｜' + edit.editor_note;
      wrap.append(note);
    }
    const actions = document.createElement('div');
    actions.className = 'history-para-actions';
    if (edit) {
      const label = document.createElement('span');
      label.className = 'history-edit-badge';
      label.textContent = `校訂狀態：${edit.review_status} · ${String(edit.updated_at || '').slice(0,10)}`;
      actions.append(label);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = edit ? '修改校訂／註記' : '新增校訂／註記';
    button.addEventListener('click', () => showParagraphEditor(p, edit, wrap));
    button.disabled = state.editorReady === false;
    if(button.disabled)button.title='請先在 Supabase 執行 history_editor_rls.sql';
    actions.append(button);
    const audit = document.createElement('button');
    audit.type = 'button';
    audit.textContent = '修訂歷程';
    audit.addEventListener('click', () => showHistory(p, wrap));
    actions.append(audit);
    wrap.append(actions);
    return wrap;
  }
  async function appendParagraphs(rows, clear, sectionId) {
    const edits = await fetchEdits(rows, sectionId);
    if (state.section?.id !== sectionId) return;
    const pane = $('libraryText');
    if (clear) pane.replaceChildren();
    const fragment = document.createDocumentFragment();
    rows.forEach(row => fragment.append(renderParagraph(row, edits.get(Number(row.paragraph_no)))));
    pane.append(fragment);
    if (!rows.length && clear) message('此段落範圍沒有可讀取的文字。');
  }
  function formField(label, value, maxLength, rows=3) {
    const lab = document.createElement('label');
    lab.textContent = label;
    const input = document.createElement('textarea');
    input.rows = rows;
    input.maxLength = maxLength;
    input.value = value || '';
    lab.append(input);
    return {label: lab, input};
  }
  function reviewPicker(selected) {
    const label = document.createElement('label');
    label.textContent = '校訂狀態';
    const input = document.createElement('select');
    for (const item of ['待核對','已與EPUB核對','已與指定版本核對','需要複核']) {
      const option = document.createElement('option');
      option.textContent = item; option.value = item;
      input.append(option);
    }
    input.value = selected || '待核對';
    label.append(input);
    return {label,input};
  }
  function actionsRow(form, saveText='儲存修改') {
    const actions = document.createElement('div');
    actions.className = 'history-editor-actions';
    const save = document.createElement('button'); save.type = 'submit'; save.textContent = saveText;
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = '取消';
    cancel.addEventListener('click', () => form.remove());
    actions.append(save,cancel); return {actions,save};
  }
  async function upsert(table, row, conflict) {
    const payload = await request(`/rest/v1/${table}?on_conflict=${encodeURIComponent(conflict)}`, {
      method:'POST',
      headers:{'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=representation'},
      body: JSON.stringify(row)
    });
    if (!Array.isArray(payload) || payload.length !== 1) throw new Error('資料庫未確認修改結果。');
    return payload[0];
  }
  function showParagraphEditor(p, edit, wrapper) {
    wrapper.querySelectorAll('.history-edit-panel,.history-revision-list').forEach(e=>e.remove());
    const sectionId=state.section.id;
    const form=document.createElement('form'); form.className='history-edit-panel';
    const heading=document.createElement('h4'); heading.textContent=`校訂第 ${p.paragraph_no} 段`;
    const hint=document.createElement('p');hint.className='history-editor-help';
    hint.textContent='原始 EPUB 段落不可直接覆寫。下方校訂稿是獨立版本；請勿憑推測補字。';
    const body=formField('校訂稿（可留空，原文仍保留）',edit?.revised_body,40000,5);
    const note=formField('校勘依據／編者註釋',edit?.editor_note,4000,3);
    const status=reviewPicker(edit?.review_status);
    const {actions,save}=actionsRow(form);
    const feedback=document.createElement('div'); feedback.className='history-edit-status';feedback.setAttribute('role','status');
    form.append(heading,hint,body.label,note.label,status.label,actions,feedback);
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      if (state.section?.id!==sectionId) return;
      const revised=body.input.value.trim() || null;
      const comment=note.input.value.trim();
      if (!revised && !comment) {feedback.textContent='請填寫校訂稿或校勘註釋。';return;}
      save.disabled=true; feedback.textContent='儲存中…';
      try {
        const author=await editorId();
        const saved=await upsert('history_paragraph_edits',{
          section_id:sectionId, paragraph_no:p.paragraph_no,
          revised_body:revised, editor_note:comment, review_status:status.input.value,updated_by:author
        },'section_id,paragraph_no');
        editCache.set(edKey(sectionId,p.paragraph_no),saved);
        const updated=renderParagraph(p,saved);
        wrapper.replaceWith(updated);
      }catch(error){feedback.textContent='修改失敗：'+error.message;}
      finally{save.disabled=false;}
    });
    wrapper.append(form);
    body.input.focus();
  }
  async function showHistory(p, wrapper) {
    wrapper.querySelectorAll('.history-revision-list').forEach(x=>x.remove());
    const list=document.createElement('div');list.className='history-revision-list';
    list.textContent='載入修訂紀錄中…'; wrapper.append(list);
    try {
      const rows=await request(`/rest/v1/history_edit_audit?select=created_at,changed_by,old_value,new_value&target_type=eq.paragraph&section_id=eq.${encodeURIComponent(state.section.id)}&paragraph_no=eq.${p.paragraph_no}&order=created_at.desc&limit=30`);
      list.replaceChildren();
      if(!rows.length){list.textContent='尚無修訂紀錄。';return;}
      rows.forEach(row=>{
        const line=document.createElement('div');
        const oldBody=row.old_value?.revised_body||'';
        const newBody=row.new_value?.revised_body||'';
        line.textContent=`${String(row.created_at).replace('T',' ').slice(0,19)}｜${String(row.changed_by||'') .slice(0,8)}｜校訂稿 ${oldBody ? '由前版更新' : '新增'}｜新稿：${newBody.slice(0,180) || '（僅註釋）'}`;
        list.append(line);
      });
    }catch(error){list.textContent='無法查閱紀錄：'+error.message;}
  }
  async function loadSectionNote(sectionId) {
    sectionNote.hidden=true;
    if (!sectionId) return;
    $('historySectionEditBtn').disabled = state.editorReady === false;
    try {
      const rows=await request(`/rest/v1/history_section_edits?select=section_id,editorial_note,review_status,updated_by,updated_at&section_id=eq.${encodeURIComponent(sectionId)}&limit=1`);
      if (state.section?.id !== sectionId) return;
      const data=rows[0] || null;
      sectionCache.set(sectionId,data);
      if (data?.editorial_note) {
        sectionNote.hidden=false;
        sectionNote.textContent=`編者篇章註釋（${data.review_status}）：${data.editorial_note}`;
      }
    }catch(error){sectionNote.hidden=false;sectionNote.textContent='篇章註釋未能載入：'+error.message;}
  }
  function editSection() {
    if (!state.section) return;
    sectionEditor.hidden=false;
    sectionEditor.replaceChildren();
    const sectionId=state.section.id;
    const existing=sectionCache.get(sectionId);
    const form=document.createElement('form');form.className='history-edit-panel';
    const heading=document.createElement('h4');heading.textContent=`篇章註記｜${state.section.title_original}`;
    const note=formField('篇章說明／校勘與版本資訊',existing?.editorial_note,8000,5);
    const status=reviewPicker(existing?.review_status);
    const {actions,save}=actionsRow(form,'儲存篇章註記');
    actions.lastChild.addEventListener('click',()=>{sectionEditor.hidden=true;});
    const feedback=document.createElement('div');feedback.className='history-edit-status';feedback.setAttribute('role','status');
    form.append(heading,note.label,status.label,actions,feedback);
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(state.section?.id!==sectionId)return;
      save.disabled=true;feedback.textContent='儲存中…';
      try {
        const saved=await upsert('history_section_edits',{
          section_id:sectionId,editorial_note:note.input.value.trim(),review_status:status.input.value,updated_by:await editorId()
        },'section_id');
        sectionCache.set(sectionId,saved);
        sectionEditor.hidden=true;
        await loadSectionNote(sectionId);
      }catch(error){feedback.textContent='儲存失敗：'+error.message;}
      finally{save.disabled=false;}
    });
    sectionEditor.append(form);
    note.input.focus();
  }
  $('historySectionEditBtn').addEventListener('click',editSection);
  async function loadParagraphs(clear = false) {
    if (!state.section) return;
    const req = ++state.requestSeq;
    const sectionId = encodeURIComponent(state.section.id);
    more.disabled = true;
    if (clear) message('正在從 Supabase 載入段落…');
    try {
      const rows = await request(`/rest/v1/history_paragraphs?select=paragraph_no,body,source_path,source_paragraph_index&section_id=eq.${sectionId}&order=paragraph_no.asc&limit=${PER_PAGE}&offset=${state.offset}`);
      if (req !== state.requestSeq) return;
      if (!Array.isArray(rows)) throw new Error('段落資料格式異常。');
      await appendParagraphs(rows, clear, state.section.id);
      state.offset += rows.length;
      state.count += rows.length;
      more.style.display = rows.length === PER_PAGE ? 'inline-block' : 'none';
      $('libraryMeta').textContent = `書名：${state.book.title}｜篇章：${state.section.title_original}｜已顯示：${state.count} 段（該篇標記 ${state.total} 段）｜版本：EPUB 自動擷取稿，待校勘`;
    } catch (err) { message('載入原文失敗：' + err.message); more.style.display = 'none'; }
    finally { more.disabled = false; }
  }
  async function searchSection() {
    state.requestSeq++;
    const term = $('librarySearch').value.trim();
    if (!term) { state.offset = 0; state.count = 0; state.search = ''; await loadParagraphs(true); return; }
    if (term.length > 60) { message('請將搜尋詞縮短至 60 字內。'); return; }
    // PostgREST 的 . , ( ) * % 屬於篩選語法，先不接受這些特殊符號。
    if (/[(),.*%]/.test(term)) { message('查找詞不能包含 , ( ) . * % 等 PostgREST 特殊符號。'); return; }
    if (!state.section) return;
    more.style.display = 'none';
    $('libraryMeta').textContent = '正在查找本章原文…';
    try {
      const filter = encodeURIComponent('*' + term + '*');
      const rows = await request(`/rest/v1/history_paragraphs?select=paragraph_no,body,source_path,source_paragraph_index&section_id=eq.${encodeURIComponent(state.section.id)}&body=ilike.${filter}&order=paragraph_no.asc&limit=${MAX_SEARCH}`);
      if (!Array.isArray(rows)) throw new Error('查詢回傳格式異常');
      await appendParagraphs(rows, true, state.section.id);
      if (!rows.length) message('本章未找到「' + term + '」。請注意 EPUB 保留原始字形與異體字。');
      $('libraryMeta').textContent = `${state.book.title} · ${state.section.title_original}｜「${term}」符合 ${rows.length} 段${rows.length >= MAX_SEARCH ? '（最多顯示前 100 段，請縮小範圍）' : ''}`;
    } catch (err) { message('搜尋失敗：' + err.message); }
  }

  async function open(ref) {
    state.pendingRef = ref;
    if (typeof dialog.showModal === 'function') { if (!dialog.open) dialog.showModal(); }
    else dialog.setAttribute('open', '');
    if (!ready) { message('請先在 config.js 設定 Supabase Project URL 和 publishable key。'); return; }
    await loadIndex(ref);
  }
  // 使用捕獲階段攔截舊版「本地 EPUB JSON」的 click/change 處理，
  // 原有網站的二十八宿圓盤／題庫程式完全不變。
  function capture(id, event, handler) {
    $(id).addEventListener(event, e => { e.preventDefault(); e.stopImmediatePropagation(); handler(e); }, true);
  }
  capture('historyLink', 'click', () => open(typeof currentHistory === 'undefined' ? null : currentHistory));
  standalone.addEventListener('click', () => open(null));
  capture('libraryOpenBtn', 'click', () => open(null));
  capture('libraryBook', 'change', () => selectBook());
  capture('libraryChapter', 'change', () => selectSection());
  capture('librarySearchBtn', 'click', () => searchSection());
  $('librarySearch').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    searchSection();
  }, true);
  more.addEventListener('click', () => loadParagraphs(false));
})();
