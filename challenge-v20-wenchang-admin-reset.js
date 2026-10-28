/* v20: authorized administrator can reset any selected player's Wenchang rescue credits to the default 3.
   Server-side quiz_admin_reset_wenchang() enforces quiz_admins authorization. */
(() => {
  'use strict';
  const config = window.QUIZ_AUTH_CONFIG || {};
  const base = String(config.supabaseUrl || '').replace(/\/$/, '');
  const key = String(config.publishableKey || '');
  const manager = [...document.querySelectorAll('dialog')].find(d =>
    d.querySelector('h3')?.textContent?.includes('會員帳號管理'));
  if (!manager || !base || !key || manager.querySelector('#wenchangAdminOpen')) return;

  const node = (tag, value = '') => {
    const n = document.createElement(tag);
    if (value) n.textContent = value;
    return n;
  };
  const open = node('button', '重置會員文昌星救援');
  open.id = 'wenchangAdminOpen';
  open.type = 'button';
  open.style.cssText = 'margin:8px 0;padding:9px 12px;';
  const managerForm = manager.querySelector('form');
  if (managerForm) managerForm.before(open);
  else manager.append(open);

  const dialog = node('dialog');
  dialog.style.cssText = 'width:min(580px,calc(100vw - 24px));max-height:85vh;overflow:auto;padding:22px;border-radius:14px;';
  const heading = node('h3', '重置文昌星救援次數');
  const help = node('p', '僅修改選定會員剩餘救援次數至 3 次，並重新開始兩小時補充週期；不清除答題成績、解鎖題目或四小時挑戰暫停。');
  const label = node('label', '請選擇會員');
  label.style.display = 'block';
  const select = node('select');
  select.style.cssText = 'display:block;width:100%;padding:10px;margin:8px 0 14px;';
  label.append(select);
  const state = node('p');
  state.setAttribute('role', 'status');
  const controls = node('div');
  controls.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;';
  const submit = node('button', '重置為 3 次');
  submit.type = 'button';
  const close = node('button', '關閉');
  close.type = 'button';
  controls.append(close, submit);
  dialog.append(heading, help, label, state, controls);
  document.body.append(dialog);
  const getToken = () => typeof adminAccessToken === 'string' ? adminAccessToken : null;

  const post = async (endpoint, body) => {
    const token = getToken();
    if (!token) throw new Error('請先登入管理員帳號。');
    const response = await fetch(base + endpoint, {
      method: 'POST',
      headers: { apikey: key, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store'
    });
    const content = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(content.error || content.message || content.error_description || '伺服器錯誤 ' + response.status);
    return content;
  };

  open.addEventListener('click', async () => {
    if (!getToken()) { state.textContent = '請先登入管理員帳號。'; dialog.showModal(); return; }
    select.replaceChildren();
    submit.disabled = true;
    state.textContent = '正在讀取會員清單…';
    dialog.showModal();
    try {
      const result = await post('/functions/v1/quiz-admin-users', { action: 'list' });
      const users = Array.isArray(result.users) ? result.users : [];
      for (const u of users) {
        const option = node('option', (u.nickname ? u.nickname + '｜' : '') + (u.email || '（無電子郵件）'));
        option.value = u.id;
        select.append(option);
      }
      state.textContent = '共有 ' + users.length + ' 位會員。重置需再次確認。';
      submit.disabled = users.length === 0;
    } catch (e) { state.textContent = '讀取會員清單失敗：' + e.message; }
  });

  close.addEventListener('click', () => dialog.close());
  submit.addEventListener('click', async () => {
    const target = select.value;
    if (!target) return;
    const display = select.selectedOptions[0]?.textContent || '所選會員';
    if (!window.confirm('確定將「' + display + '」的文昌星救援次數重置為 3 次？已解鎖的題目不受影響。')) return;
    if (window.prompt('為避免誤操作，請輸入「重置」二字確認。') !== '重置') return;
    submit.disabled = true;
    try {
      const result = await post('/rest/v1/rpc/quiz_admin_reset_wenchang', { p_user_id: target });
      state.textContent = '已為「' + display + '」重置文昌星救援至 ' + result.credits + ' 次；下次補充時間：' + new Date(result.next_refill_at).toLocaleString('zh-TW', { hour12: false }) + '。';
    } catch (e) { state.textContent = '重置失敗：' + e.message; }
    finally { submit.disabled = false; }
  });
})();
