// Pretends this is the first start after an upgrade: browser storage holds documents, the disk holds old ghosts.
module.exports = async (ctx) => {
  await ctx.exec(`(() => {
    localStorage.removeItem('husk_disk_migrated_v1');
    localStorage.setItem('husk_documents_v2', JSON.stringify(${JSON.stringify(ctx.args.documents)}));
    localStorage.setItem('husk_templates_v2', JSON.stringify(${JSON.stringify(ctx.args.templates)}));
    localStorage.setItem('husk_user_profile_v2', JSON.stringify({ savedSignatureUrl: 'data:image/png;base64,AAAA', defaultName: 'Legacy Name', defaultRole: '' }));
  })()`);
  ctx.wc.reload();
  await ctx.sleep(2500);
  await ctx.appReady();
  return true;
};
