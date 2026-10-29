/* v22 - Clickable category totals, explicit admin classification and Wenchang highlight.
 * Add after challenge-v19-bank-stats.js and quiz-challenge-v7.js.
 * Does not change Supabase tables, access grants, member data or answer keys.
 */
(() => {
  'use strict';
  const CATEGORIES = ['山', '醫', '命', '卜', '相', '天文曆法', '易學', '待分類'];
  const get = id => document.getElementById(id);
  const style = document.createElement('style');
  style.textContent = `
    .player-dialog .wenchang-rule-highlight {
      display:block; margin-top:12px; padding:10px 13px;
      background:#fff2a6; border-left:4px solid #dfbb35;
      border-radius:5px; color:#463b22; box-shadow:inset 0 -1px 0 #e5cf75;
      line-height:1.75;
    }
    .bank-inventory .bank-type-link {
      display:inline-flex; align-items:center; padding:6px 9px;
      font:inherit; color:#255d55; font-weight:700;
      cursor:pointer; background:transparent; border:1px solid transparent;
      border-radius:7px; white-space:nowrap;
    }
    .bank-inventory .bank-type-link:hover,
    .bank-inventory .bank-type-link:focus-visible {background:#e4eee6;border-color:#8cb09d;}
    .bank-inventory .bank-type-link[aria-pressed="true"] {background:#d9e9df;border-color:#4b9473;}
    #quizClassificationNote {display:block;margin:6px 0 10px;padding:9px 12px;
      background:#fff2c8;border-radius:7px;border-left:3px solid #d4a93f;
      color:#624b23;font-size:.84rem;line-height:1.55;}
  `;
  document.head.append(style);

  function highlightWenchangRule() {
    const loginDialog = document.querySelector('dialog.player-dialog');
    if (!loginDialog || loginDialog.querySelector('.wenchang-rule-highlight')) return;
    const intro = Array.from(loginDialog.querySelectorAll('p'))
      .find(p => p.textContent.includes('✦ 文昌星救援：'));
    if (!intro) return;
    const original = intro.textContent;
    const idx = original.indexOf('✦ 文昌星救援：');
    if (idx === -1) return;
    const lead = original.slice(0, idx).trim();
    const details = original.slice(idx).trim();
    intro.replaceChildren(document.createTextNode(lead));
    const highlighted = document.createElement('span');
    highlighted.className = 'wenchang-rule-highlight';
    highlighted.textContent = details;
    intro.appendChild(highlighted);
  }

  function chooseType(type) {
    const typeSelect = get('bankKnowledgeType');
    const difficulty = get('bankDifficulty');
    const mansion = get('bankFilter');
    const search = get('bankSearch');
    if (!typeSelect || !Array.from(typeSelect.options).some(o => o.value === type)) return;
    typeSelect.value = type;
    if (difficulty && Array.from(difficulty.options).some(o => o.value === 'all')) difficulty.value = 'all';
    if (mansion && Array.from(mansion.options).some(o => o.value === 'all')) mansion.value = 'all';
    if (search) search.value = '';
    if (typeof renderBankList === 'function') renderBankList();
    const listTitle = get('listHeading') || get('bankListCount') || get('bankList');
    listTitle?.scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  function activateTypeRows() {
    const root = document.querySelector('#bankDialog .bank-inventory');
    if (!root) return;
    const tbody = root.querySelector('.bank-inventory-scroll table tbody');
    if (!tbody) return;
    for (const row of Array.from(tbody.rows)) {
      const cell = row.cells[0];
      if (!cell || cell.querySelector('button.bank-type-link')) continue;
      const type = cell.textContent.trim();
      if (!CATEGORIES.includes(type)) continue;
      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'bank-type-link';
      link.textContent = type;
      link.title = '顯示「' + type + '」全部難度的題目';
      link.setAttribute('aria-label', '篩選「' + type + '」類型的全部題目');
      link.setAttribute('aria-pressed', String(get('bankKnowledgeType')?.value === type && get('bankDifficulty')?.value === 'all'));
      link.addEventListener('click', () => chooseType(type));
      cell.replaceChildren(link);
    }
  }

  function ensureEditorTypePicker() {
    const form = get('questionForm');
    if (!form) return;
    let picker = get('editKnowledgeType');
    if (!picker) {
      // Compatibility fallback: the current index.html stores this field on save.
      picker = document.createElement('select');
      picker.id = 'editKnowledgeType';
      for (const type of CATEGORIES) {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        picker.appendChild(option);
      }
      const label = document.createElement('label');
      label.setAttribute('for','editKnowledgeType');
      label.textContent = '題目數術類型（人工歸類）';
      const nearby = get('editDifficulty')?.closest('label') || get('editCategory')?.closest('label');
      if (nearby && nearby.parentElement) nearby.insertAdjacentElement('afterend',label);
      else form.prepend(label);
      label.append(picker);
    }
    const label = picker.closest('label');
    if (label) {
      const labelText = Array.from(label.childNodes).find(n=>n.nodeType===Node.TEXT_NODE);
      if (labelText && !labelText.textContent.includes('人工'))
        labelText.textContent = '數術類型（可人工重新歸類）';
    }
    if (!get('quizClassificationNote')) {
      const note = document.createElement('small');
      note.id = 'quizClassificationNote';
      note.textContent = '修改既有題目時，可在此將題目歸入山、醫、命、卜、相、天文曆法、易學或待分類。按「儲存修改」成功寫入 Supabase 後，統計表會重新計算。';
      picker.insertAdjacentElement('afterend',note);
    }
  }

  function refreshBankStats() {
    try {
      if (typeof renderBankList === 'function') renderBankList();
      activateTypeRows();
    } catch (err) {
      console.warn('數術類型統計更新失敗',err);
    }
  }

  // The bank inventory renders a fresh table on each edit/filter; reattach row actions.
  const inventory = document.querySelector('#bankDialog .bank-inventory-scroll');
  if (inventory) {
    const observer = new MutationObserver(() => activateTypeRows());
    observer.observe(inventory,{childList:true});
    activateTypeRows();
  }
  ensureEditorTypePicker();
  highlightWenchangRule();

  // Only reload after the existing management flow reports successful persistence.
  if (typeof displayBankToast === 'function') {
    const baseToast = displayBankToast;
    displayBankToast = function(message,...args) {
      const result = baseToast.call(this,message,...args);
      const msg = String(message || '');
      if (/(已儲存|儲存成功|修改成功|更新成功|已更新|已刪除)/.test(msg) &&
          !/(失敗|錯誤|無法)/.test(msg)) {
        Promise.resolve().then(async () => {
          try {
            if (typeof fetchCloudBank === 'function' && typeof adminAccessToken !== 'undefined' && adminAccessToken) {
              // Refetch authoritative admin data after successful Supabase write.
              const fresh = await fetchCloudBank(true);
              if (Array.isArray(fresh) && typeof questionBank !== 'undefined') questionBank = fresh;
            }
          } catch (err) {
            console.warn('修改已提交，重新載入題庫時發生問題',err);
          }
          refreshBankStats();
        });
      }
      return result;
    };
  }
})();
