const results = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function eq(actual, expected) { if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`); }
async function test(name, run) { try { await run(); results.push({ name, ok:true }); } catch (e) { results.push({ name, ok:false, error:e.message }); } }
const rightClick = (element, x=100, y=100) => {
  const event = new MouseEvent('contextmenu', { bubbles:true, cancelable:true, button:2, clientX:x, clientY:y });
  element.dispatchEvent(event); return event;
};
const key = (element, name, extra={}) => element.dispatchEvent(new KeyboardEvent('keydown', {key:name,bubbles:true,cancelable:true,...extra}));
const menu = () => document.querySelector('.sd-context-menu');
(async () => {
  const one = document.getElementById('classOne');
  let firstEdits=0, secondEdits=0, deletes=0, normalClicks=0;
  document.getElementById('editOne').addEventListener('click', () => firstEdits++);
  document.getElementById('editTwo').addEventListener('click', () => secondEdits++);
  document.getElementById('deleteOne').addEventListener('click', () => deletes++);
  one.querySelector('.sd-card__link').addEventListener('click', () => normalClicks++);
  await test('inline controls are hidden and right click reuses only the selected card’s actions', () => {
    eq(getComputedStyle(one.querySelector('.class-card-actions')).display,'none');
    eq(rightClick(one).defaultPrevented,true);
    eq(menu().querySelectorAll('[role="menuitem"]').length,2);
    eq(menu().matches(':popover-open'),true);
    menu().querySelector('[role="menuitem"]').click();
    eq(firstEdits,1); eq(secondEdits,0); eq(deletes,0); eq(menu(),null);
    one.querySelector('.sd-card__link').click(); eq(normalClicks,1);
  });
  await test('Shift+F10, arrow navigation, Escape, and focus return work', () => {
    one.focus(); key(one,'F10',{shiftKey:true});
    const items=menu().querySelectorAll('button');
    eq(document.activeElement,items[0]);
    key(items[0],'ArrowDown'); eq(document.activeElement,items[1]);
    key(items[1],'Home'); eq(document.activeElement,items[0]);
    key(items[0],'End'); eq(document.activeElement,items[1]);
    key(items[1],'Escape'); eq(menu(),null); eq(document.activeElement,one);
  });
  await test('delete is routed through its original handler once', () => {
    rightClick(one); menu().querySelector('.sd-context-item--danger').click();
    eq(deletes,1); eq(menu(),null);
  });
  await test('task completion stays available through its existing checkbox', () => {
    const task=document.getElementById('task'); let changes=0;
    task.querySelector('input').addEventListener('change',()=>changes++);
    rightClick(task); menu().querySelector('button').click();
    eq(task.querySelector('input').checked,true); eq(changes,1);
  });
  await test('input fields and unrelated page content keep native context menus', () => {
    eq(rightClick(document.getElementById('noteEditor')).defaultPrevented,false);
    eq(rightClick(document.body).defaultPrevented,false); eq(menu(),null);
  });
  await test('the menu stays inside the viewport and outside press dismisses it', () => {
    rightClick(one,innerWidth-1,innerHeight-1);
    const rect=menu().getBoundingClientRect();
    eq(rect.left>=0 && rect.right<=innerWidth,true); eq(rect.top>=0 && rect.bottom<=innerHeight,true);
    document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'mouse'})); eq(menu(),null);
  });
  await test('menus work inside modal dialogs without losing focus to the inert page', () => {
    const dialog=document.getElementById('testDialog'); dialog.showModal();
    rightClick(dialog.querySelector('.hub-link-card'));
    eq(dialog.contains(menu()),true); eq(menu().contains(document.activeElement),true);
    key(document.activeElement,'Escape'); eq(menu(),null); eq(dialog.open,true); dialog.close();
  });
  await test('touch long press opens actions and suppresses the following accidental click', async () => {
    const title=one.querySelector('.sd-card__link'); const before=normalClicks;
    title.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',clientX:40,clientY:40}));
    await sleep(600); eq(!!menu(),true);
    title.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerType:'touch'}));
    title.click(); eq(normalClicks,before); key(document.activeElement,'Escape');
  });
  await test('menus bind to dynamically rendered cards and close when their owner disappears', async () => {
    const card=one.cloneNode(true); document.body.append(card); await sleep(0);
    eq(card.getAttribute('aria-haspopup'),'menu'); eq(rightClick(card).defaultPrevented,true);
    card.remove(); await sleep(0); eq(menu(),null);
  });
  const out=document.createElement('pre'); out.id='results'; out.textContent=JSON.stringify(results); document.body.append(out);
})().catch(e=>{ const out=document.createElement('pre');out.id='results';out.textContent=JSON.stringify([{name:'setup',ok:false,error:e.stack}]);document.body.append(out); });
