// Opens the first document, reports the page the editor shows, optionally exports a PDF.
module.exports = async (ctx) => {
  await ctx.clickText('Document Editor');
  await ctx.sleep(1500);
  const info = await ctx.exec(`(() => {
    const sheet = document.querySelector('.hd-edit').getBoundingClientRect();
    const pm = document.querySelector('.ProseMirror');
    const pages = [...document.querySelectorAll('.hd-edit > div.bg-white')].length;
    const table = pm.querySelector('table');
    const rect = (e) => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width }; };
    // which rows are first on a page, and which header copies are shown
    const rowsText = [...pm.querySelectorAll('table tr:not(.husk-pg-spacer):not(.husk-pg-repeat)')].map((tr) => tr.textContent.slice(0, 12));
    const firstAfterGap = [...pm.querySelectorAll('tr.husk-pg-spacer')].map((s) => {
      let n = s.nextElementSibling;
      while (n && n.classList.contains('husk-pg-repeat')) n = n.nextElementSibling;
      return n ? n.textContent.slice(0, 12) : null;
    });
    const g = ${JSON.stringify(ctx.args.geometry || null)};
    const pitch = g ? g.height + g.gap : 0;
    // text that sits in a bottom margin or in the gap between pages is a layout error
    let violations = 0;
    if (g) {
      const walker = document.createTreeWalker(pm, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        if (t.parentElement.closest('.husk-pg-spacer')) continue;
        range.selectNodeContents(t);
        for (const r of range.getClientRects()) {
          if (r.height === 0) continue;
          const y0 = r.top - sheet.top, y1 = r.bottom - sheet.top;
          const k = Math.floor(y0 / pitch);
          if (y1 > k * pitch + g.height - g.marginBottom + 1 || y0 < k * pitch + g.marginTop - 1 && k > 0) { violations++; (window.__v = window.__v || []).push({ y0: Math.round(y0), y1: Math.round(y1), k, text: t.textContent.slice(0, 20) }); }
        }
      }
    }
    const breaks = [...pm.querySelectorAll('.husk-pg-spacer')].map((s) => {
      let n = s.nextSibling;
      while (n && n.nodeType === 1 && n.classList.contains('husk-pg-repeat')) n = n.nextSibling;
      return { tag: s.tagName, text: (n ? n.textContent : '').trim().slice(0, 40) };
    });
    return {
      violations,
      violationList: window.__v || [],
      breaks,
      pages,
      footerTexts: [...document.querySelectorAll('.hd-edit span')].map((s) => s.textContent).filter((t) => /^Page \\d+ of \\d+$/.test(t)),
      pmWidth: pm.getBoundingClientRect().width,
      tableWidth: table ? table.getBoundingClientRect().width : null,
      tableInsidePage: table ? rect(table).left >= rect(pm).left - 1 && rect(table).right <= rect(pm).right + 1 : null,
      firstAfterGap,
      repeatedHeaders: pm.querySelectorAll('tr.husk-pg-repeat').length,
      font: getComputedStyle(pm).fontFamily,
      fontLoaded: document.fonts.check('13px "Inter Variable"'),
    };
  })()`);
  await ctx.shot('editor');
  let exported = null;
  if (ctx.args.exportPath) {
    // export the document as it is stored after the editor opened it (what the library would export)
    await ctx.sleep(900);
    exported = await ctx.exec(`window.electronAPI.storageLoadAll().then((r) => window.electronAPI.exportCleanPDF(r.documents.find((d) => d.id === ${JSON.stringify(ctx.args.docId)})))`);
  }
  return { info, exported };
};
