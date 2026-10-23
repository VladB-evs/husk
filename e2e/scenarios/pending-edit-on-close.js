// Types a title and closes the window at once. The edit must reach the disk before the app ends.
module.exports = async (ctx) => {
  await ctx.exec(`(() => { const i = document.querySelector('input.hd-title'); i.focus(); i.select(); })()`);
  await ctx.wc.insertText(ctx.args.title);
  ctx.win.close(); // no wait: the save delay has not passed
  await ctx.sleep(500);
  return true;
};
