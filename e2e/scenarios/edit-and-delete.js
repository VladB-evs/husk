// Types into the first document's title, creates a second document from a template, deletes one document.
module.exports = async (ctx) => {
  const { retitle, deleteTitle, create } = ctx.args;
  if (create) {
    await ctx.clickText('Template Studio');
    await ctx.sleep(1200);
    await ctx.clickText('Use');
    await ctx.sleep(600);
  }
  if (retitle) {
    await ctx.clickText('Document Editor');
    await ctx.sleep(600);
    await ctx.exec(`(() => { const i = document.querySelector('input.hd-title'); i.focus(); i.select(); })()`);
    await ctx.wc.insertText(retitle);
    await ctx.sleep(2200); // longer than the save delay (1.5 s)
  }
  if (deleteTitle) {
    await ctx.clickText('All Documents');
    await ctx.sleep(500);
    const idx = await ctx.exec(`[...document.querySelectorAll('h3')].findIndex((h) => h.textContent === ${JSON.stringify(deleteTitle)})`);
    await ctx.exec(`document.querySelectorAll('button[title="Delete"]')[${idx}].click()`);
    await ctx.sleep(300);
    await ctx.exec(`(() => { const bs = [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Delete'); bs[bs.length - 1].click(); })()`);
    await ctx.sleep(600);
  }
  return true;
};
