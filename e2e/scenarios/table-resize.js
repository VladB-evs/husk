// Drags a column border and a row border with the mouse, as a user would.
module.exports = async (ctx) => {
  await ctx.clickText('Document Editor');
  await ctx.sleep(1500);

  const rows = `'.ProseMirror table tr:not(.husk-pg-spacer):not(.husk-pg-repeat)'`;
  const locate = async (rowIdx, colIdx, which) => {
    await ctx.exec(`document.querySelectorAll(${rows})[${rowIdx}].children[${colIdx}].scrollIntoView({ block: 'center' })`);
    await ctx.sleep(600);
    return ctx.exec(`(() => { const c = document.querySelectorAll(${rows})[${rowIdx}].children[${colIdx}]; const r = c.getBoundingClientRect(); return { x: ${which === 'col'} ? r.right - 1 : r.left + 15, y: ${which === 'col'} ? r.top + r.height / 2 : r.bottom - 1, h: r.height }; })()`);
  };
  const drag = async (g, dx, dy) => {
    ctx.mouse('mouseMove', g.x - 10, g.y - 10);
    await ctx.sleep(80);
    ctx.mouse('mouseMove', g.x, g.y);
    await ctx.sleep(120);
    const cursor = await ctx.exec(`document.querySelector('.ProseMirror').style.cursor`);
    ctx.mouse('mouseDown', g.x, g.y);
    for (let i = 1; i <= 15; i++) {
      ctx.mouse('mouseMove', g.x + (dx * i) / 15, g.y + (dy * i) / 15);
      await ctx.sleep(20);
    }
    ctx.mouse('mouseUp', g.x + dx, g.y + dy);
    await ctx.sleep(500);
    return cursor;
  };
  const state = () =>
    ctx.exec(`(() => {
      const table = document.querySelector('.ProseMirror table');
      const pm = document.querySelector('.ProseMirror').getBoundingClientRect();
      const t = table.getBoundingClientRect();
      const trs = document.querySelectorAll(${rows});
      return {
        tableWidth: t.width,
        pmWidth: pm.width,
        inside: t.left >= pm.left - 1 && t.right <= pm.right + 1,
        cols: [...table.querySelectorAll('colgroup col')].map((c) => parseFloat(c.style.width)),
        rowAttr: [...trs].map((tr) => tr.getAttribute('data-row-height')),
        rowHeights: [...trs].map((tr) => tr.getBoundingClientRect().height),
      };
    })()`);

  const before = await state();
  const colCursor = await drag(await locate(14, 0, 'col'), 120, 0);
  const afterNarrow = await state();
  await drag(await locate(14, 1, 'col'), 600, 0); // far beyond the page edge
  const afterWide = await state();
  const g = await locate(16, 0, 'row');
  const rowCursor = await drag(g, 0, 60);
  const afterRowGrow = await state();
  await drag(await locate(16, 0, 'row'), 0, -60);
  const afterRowShrink = await state();

  // undo goes back one step at a time: the row shrink, then the row grow
  await ctx.exec(`document.querySelector('.ProseMirror').focus()`);
  await ctx.wc.sendInputEvent({ type: 'keyDown', keyCode: 'z', modifiers: ['meta'] });
  await ctx.wc.sendInputEvent({ type: 'keyUp', keyCode: 'z', modifiers: ['meta'] });
  await ctx.sleep(400);
  const afterUndo = await state();

  return { before, colCursor, afterNarrow, afterWide, rowCursor, rowStart: g.h, afterRowGrow, afterRowShrink, afterUndo };
};
