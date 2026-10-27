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
  const state = { token: null, books: [], sections: [], book: null, section: null,
    offset: 0, search: '', count: 0, total: 0, requestSeq: 0, pendingRef: null };
  const PER_PAGE = 200;
  const MAX_SEARCH = 100;

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
  async function login(email, password) {
    if (!ready) throw new Error('網站尚未正確設定 Supabase 連線。');
    const response = await fetch(api + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) throw new Error(data.msg || data.error_description || data.message || '登入失敗，請檢查帳密及電子郵件確認狀態。');
    // 未取得允許讀取的 quiz_admins 紀錄，不授權登入史料閱覽室。
    const membership = await request('/rest/v1/quiz_admins?select=user_id&limit=1', {}, data.access_token);
    if (!Array.isArray(membership) || !membership.length) throw new Error('帳號登入成功，但尚未加入 quiz_admins 管理員清單。');
    state.token = data.access_token;
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
      try { await login(email.value.trim(), pass.value); pass.value = ''; await loadIndex(state.pendingRef); }
      catch (err) { status.textContent = err.message; }
      finally { btn.disabled = false; pass.value = ''; }
    });
    pane.append(form);
  }
  async function loadIndex(ref = null) {
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
    state.offset = 0; state.count = 0; state.search = '';
    state.total = Number(s.paragraph_count || 0);
    $('librarySearch').value = '';
    $('libraryText').replaceChildren();
    $('libraryMeta').textContent = `書名：${state.book.title}｜篇章：${s.title_original}｜來源 EPUB：${s.source_path || '未標記'}｜校核狀態：${s.review_status || '待校'}`;
    await loadParagraphs(true);
  }
  function appendParagraphs(rows, clear) {
    const pane = $('libraryText');
    if (clear) pane.replaceChildren();
    const frag = document.createDocumentFragment();
    for (const p of rows) {
      const item = document.createElement('p');
      const num = document.createElement('span'); num.className = 'para-index';
      num.textContent = `[${p.paragraph_no}]`;
      item.append(num, document.createTextNode(String(p.body || '')));
      if (p.source_path) item.title = `EPUB：${p.source_path}／原段落位置：${p.source_paragraph_index ?? '未標記'}`;
      frag.append(item);
    }
    pane.append(frag);
    if (!rows.length && clear) message('此段落範圍沒有可讀取的文字，請檢查來源資料與授權設定。');
  }
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
      appendParagraphs(rows, clear);
      state.offset += rows.length;
      state.count += rows.length;
      more.style.display = rows.length === PER_PAGE ? 'inline-block' : 'none';
      $('libraryMeta').textContent = `書名：${state.book.title}｜篇章：${state.section.title_original}｜已顯示：${state.count} 段（該篇標記 ${state.total} 段）｜版本：EPUB 自動擷取稿，待校勘`;
    } catch (err) { message('載入原文失敗：' + err.message); more.style.display = 'none'; }
    finally { more.disabled = false; }
  }
  async function searchSection() {
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
      appendParagraphs(rows, true);
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
