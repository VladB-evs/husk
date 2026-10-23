// Types for a while and counts how often the save status changes and how often the disk is written.
module.exports = async (ctx) => {
  await ctx.clickText('Document Editor');
  await ctx.sleep(600);
  await ctx.exec(`(() => {
    window.__changes = [];
    const el = [...document.querySelectorAll('header span')].find((s) => /^(Saved|Saving)$/.test(s.textContent.trim()));
    window.__statusEl = el;
    new MutationObserver(() => window.__changes.push(el.textContent.trim())).observe(el, { childList: true, subtree: true, characterData: true });
    const i = document.querySelector('input.hd-title'); i.focus(); i.select();
  })()`);
  const writes = [];
  const fs = require('node:fs');
  const dir = require('node:path').join(process.env.HUSK_DATA_DIR, 'Documents');
  const mtime = () => fs.readdirSync(dir).filter((f) => f.endsWith('.husk')).map((f) => fs.statSync(require('node:path').join(dir, f)).mtimeMs).join(',');
  let last = mtime();
  const poll = setInterval(() => { const m = mtime(); if (m !== last) { writes.push(Date.now()); last = m; } }, 50);
  const text = 'Typing a long title letter by letter';
  const start = Date.now();
  for (const ch of text) { await ctx.wc.insertText(ch); await ctx.sleep(60); }
  const typingMs = Date.now() - start;
  await ctx.sleep(2600);
  clearInterval(poll);
  const status = await ctx.exec(`window.__statusEl.textContent.trim()`);
  const changes = await ctx.exec(`window.__changes.length`);
  return { letters: text.length, typingMs, writesWhileTyping: writes.filter((t) => t < start + typingMs).length, writesTotal: writes.length, statusChanges: changes, finalStatus: status };
};
