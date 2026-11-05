// Event actions live in one delegated menu; existing handlers still own persistence and confirmations.
(function () {
  const definitions = [
    { card: '.class-card', buttons: '.class-card-actions button', open: '.class-title .sd-card__link' },
    { card: '.task-item', buttons: '.task-remove', checkbox: 'input[type="checkbox"]' },
    { card: '.hub-task-item', buttons: '.hub-item-delete', checkbox: 'input[type="checkbox"]' },
    { card: '.sidebar-course-task-item', open: 'button.sidebar-course-pill, a.vu-sidebar-link', checkbox: 'input[type="checkbox"]' },
    { card: '.pin-tile', buttons: '.pin-remove', open: ':scope' },
    { card: '.hub-link-card', buttons: '.hub-item-delete', open: '.hub-link-left' },
    { card: '.hub-exam-card', buttons: '.hub-exam-delete-btn' },
    { card: '.note-card', buttons: '.note-card-actions button' },
    { card: '.idea-step-item', buttons: '.idea-step-del', checkbox: 'input[type="checkbox"]' },
    { card: '.idea-full-card', buttons: '.idea-card-top-actions button' },
    { card: '.vu-task-row', buttons: '.vu-calendar-link', open: '.vu-task-title' },
    { card: '.vu-sched-chip', open: ':scope' },
    { card: '.gcal-event', open: 'a[href]' },
    { card: '.personal-event-card', clickToOpen: true },
  ];
  const selector = definitions.map(definition => definition.card).join(',');
  const editable = 'input, textarea, select, [contenteditable="true"]';
  let menu = null, owner = null, holdTimer = null, holdStart = null, suppressedClick = null;

  function cleanLabel(value) {
    return value.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').replace(/\s+/g, ' ').trim();
  }
  function actionsFor(card) {
    const definition = definitions.find(item => card.matches(item.card));
    if (!definition) return [];
    const actions = [];
    const open = definition.open && (definition.open === ':scope' ? card : card.querySelector(definition.open));
    // Class cards already have an explicit notebook action in their action group.
    if (open && !card.matches('.class-card')) actions.push({ label: 'باز کردن', icon: '🔗', run: () => open.click() });
    if (definition.clickToOpen && card.dataset.contextOpen === 'true') actions.push({ label: 'باز کردن رویداد', icon: '📅', run: () => card.click() });
    const checkbox = definition.checkbox && card.querySelector(definition.checkbox);
    if (checkbox) actions.push({ label: checkbox.checked ? 'علامت‌گذاری به‌عنوان انجام‌نشده' : 'علامت‌گذاری به‌عنوان انجام‌شده', icon: '✅', disabled: checkbox.disabled, run: () => checkbox.click() });
    if (definition.buttons) for (const button of card.querySelectorAll(definition.buttons)) {
      if (button.hidden || button.closest(selector) !== card) continue;
      const label = cleanLabel(button.title || button.getAttribute('aria-label') || button.textContent || '');
      if (!label) continue;
      const danger = /حذف/.test(label) || button.matches('.btn-danger, .delete');
      const icon = danger ? '🗑️' : /ویرایش/.test(label) ? '✏️' : /کپی/.test(label) ? '📋' : /آرشیو/.test(label) ? '🗃️' : /فعال/.test(label) ? '🚀' : /تقویم/.test(label) ? '📅' : '📖';
      actions.push({ label, icon, danger, disabled: button.disabled, run: () => button.click() });
    }
    return actions;
  }
  function close(restoreFocus = false) {
    if (!menu) return;
    const previousOwner = owner;
    menu.remove(); menu = null; owner = null;
    if (restoreFocus && previousOwner?.isConnected) previousOwner.focus({ preventScroll: true });
  }
  function open(card, x, y) {
    const actions = actionsFor(card);
    if (!actions.length) return false;
    close();
    owner = card;
    menu = document.createElement('div');
    menu.className = 'sd-context-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'عملیات آیتم');
    menu.setAttribute('dir', 'rtl');
    menu.setAttribute('popover', 'manual');
    for (const action of actions) {
      const button = document.createElement('button');
      button.type = 'button'; button.setAttribute('role', 'menuitem');
      button.className = 'sd-context-item' + (action.danger ? ' sd-context-item--danger' : '');
      button.disabled = Boolean(action.disabled);
      const icon = document.createElement('span'); icon.className = 'twemoji-icon'; icon.setAttribute('aria-hidden', 'true'); icon.textContent = action.icon;
      const label = document.createElement('span'); label.textContent = action.label;
      button.append(icon, label);
      button.addEventListener('click', event => {
        event.stopPropagation();
        const currentOwner = owner;
        close(true);
        if (currentOwner?.isConnected) action.run();
      });
      menu.appendChild(button);
    }
    // A popover inside its owning dialog remains usable while the rest of the page is inert.
    (card.closest('dialog[open]') || document.body).appendChild(menu);
    if (menu.showPopover) menu.showPopover();
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(x, innerWidth - rect.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(y, innerHeight - rect.height - 8))}px`;
    menu.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
    return true;
  }
  function targetCard(target) {
    return target instanceof Element && !target.closest(editable) ? target.closest(selector) : null;
  }
  document.addEventListener('contextmenu', event => {
    const card = targetCard(event.target);
    if (card && open(card, event.clientX, event.clientY)) { event.preventDefault(); event.stopPropagation(); }
    else close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      const card = targetCard(event.target);
      if (card) {
        const rect = card.getBoundingClientRect();
        if (open(card, rect.right - 180, rect.top + 24)) { event.preventDefault(); event.stopPropagation(); }
      }
      return;
    }
    if (!menu) return;
    if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); }
      close(true); return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const buttons = [...menu.querySelectorAll('button:not(:disabled)')];
    if (!buttons.length) return;
    let index = buttons.indexOf(document.activeElement);
    index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[index].focus();
  }, true);
  function cancelHold() { clearTimeout(holdTimer); holdTimer = null; holdStart = null; }
  document.addEventListener('pointerdown', event => {
    if (menu && !menu.contains(event.target)) close();
    cancelHold();
    if (event.pointerType !== 'touch') return;
    const card = targetCard(event.target);
    if (!card) return;
    holdStart = { x: event.clientX, y: event.clientY };
    holdTimer = setTimeout(() => {
      if (open(card, event.clientX, event.clientY)) suppressedClick = { card, until: Date.now() + 900 };
      cancelHold();
    }, 550);
  });
  document.addEventListener('pointermove', event => {
    if (holdStart && Math.hypot(event.clientX - holdStart.x, event.clientY - holdStart.y) > 8) cancelHold();
  }, { passive: true });
  document.addEventListener('pointerup', cancelHold);
  document.addEventListener('pointercancel', cancelHold);
  document.addEventListener('click', event => {
    if (suppressedClick && Date.now() < suppressedClick.until && suppressedClick.card.contains(event.target)) {
      event.preventDefault(); event.stopImmediatePropagation(); suppressedClick = null;
    }
  }, true);
  document.addEventListener('scroll', event => { cancelHold(); if (menu && !menu.contains(event.target)) close(); }, true);
  window.addEventListener('resize', () => close());
  window.addEventListener('blur', () => close());
  function enhanceCards() {
    if (owner && !owner.isConnected) close();
    for (const card of document.querySelectorAll(selector)) {
      if (!actionsFor(card).length) continue;
      if (!card.hasAttribute('tabindex') && !card.matches('a[href], button')) card.tabIndex = 0;
      card.setAttribute('aria-haspopup', 'menu');
      card.setAttribute('aria-keyshortcuts', 'Shift+F10');
    }
  }
  document.documentElement.classList.add('sd-context-ready');
  enhanceCards();
  new MutationObserver(enhanceCards).observe(document.body, { childList: true, subtree: true });
})();
