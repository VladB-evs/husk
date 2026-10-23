// One app session for the end-to-end tests. Run with:  electron e2e/session.js <scenario> [json args]
// The data folder (HUSK_DATA_DIR) and the app profile (HUSK_USER_DATA) come from the environment, so a test
// can start the app several times on the same data. The scenario result is printed as "RESULT:<json>".
const { app, dialog, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const name = process.argv[2];
const args = JSON.parse(process.argv[3] || '{}');
const shotDir = process.env.HUSK_E2E_SHOTS || '';

dialog.showSaveDialog = async () => ({ canceled: false, filePath: args.exportPath || path.join(process.env.HUSK_DATA_DIR, 'e2e-export.pdf') });

require(path.join(__dirname, '../dist-electron/electron/main.js'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await app.whenReady();
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1440, 960);
  const wc = win.webContents;
  const consoleErrors = [];
  wc.on('console-message', (event) => {
    if (event.level === 'error') consoleErrors.push(event.message);
  });

  const exec = (code) => wc.executeJavaScript(code);
  const ctx = {
    win,
    wc,
    args,
    consoleErrors,
    exec,
    sleep,
    async waitFor(code, timeout = 8000) {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        if (await exec(code)) return true;
        await sleep(100);
      }
      throw new Error(`Timed out waiting for: ${code}`);
    },
    async shot(label) {
      if (!shotDir) return;
      fs.mkdirSync(shotDir, { recursive: true });
      fs.writeFileSync(path.join(shotDir, `${name}-${label}.png`), (await wc.capturePage()).toPNG());
    },
    mouse: (type, x, y) => wc.sendInputEvent({ type, x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 }),
    clickText: (text, selector = 'button') =>
      exec(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(selector)})].find((b) => b.textContent.trim().includes(${JSON.stringify(text)})); if (!b) return false; b.click(); return true; })()`),
    async appReady() {
      await ctx.waitFor(`!!document.querySelector('header') && document.body.innerText.length > 20`);
      await sleep(600);
    },
  };

  await ctx.appReady();
  const scenario = require(path.join(__dirname, 'scenarios', `${name}.js`));
  const result = await scenario(ctx);
  console.log('RESULT:' + JSON.stringify({ result: result ?? null, consoleErrors }));
}

main()
  .then(() => app.exit(0))
  .catch((err) => {
    console.log('RESULT:' + JSON.stringify({ error: String(err && err.stack ? err.stack : err) }));
    app.exit(1);
  });
