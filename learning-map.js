/* Interactive learning map. Server-validated correct answers are the only progress source.
 * Topics are modern teaching navigation, not a claim of historical linear development.
 * No localStorage, answer keys, score mutations, or database writes.
 */
(() => {
  'use strict';
  const wheel = document.getElementById('spinBtn');
  const guestbook = document.getElementById('guestbook');
  if (!wheel || !guestbook || document.getElementById('learningMap')) return;
  const make = (tag, content = '', className = '') => {
    const node = document.createElement(tag);
    node.textContent = content;
    if (className) node.className = className;
    return node;
  };
  const stages = [
    { id: '通識', title: '數術通識', desc: '認識術語、方法與基本問題，作為跨主題探索的起點。', group: '起步' },
    { id: '易學', title: '易學基礎', desc: '探索卦象、陰陽與易學文本所涉及的知識。', group: '起步' },
    { id: '天文曆法', title: '天文與曆法', desc: '區分天象觀測、曆法制度與不同時代的解釋。', group: '起步' },
    { id: '山', title: '山・修練', desc: '閱讀修練、養生與相關身體技術的題目。', group: '五術' },
    { id: '醫', title: '醫・醫學', desc: '探索歷史醫學與傳統知識體系。', group: '五術' },
    { id: '命', title: '命・命理', desc: '理解命理分類、術語及其歷史脈絡。', group: '五術' },
    { id: '卜', title: '卜・占卜', desc: '比較占卜方法、推演規則與文本語境。', group: '五術' },
    { id: '相', title: '相・形法', desc: '探索相術、堪輿與空間觀念。', group: '五術' },
    { id: '式占', title: '式占專題', desc: '認識式占相關知識及其歷史差異。', group: '專題' },
    { id: '兵陰陽', title: '兵陰陽專題', desc: '探索兵陰陽及其與軍事知識的關係。', group: '專題' },
    { id: '待分類', title: '待考與待分類', desc: '題庫暫未分類的題目；其歸屬不表示已有學術定論。', group: '整理' }
  ];
  const quadrants = [
    { id: '東方青龍', title: '東方青龍七宿', desc: '依傳統四象分類認識東方七宿，對照圖鑑與題庫。' },
    { id: '北方玄武', title: '北方玄武七宿', desc: '認識北方七宿，留意斗宿與北斗七星的區別。' },
    { id: '西方白虎', title: '西方白虎七宿', desc: '認識西方七宿與星官名稱的歷史用法。' },
    { id: '南方朱雀', title: '南方朱雀七宿', desc: '認識南方七宿及不同文獻中的宿名。' }
  ];
  const style = make('style');
  style.textContent = [
    '.learn-map{margin:26px 0 28px;padding:25px;border:1px solid #cfc3a8;border-radius:18px;background:linear-gradient(135deg,#fffcf3,#ede7d8);box-shadow:0 8px 24px #473e2710}',
    '.learn-map *{box-sizing:border-box}',
    '.learn-map-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap}',
    '.learn-map-kicker{font-size:.74rem;letter-spacing:.2em;color:#90723f;font-weight:700;margin:0 0 7px}',
    '.learn-map h2{margin:0;font-size:clamp(1.35rem,2.5vw,1.8rem);letter-spacing:.07em}',
    '.learn-map-summary{color:#58636b;line-height:1.8;font-size:.86rem;margin:9px 0}',
    '.learn-map-meter{min-width:210px;max-width:320px;flex:1;background:#fffaf0;border:1px solid #ded1b9;border-radius:12px;padding:12px 15px}',
    '.learn-map-meter strong{display:block;font-size:.94rem;color:#34463f}',
    '.learn-map-meter-track,.learn-map-node-track{display:block;overflow:hidden;background:#e1e4dc;border-radius:999px;height:8px;margin-top:9px}',
    '.learn-map-meter-fill,.learn-map-node-fill{height:100%;display:block;width:0;background:#448577;border-radius:999px;transition:width .2s ease}',
    '.learn-map-tabs{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}',
    '.learn-map-tabs button{font:inherit;cursor:pointer;border:1px solid #c1ac82;background:#fffaf0;color:#454739;border-radius:10px;padding:10px 17px}',
    '.learn-map-tabs button[aria-selected=true]{background:#244e4a;color:#fff;border-color:#244e4a}',
    '.learn-map-body{display:grid;grid-template-columns:minmax(0,1.75fr) minmax(250px,.85fr);align-items:start;gap:18px}',
    '.learn-map-path{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;counter-reset:steps}',
    '.learn-map-node{position:relative;min-width:0;min-height:148px;display:flex;flex-direction:column;align-items:stretch;gap:9px;padding:14px;text-align:left;border:1px solid #d0c5ae;border-radius:13px;background:#fffdf8;color:#263c45;font:inherit;cursor:pointer}',
    '.learn-map-node:hover,.learn-map-node:focus-visible{border-color:#877346;box-shadow:0 5px 12px #6555371a}',
    '.learn-map-node[aria-pressed=true]{border:2px solid #2f7668;background:#ebf5f0}',
    '.learn-map-node-top{display:flex;justify-content:space-between;gap:8px;align-items:center}',
    '.learn-map-node-group{font-size:.71rem;color:#8a6c41;letter-spacing:.1em}',
    '.learn-map-node-number{background:#e9dcc6;color:#66512e;border-radius:50%;width:30px;height:30px;display:grid;place-items:center;font:700 .79rem system-ui,sans-serif;flex:none}',
    '.learn-map-node strong{font-size:.96rem;line-height:1.45}',
    '.learn-map-node-description{font-size:.75rem;color:#6b736d;line-height:1.55;flex:1}',
    '.learn-map-node-meta{font-size:.74rem;color:#4c7567}',
    '.learn-map-detail{background:#fffaf0;border:1px solid #d4c39f;border-radius:13px;padding:18px;min-width:0}',
    '.learn-map-detail h3{margin:3px 0 9px;font-size:1.16rem}',
    '.learn-map-detail p{font-size:.83rem;line-height:1.8;color:#4e5b61}',
    '.learn-map-detail .learn-map-detail-label{font-size:.72rem;color:#966b35;font-weight:700;letter-spacing:.1em;margin:0}',
    '.learn-map-detail-action{width:100%;font:inherit;text-align:center;background:#193e4c;color:#fff;border:0;border-radius:9px;padding:12px;cursor:pointer;margin-top:8px}',
    '.learn-map-detail-action:disabled{background:#8a908d;cursor:not-allowed}',
    '.learn-map-aux{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0}',
    '.learn-map-aux a{font-size:.8rem;display:inline-block;border:1px solid #d1bf9b;background:#fffdf7;color:#335a61;border-radius:8px;padding:6px 9px;text-decoration:none}',
    '.learn-map-disclaimer{border-top:1px solid #d8ccb8;padding-top:12px;margin:18px 0 0;font-size:.75rem;line-height:1.7;color:#77746e}',
    '.learn-map-status{min-height:1.6em;color:#53746b;font-size:.8rem;margin:12px 0 0}',
    '@media(max-width:950px){.learn-map-body{grid-template-columns:1fr}.learn-map-path{grid-template-columns:repeat(2,minmax(0,1fr))}}',
    '@media(max-width:550px){.learn-map{padding:14px}.learn-map-path{grid-template-columns:1fr}.learn-map-node{min-height:110px}.learn-map-meter{max-width:none}.learn-map-detail{padding:13px}}',
    '@media(prefers-reduced-motion:reduce){.learn-map-meter-fill,.learn-map-node-fill{transition:none}}'
  ].join('\n');
  document.head.append(style);

  const root = make('section', '', 'learn-map');
  root.id = 'learningMap';
  root.setAttribute('aria-labelledby', 'learningMapTitle');
  const head = make('div', '', 'learn-map-head');
  const intro = make('div');
  intro.append(
    make('p', 'INTERACTIVE LEARNING MAP', 'learn-map-kicker'),
    make('h2', '數術知識學習地圖')
  );
  intro.lastChild.id = 'learningMapTitle';
  intro.append(make('p', '從基礎概念、五術與專題，到四象二十八宿；點選關卡查看題量、進度與學習入口。', 'learn-map-summary'));
  const meter = make('div', '', 'learn-map-meter');
  const meterText = make('strong', '尚未登入會員');
  const meterTrack = make('div', '', 'learn-map-meter-track');
  const meterFill = make('span', '', 'learn-map-meter-fill');
  meterTrack.setAttribute('role', 'progressbar');
  meterTrack.setAttribute('aria-label', '目前題庫的會員掌握進度');
  meterTrack.setAttribute('aria-valuemin', '0');
  meterTrack.setAttribute('aria-valuemax', '100');
  meterTrack.append(meterFill);
  meter.append(meterText, meterTrack);
  head.append(intro, meter);
  const tabs = make('div', '', 'learn-map-tabs');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', '學習地圖路徑');
  const topicTab = make('button', '數術知識路徑');
  const mansionTab = make('button', '四象二十八宿路徑');
  for (const [node, name] of [[topicTab, 'topics'], [mansionTab, 'mansions']]) {
    node.type = 'button';
    node.setAttribute('role', 'tab');
    node.id = 'learn-map-tab-' + name;
    node.addEventListener('click', () => { route = name; selected = ''; render(); });
    tabs.append(node);
  }
  const body = make('div', '', 'learn-map-body');
  const path = make('div', '', 'learn-map-path');
  path.setAttribute('aria-label', '可選的學習關卡');
  const detail = make('aside', '', 'learn-map-detail');
  detail.setAttribute('aria-live', 'polite');
  body.append(path, detail);
  const foot = make('p', '本地圖僅為現代教學導覽，不表示數術各流派存在單一路線、歷史發展先後或學術價值高低；星宿題庫配對亦不代表歷史占法。完成狀態僅依正式會員經伺服器確認答對的題目計算；圖鑑自測不計入排行榜與救援點數。', 'learn-map-disclaimer');
  const status = make('p', '', 'learn-map-status');
  status.setAttribute('role', 'status');
  root.append(head, tabs, body, foot, status);
  guestbook.before(root);

  let route = 'topics', selected = '';
  const member = () => Boolean(window.quizMemberToken?.());
  const completed = () => member() && window.quizCompletedIds instanceof Set ? window.quizCompletedIds : new Set();
  function bank() {
    try {
      return typeof questionBank !== 'undefined' && Array.isArray(questionBank)
        ? questionBank.filter(q => q && typeof q.id === 'string') : [];
    } catch (_) { return []; }
  }
  function mansionList() {
    try { return typeof MANSIONS !== 'undefined' && Array.isArray(MANSIONS) ? MANSIONS : []; }
    catch (_) { return []; }
  }
  function typeOf(q) {
    if (stages.some(s => s.id === q.knowledge_type)) return q.knowledge_type;
    try { return typeof inferKnowledgeType === 'function' ? inferKnowledgeType(q) : '待分類'; }
    catch (_) { return '待分類'; }
  }
  function matching(id, entries, list) {
    if (route === 'topics') return list.filter(q => typeOf(q) === id);
    const names = new Set(entries.filter(m => m.quad === id).map(m => m.name));
    return list.filter(q => names.has(q.mansion));
  }
  function stats(id, entries, list, done) {
    const questions = matching(id, entries, list);
    const correct = member() ? questions.filter(q => done.has(q.id)).length : null;
    return { total: questions.length, correct };
  }
  function statusOf(s) {
    if (!s.total) return '目前沒有對應題目';
    if (s.correct === null) return '登入會員可查看進度';
    if (s.correct === s.total) return '✓ 已完成本關';
    if (s.correct > 0) return '已掌握 ' + s.correct + '／' + s.total + ' 題';
    return '尚未開始';
  }
  function renderNode(item, number, entries, list, done) {
    const s = stats(item.id, entries, list, done);
    const button = make('button', '', 'learn-map-node');
    button.type = 'button';
    button.dataset.key = item.id;
    button.setAttribute('aria-pressed', String(selected === item.id));
    const top = make('span', '', 'learn-map-node-top');
    top.append(make('span', item.group || '四象・七宿', 'learn-map-node-group'),
      make('span', String(number).padStart(2, '0'), 'learn-map-node-number'));
    const progress = make('span', '', 'learn-map-node-track');
    const fill = make('span', '', 'learn-map-node-fill');
    fill.style.width = (s.correct === null || !s.total ? 0 : Math.round(s.correct / s.total * 100)) + '%';
    progress.append(fill);
    button.append(top, make('strong', item.title),
      make('span', item.desc, 'learn-map-node-description'),
      make('span', statusOf(s), 'learn-map-node-meta'), progress);
    button.addEventListener('click', () => {
      selected = item.id; render();
      [...path.querySelectorAll('button')].find(b => b.dataset.key === selected)?.focus({ preventScroll: true });
    });
    path.append(button);
  }
  function renderDetail(item, entries, list, done) {
    detail.replaceChildren();
    if (!item) return;
    const s = stats(item.id, entries, list, done);
    detail.append(
      make('p', route === 'topics' ? '知識關卡' : '星宿關卡', 'learn-map-detail-label'),
      make('h3', item.title), make('p', item.desc),
      make('p', '對應題庫：' + s.total + ' 題；' + statusOf(s) + '。')
    );
    if (route === 'mansions') {
      const chips = make('div', '', 'learn-map-aux');
      entries.filter(m => m.quad === item.id).forEach(m => {
        const link = make('a', m.name);
        link.href = './mansions-atlas.html';
        link.title = '前往二十八宿圖鑑查閱' + m.name + '相關資料';
        chips.append(link);
      });
      detail.append(make('p', '本象七宿（點選前往互動圖鑑）：'), chips);
      const atlas = make('a', '前往二十八宿互動圖鑑 →');
      atlas.href = './mansions-atlas.html';
      detail.append(atlas);
    } else {
      const action = make('button', s.total ? '設定「' + item.id + '」題型並前往抽宿' : '此類型尚無可練習題目', 'learn-map-detail-action');
      action.type = 'button';
      action.disabled = !s.total;
      action.addEventListener('click', () => {
        const select = document.getElementById('challengeKnowledgeType');
        if (select && [...select.options].some(o => o.value === item.id)) {
          select.value = item.id;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          status.textContent = '已選擇「' + item.id + '」。請按原有規則抽宿；試玩額度、登入、冷卻與正式判分均不變。';
          wheel.scrollIntoView({ behavior: 'smooth', block: 'center' });
          wheel.focus({ preventScroll: true });
        } else {
          status.textContent = '目前無法設定題型，請於數術問答區手動選取。';
        }
      });
      detail.append(action);
    }
    if (!member()) {
      const login = make('button', '登入會員查看正式學習進度', 'learn-map-detail-action');
      login.type = 'button';
      login.addEventListener('click', () => document.getElementById('playerSignInBtn')?.click());
      detail.append(login);
    }
  }
  function render() {
    const entries = mansionList();
    const list = bank();
    const done = completed();
    const choices = route === 'topics' ? stages : quadrants;
    if (!choices.some(s => s.id === selected)) {
      const next = choices.find(s => { const t = stats(s.id, entries, list, done); return t.total && (t.correct === null || t.correct < t.total); });
      selected = (next || choices[0]).id;
    }
    topicTab.setAttribute('aria-selected', String(route === 'topics'));
    mansionTab.setAttribute('aria-selected', String(route === 'mansions'));
    const complete = member() ? list.filter(q => done.has(q.id)).length : null;
    meterText.textContent = complete === null
      ? '尚未登入｜可預覽 ' + list.length + ' 道題目路徑'
      : '正式掌握 ' + complete + '／' + list.length + ' 題';
    const pct = complete === null || !list.length ? 0 : Math.round(complete / list.length * 100);
    meterFill.style.width = pct + '%';
    meterTrack.setAttribute('aria-valuenow', String(pct));
    meterTrack.setAttribute('aria-valuetext', complete === null ? '未登入，尚無個人進度' : '已掌握 ' + complete + '／' + list.length + ' 題');
    path.replaceChildren();
    choices.forEach((item, i) => renderNode(item, i + 1, entries, list, done));
    renderDetail(choices.find(x => x.id === selected), entries, list, done);
  }
  for (const event of ['quiz-member-session-changed', 'quiz-answer-graded', 'challenge-bank-loaded']) {
    window.addEventListener(event, render);
  }
  render();
})();
