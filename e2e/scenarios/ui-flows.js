// Template gallery and document library flows through the real UI.
module.exports = async (ctx) => {
  const titles = () => ctx.exec(`[...document.querySelectorAll('h3')].map((h) => h.textContent)`);
  const confirm = () => ctx.exec(`(() => { const bs = [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Delete'); bs[bs.length - 1].click(); })()`);
  const out = {};

  await ctx.clickText('Template Studio');
  await ctx.sleep(1200);
  out.galleryStart = await titles();

  // new template -> opens the editor, rename it, go back
  await ctx.clickText('New Template');
  await ctx.sleep(800);
  await ctx.exec(`(() => { const i = document.querySelector('input[placeholder="Template name"]'); i.focus(); i.select(); })()`);
  await ctx.wc.insertText('Brand B');
  await ctx.sleep(600);
  await ctx.clickText('All templates');
  await ctx.sleep(800);
  out.galleryAfterNew = await titles();

  // duplicate it
  await ctx.exec(`[...document.querySelectorAll('button[title="Duplicate template"]')].pop().click()`);
  await ctx.sleep(500);
  out.galleryAfterDuplicate = await titles();

  // delete the duplicate (the last card) with the confirm dialog; cancel first
  await ctx.exec(`[...document.querySelectorAll('button[title="Delete template"]')].pop().click()`);
  await ctx.sleep(300);
  await ctx.clickText('Cancel');
  await ctx.sleep(300);
  out.afterCancel = await titles();
  await ctx.exec(`[...document.querySelectorAll('button[title="Delete template"]')].pop().click()`);
  await ctx.sleep(300);
  await confirm();
  await ctx.sleep(500);
  out.galleryAfterDelete = await titles();

  // the last template cannot be deleted
  await ctx.exec(`[...document.querySelectorAll('button[title="Delete template"]')].pop().click()`);
  await ctx.sleep(300);
  await confirm();
  await ctx.sleep(500);
  out.deleteDisabledWhenOne = await ctx.exec(`[...document.querySelectorAll('button[title="Keep at least one template"]')].every((b) => b.disabled) && document.querySelectorAll('button[title="Keep at least one template"]').length`);

  // new document from the first template
  await ctx.exec(`document.querySelector('button.flex-1').click()`);
  await ctx.sleep(800);
  await ctx.clickText('All Documents');
  await ctx.sleep(500);
  out.documentsAfterCreate = await titles();
  return out;
};
