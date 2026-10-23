// Shrinks the window to half a screen and reports whether everything still fits.
module.exports = async (ctx) => {
  const [minW] = ctx.win.getMinimumSize();
  const results = {};
  for (const width of [minW, 640, 760]) {
    ctx.win.setSize(width, 820);
    await ctx.sleep(700);
    results[width] = await ctx.exec(`(() => {
      const vw = window.innerWidth;
      const rightEdge = (sel) => { const e = document.querySelector(sel); return e ? Math.round(e.getBoundingClientRect().right) : null; };
      const exportBtn = [...document.querySelectorAll('header button')].find((b) => b.title.includes('A4 PDF'));
      const sheet = document.querySelector('.hd-edit');
      const scroller = sheet && sheet.closest('.overflow-auto');
      const toolbarH = Math.round(document.querySelector('.no-print.sticky, [class*="sticky top-0"]')?.getBoundingClientRect().height || 0);
      return {
        vw,
        pageScrollsSideways: document.documentElement.scrollWidth > vw,
        exportRight: exportBtn ? Math.round(exportBtn.getBoundingClientRect().right) : null,
        zoomLabel: [...document.querySelectorAll('header button')].map((b) => b.textContent.trim()).find((t) => /%$/.test(t)),
        pageRight: sheet ? Math.round(sheet.getBoundingClientRect().right) : null,
        scrollerRight: scroller ? Math.round(scroller.getBoundingClientRect().right) : null,
        scrollerScrollsSideways: scroller ? scroller.scrollWidth > scroller.clientWidth + 1 : null,
        toolbarH,
      };
    })()`);
    await ctx.shot(`w${width}`);
  }
  // other screens at the smallest width
  ctx.win.setSize(minW, 820);
  await ctx.sleep(500);
  await ctx.clickText('Template Studio');
  await ctx.sleep(1200);
  await ctx.shot('gallery');
  results.gallerySideways = await ctx.exec(`document.documentElement.scrollWidth > window.innerWidth`);
  await ctx.exec(`document.querySelector('button[title="Edit template"]').click()`);
  await ctx.sleep(1000);
  await ctx.shot('studio-editor');
  results.studioSideways = await ctx.exec(`document.documentElement.scrollWidth > window.innerWidth`);
  results.minWidth = minW;
  return results;
};
