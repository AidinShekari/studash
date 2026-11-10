// Convert legacy interface glyphs and explicit icon slots to local Solar SVGs.
(function (root) {
  const { icons, glyphs, roles } = root.StudashSolarData;
  const ns = "http://www.w3.org/2000/svg";
  const slots = "[data-solar], .sd-icon";
  const excluded = "script, style, svg, textarea, input, option, select, [contenteditable], .note-card-title, .note-card-body, .idea-step-text";
  const escaped = Object.keys(glyphs)
    .sort((a, b) => b.length - a.length)
    .map(glyph => glyph.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp("(?:" + escaped.join("|") + ")\uFE0F?", "gu");
  const templates = new Map();

  function makeIcon(name) {
    if (!Object.hasOwn(icons, name)) return null;
    if (!templates.has(name)) {
      const svg = document.createElementNS(ns, "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("width", "1.15em");
      svg.setAttribute("height", "1.15em");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("focusable", "false");
      svg.setAttribute("data-solar-rendered", name);
      svg.style.verticalAlign = "-0.2em";
      svg.style.flexShrink = "0";
      svg.innerHTML = icons[name]; // Bundled, static Solar artwork.
      templates.set(name, svg);
    }
    return templates.get(name).cloneNode(true);
  }

  function renderSlot(slot) {
    if (slot.closest(excluded) || slot.firstElementChild?.hasAttribute("data-solar-rendered")) return;
    const role = [...slot.classList].find(name => name.startsWith("sd-icon--"));
    const name = slot.dataset.solar || (role && roles[role.slice(9)]);
    if (!name) return;
    const icon = makeIcon(name);
    if (!icon) return;
    slot.setAttribute("aria-hidden", "true");
    slot.replaceChildren(icon);
  }

  function renderText(node) {
    if (!node.parentElement || node.parentElement.closest(excluded)) return;
    const matches = [...node.data.matchAll(pattern)];
    if (!matches.length) return;
    const fragment = document.createDocumentFragment();
    let end = 0;
    for (const match of matches) {
      const icon = makeIcon(glyphs[match[0].replaceAll("\uFE0F", "")]);
      if (!icon) continue;
      fragment.append(node.data.slice(end, match.index), icon);
      end = match.index + match[0].length;
    }
    if (end) {
      fragment.append(node.data.slice(end));
      node.replaceWith(fragment);
    }
  }

  function render(node) {
    if (node.nodeType === Node.TEXT_NODE) { renderText(node); return; }
    if (node.nodeType !== Node.ELEMENT_NODE || node.closest(excluded)) return;
    if (node.matches(slots)) renderSlot(node);
    node.querySelectorAll(slots).forEach(renderSlot);
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    texts.forEach(renderText);
  }

  function observe(container) {
    render(container);
    const observer = new MutationObserver(records => {
      const nodes = new Set();
      for (const record of records) {
        if (record.type === "characterData") nodes.add(record.target);
        else for (const node of record.addedNodes) nodes.add(node);
      }
      for (const node of nodes) if (container.contains(node)) render(node);
    });
    observer.observe(container, { subtree: true, childList: true, characterData: true });
  }

  root.StudashSolar = { render };
  if (document.body?.hasAttribute("data-studash-solar")) {
    observe(document.body);
  }
})(globalThis);
