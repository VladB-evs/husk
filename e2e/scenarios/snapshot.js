// Reports what the app shows after start: titles in All Documents, templates, and what the app can reach.
module.exports = async (ctx) => {
  await ctx.clickText('All Documents');
  await ctx.sleep(500);
  const documents = await ctx.exec(`[...document.querySelectorAll('h3')].map((h) => h.textContent)`);
  await ctx.shot('documents');
  await ctx.clickText('Template Studio');
  await ctx.sleep(1200);
  const templates = await ctx.exec(`[...document.querySelectorAll('h3')].map((h) => h.textContent)`);
  const toasts = await ctx.exec(`[...document.querySelectorAll('.fixed')].map((e) => e.textContent).join(' | ')`);
  const security = await ctx.exec(`({
    hasRequire: typeof require !== 'undefined',
    hasProcess: typeof process !== 'undefined',
    csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || null,
    api: Object.keys(window.electronAPI || {}),
  })`);
  return { documents, templates, toasts, security };
};
