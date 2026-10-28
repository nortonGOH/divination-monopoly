/* v20 Wenchang Star Rescue: the server owns credits and answer disclosure. */
(() => {
  'use strict';
  const cfg = window.QUIZ_AUTH_CONFIG || {};
  const base = String(cfg.supabaseUrl || '').replace(/\/$/, '');
  const key = String(cfg.publishableKey || '');
  if (!base || !key) return;
  const st = document.createElement('style');
  st.textContent = `
    #wenchangRescueDialog{border:1px solid #baa27e;border-radius:16px;background:#fffaf2;color:#273b44;width:min(500px,calc(100vw - 24px));padding:22px;max-height:88vh;overflow:auto;box-shadow:0 24px 65px #1b27394d}
    #wenchangRescueDialog::backdrop{background:#192b39b3}
    #wenchangRescueDialog h2{margin:0 0 10px;font-size:1.35rem}
    #wenchangRescueDialog p{line-height:1.75;white-space:pre-wrap}
    #wenchangRescueDialog .wenchang-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
    #wenchangRescueDialog button{font:inherit;cursor:pointer;border:1px solid #bfa77d;border-radius:8px;padding:11px 14px;background:#f6e9cf;color:#3b4c57}
    #wenchangRescueDialog button:disabled{cursor:not-allowed;opacity:.55}
    #wenchangRescueDialog .wenchang-result{border-left:3px solid #ad8d4d;background:#fffdf8;padding:12px;margin-top:12px}
  `;
  document.head.append(st);
  const dialog = document.createElement('dialog');
  dialog.id = 'wenchangRescueDialog';
  dialog.setAttribute('aria-labelledby', 'wenchangTitle');
  const title = document.createElement('h2');
  title.id = 'wenchangTitle';
  title.textContent = '文昌星救援';
  const note = document.createElement('p');
  note.textContent = '這題尚未答對。要使用文昌星救援查看正確答案與說明嗎？';
  const balances = document.createElement('p');
  balances.setAttribute('role', 'status');
  const result = document.createElement('div');
  result.className = 'wenchang-result';
  result.hidden = true;
  const actions = document.createElement('div');
  actions.className = 'wenchang-actions';
  const reveal = document.createElement('button');
  reveal.type = 'button';
  reveal.textContent = '使用 1 次救援';
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.textContent = '暫不使用';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '關閉';
  close.hidden = true;
  actions.append(reveal, skip, close);
  dialog.append(title, note, balances, result, actions);
  document.body.append(dialog);
  let questionId = null;
  let lastWasWrong = false;
  let lastAdminExempt = false;
  let maskMutating = false;
  async function rpc(fn, payload) {
    const token = window.quizMemberToken?.();
    if (!token) throw Error('請先登入會員');
    const response = await fetch(base + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload || {}),
      cache: 'no-store'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(data.message || data.error || '伺服器暫時無法處理請求');
    return data;
  }
  function fmt(date) {
    return date ? new Date(date).toLocaleString('zh-TW', {hour12:false}) : '稍後';
  }
  async function refreshBalance() {
    const s = await rpc('quiz_wenchang_status');
    balances.textContent = '可用救援：' + s.credits + '／10 次。每兩小時補充 3 次，最多累積 10 次。' +
      (s.at_cap ? '\n目前已達上限。' : '\n下次補充時間：' + fmt(s.next_grant_at));
    reveal.disabled = s.credits < 1;
  }
  async function openWrong(id) {
    questionId = id;
    result.hidden = true;
    result.textContent = '';
    note.textContent = '您答錯了這道題。您可以保留題目稍後重試，或使用文昌星救援查看正確答案與說明。';
    skip.hidden = false;
    reveal.hidden = false;
    close.hidden = true;
    reveal.disabled = true;
    balances.textContent = '正在查詢文昌星救援次數…';
    if (!dialog.open) dialog.showModal();
    try { await refreshBalance(); }
    catch (e) { balances.textContent = '救援資訊取得失敗：' + e.message; }
  }
  reveal.addEventListener('click', async () => {
    if (!questionId) return;
    reveal.disabled = true;
    try {
      const payload = await rpc('quiz_wenchang_reveal', {p_question_id: questionId});
      const answerIndex = Number(payload.correct_answer);
      if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3)
        throw Error('伺服器未傳回有效的答案');
      const letters = ['A','B','C','D'];
      const optionText = document.getElementById('answerOptions')?.children[answerIndex]?.textContent || '';
      result.textContent = '正確答案：' + letters[answerIndex] + ' ' + optionText + '\n' + (payload.explanation || '這道題目尚未提供解析。');
      result.hidden = false;
      note.textContent = payload.used_credit ? '文昌星救援已使用 1 次。' : '這一題先前已解鎖，可再次查看。';
      balances.textContent = '剩餘救援：' + (payload.status?.credits ?? '—') + '／10 次';
      skip.hidden = true;
      reveal.hidden = true;
      close.hidden = false;
    } catch (e) {
      balances.textContent = '無法取得救援：' + e.message;
      await refreshBalance().catch(() => {});
    }
  });
  const dismiss = () => dialog.close();
  skip.addEventListener('click', dismiss);
  close.addEventListener('click', dismiss);
  window.addEventListener('quiz-answer-graded', ev => {
    const d = ev.detail || {};
    lastWasWrong = d.correct === false;
    lastAdminExempt = Boolean(d.administratorExempt);
    if (lastWasWrong && !lastAdminExempt && d.questionId) {
      // Defer until the v7 grader has finished writing the feedback message.
      Promise.resolve().then(() => openWrong(d.questionId));
    }
  });
  // Defence-in-depth UI guard: replace obsolete v7 incorrect feedback that might
  // still try to reveal the correct answer. Server-side RPCs are the real boundary.
  const feedback = document.getElementById('answerFeedback');
  if (feedback) {
    const observer = new MutationObserver(() => {
      if (maskMutating || !lastWasWrong || lastAdminExempt) return;
      if (/正確答案|答案說明|解析|undefined/i.test(feedback.textContent)) {
        maskMutating = true;
        feedback.textContent = '✕ 回答錯誤。正確答案暫不公開；可選擇「文昌星救援」查看，或稍後再抽宿挑戰。';
        maskMutating = false;
      }
    });
    observer.observe(feedback, {childList:true,characterData:true,subtree:true});
  }
  const reset = () => {lastWasWrong = false;lastAdminExempt = false;};
  [document.getElementById('spinBtn'), document.getElementById('polaris-trigger')].forEach(b => {
    b?.addEventListener('click', reset, true);
  });
})();
