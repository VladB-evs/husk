import { app, BrowserWindow, ipcMain, dialog, shell, session, Menu } from 'electron';
import type { IpcMainEvent, IpcMainInvokeEvent, MenuItemConstructorOptions } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { pathToFileURL } from 'url';
import { PAGE_MM } from '../src/shared/documentLayout';
import { buildPrintHtml, buildFooterTemplate } from '../src/shared/printDocument';
import { buildInterFaceCss } from '../src/shared/fontFace';
import * as store from './store';
import * as updater from './updater';

// Tests point these at scratch folders. Normal runs use ~/Documents/HUSK.
const DATA_DIR = process.env.HUSK_DATA_DIR || path.join(os.homedir(), 'Documents', 'HUSK');
if (process.env.HUSK_USER_DATA) app.setPath('userData', process.env.HUSK_USER_DATA);

const dirs = store.storeDirs(DATA_DIR);

const DIST_DIR = path.join(__dirname, '../../dist');
const DIST_URL = pathToFileURL(DIST_DIR).href;
const DEV_URL = process.env.VITE_DEV_SERVER_URL || '';

let mainWindow: BrowserWindow | null = null;

const isAppUrl = (url: string) => url.startsWith(DIST_URL) || (!!DEV_URL && url.startsWith(DEV_URL));

/** Only the app's own window may call into the main process. */
function isTrusted(event: IpcMainEvent | IpcMainInvokeEvent) {
  if (!mainWindow || event.sender !== mainWindow.webContents) return false;
  return isAppUrl(event.senderFrame?.url || event.sender.getURL());
}

function handle(channel: string, fn: (...args: any[]) => unknown) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrusted(event)) throw new Error(`Blocked IPC call from an untrusted sender: ${channel}`);
    return fn(...args);
  });
}

function openExternalSafely(url: string) {
  if (/^https?:\/\//i.test(url)) shell.openExternal(url);
}

function lockDownContents(win: BrowserWindow) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafely(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) event.preventDefault();
  });
}

/**
 * Right-click menu. Electron shows no menu on its own, so this builds the usual one:
 * spelling suggestions, Add to Dictionary, Undo/Cut/Copy/Paste/Select All, and Look Up (the macOS dictionary).
 * The frame passed to popup() lets macOS add its own entries (Writing Tools, AutoFill, Services) to the menu.
 */
function addContextMenu(win: BrowserWindow) {
  const wc = win.webContents;
  wc.on('context-menu', (_event, params) => {
    const items: MenuItemConstructorOptions[] = [];
    const word = params.misspelledWord;

    if (params.isEditable && word) {
      const suggestions = params.dictionarySuggestions.slice(0, 5);
      suggestions.forEach((suggestion) =>
        items.push({ label: suggestion, click: () => wc.replaceMisspelling(suggestion) })
      );
      if (!suggestions.length) items.push({ label: 'No guesses found', enabled: false });
      items.push({
        label: 'Add to Dictionary',
        click: () => {
          wc.session.addWordToSpellCheckerDictionary(word);
          wc.send('dictionary-word-added', word); // the autocorrect learns it too
        },
      });
      items.push({ type: 'separator' });
    }

    const selected = params.selectionText.trim();
    if (selected && process.platform === 'darwin') {
      const shown = selected.length > 24 ? `${selected.slice(0, 24)}…` : selected;
      items.push({ label: `Look Up “${shown}”`, click: () => wc.showDefinitionForSelection() });
      items.push({ type: 'separator' });
    }

    if (params.isEditable) {
      items.push(
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'selectAll' }
      );
    } else if (selected) {
      items.push({ role: 'copy' }, { role: 'selectAll' });
    }

    // Passing the frame lets macOS add its own items to this menu: Writing Tools, AutoFill and Services
    if (items.length) Menu.buildFromTemplate(items).popup({ window: win, frame: params.frame ?? undefined });
  });
}

function createWindow() {
  store.ensureDirs(dirs);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 560, // small enough for half of a screen in Split View
    minHeight: 520,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: '#121110',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: true, // red underline for misspelled words, and suggestions in the right-click menu
    },
  });
  lockDownContents(mainWindow);
  addContextMenu(mainWindow);

  if (DEV_URL) {
    mainWindow.loadURL(DEV_URL);
  } else if (fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    mainWindow.loadFile(path.join(DIST_DIR, 'index.html'));
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // The app asks for no browser permissions (camera, location, notifications, ...)
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));

  // Dock icon: HUSK logo (public/ in dev, dist/ in a build)
  const iconFile = [
    path.join(DIST_DIR, 'app-icon.png'),
    path.join(__dirname, '../../public/app-icon.png'),
  ].find((f) => fs.existsSync(f));
  if (iconFile) app.dock?.setIcon(iconFile);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ───────────────────────── storage ─────────────────────────

handle('get-storage-paths', () => {
  store.ensureDirs(dirs);
  return { base: dirs.base, templates: dirs.templates, documents: dirs.documents, signatures: dirs.signatures, exports: dirs.exports };
});

handle('open-husk-folder', async (subfolder?: string) => {
  store.ensureDirs(dirs);
  const map: Record<string, string> = {
    templates: dirs.templates,
    documents: dirs.documents,
    exports: dirs.exports,
    signatures: dirs.signatures,
  };
  await shell.openPath((subfolder && map[subfolder]) || dirs.base);
  return true;
});

handle('storage-load-all', () => store.loadAll(dirs));
handle('storage-migrate', (data: { documents: any[]; templates: any[] }) => store.migrate(dirs, data));

const result = (fn: () => unknown) => {
  try {
    return { success: true, filePath: fn() };
  } catch (err: any) {
    return { success: false, error: err.message as string };
  }
};

handle('save-document', (doc: any) => result(() => store.saveDocument(dirs, doc)));
handle('delete-document', (id: string) => result(() => store.deleteDocument(dirs, id)));
handle('save-template', (template: any) => result(() => store.saveTemplate(dirs, template)));
handle('delete-template', (id: string) => result(() => store.deleteTemplate(dirs, id)));
handle('load-profile', () => store.loadProfile(dirs));
handle('save-profile', (profile: any) => result(() => store.saveProfile(dirs, profile)));

// Synchronous save, used when the window is closing and pending edits must reach the disk first
ipcMain.on('save-document-sync', (event, doc: any) => {
  event.returnValue = isTrusted(event) ? result(() => store.saveDocument(dirs, doc)) : { success: false, error: 'Untrusted sender' };
});

handle('show-item-in-folder', (fullPath: string) => {
  const resolved = path.resolve(String(fullPath));
  if (resolved.startsWith(path.resolve(dirs.base) + path.sep)) shell.showItemInFolder(resolved);
  return true;
});

handle('get-app-version', () => app.getVersion());

// ───────────────────────── updates ─────────────────────────

// Only an installed app updates itself. `electron .` (dev runs and the end-to-end tests) never does.
const updatesEnabled = () => app.isPackaged && process.platform === 'darwin';
const releaseArch = () => (process.arch === 'arm64' ? 'arm64' : 'x64');
let availableUpdate: updater.UpdateInfo | null = null;
let installingUpdate = false;

handle('update-check', async () => {
  if (!updatesEnabled()) return null;
  availableUpdate = await updater.checkForUpdate(app.getVersion(), releaseArch());
  return availableUpdate && { version: availableUpdate.version, notes: availableUpdate.notes };
});

handle('update-install', async () => {
  if (!updatesEnabled() || !availableUpdate || installingUpdate) return { success: false, error: 'No update to install' };
  installingUpdate = true;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'husk-download-'));
  try {
    const zip = await updater.downloadUpdate(availableUpdate, tmp, (fraction) =>
      mainWindow?.webContents.send('update-progress', fraction)
    );
    // exe is HUSK.app/Contents/MacOS/HUSK
    const appPath = path.resolve(app.getPath('exe'), '../../..');
    if (!appPath.endsWith('.app')) throw new Error('HUSK is not running from an app bundle');
    const { stage, newApp } = await updater.stageUpdate(zip, appPath);
    updater.launchSwap(process.pid, appPath, newApp, stage);
    // Closing the window saves any pending edit first (the page flushes on beforeunload)
    app.quit();
    return { success: true };
  } catch (err: any) {
    console.error('Update failed:', err);
    installingUpdate = false;
    return { success: false, error: err.message as string };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ───────────────────────── PDF export ─────────────────────────

let interCssCache: string | null = null;
function interFontCss(): string {
  if (interCssCache === null) {
    try {
      const dataUrl = (name: string) =>
        `data:font/woff2;base64,${fs.readFileSync(require.resolve(`@fontsource-variable/inter/files/${name}`)).toString('base64')}`;
      interCssCache = buildInterFaceCss({
        latin: dataUrl('inter-latin-wght-normal.woff2'),
        latinExt: dataUrl('inter-latin-ext-wght-normal.woff2'),
      });
    } catch (err) {
      console.error('Could not load the bundled Inter font', err);
      interCssCache = '';
    }
  }
  return interCssCache;
}

handle('export-clean-pdf', async (doc: any) => {
  store.ensureDirs(dirs);
  if (!mainWindow) return { success: false, error: 'Window not found' };
  if (!doc || typeof doc !== 'object') return { success: false, error: 'No document to export' };

  try {
    const defaultFileName = `${(doc.title || 'Official-Document')
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .trim()
      .replace(/\s+/g, '-') || 'Document'}.pdf`;

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export PDF',
      defaultPath: path.join(dirs.exports, defaultFileName),
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    // The print HTML goes through a temp file so local images (logo, signature) load.
    const htmlPath = path.join(os.tmpdir(), `husk-export-${Date.now()}.html`);
    await fs.promises.writeFile(htmlPath, buildPrintHtml(doc, { fontCss: interFontCss() }), 'utf-8');

    const printWin = new BrowserWindow({
      show: false,
      width: 794,
      height: 1123,
      backgroundColor: '#ffffff',
      webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true },
    });
    printWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    printWin.webContents.on('will-navigate', (event) => event.preventDefault());

    let pdfData: Buffer;
    try {
      await printWin.loadFile(htmlPath);
      // Wait for fonts and images so the layout is final before printing
      await printWin.webContents.executeJavaScript(`Promise.race([
        Promise.all([
          document.fonts ? document.fonts.ready : null,
          ...Array.from(document.images).map((img) => img.decode().catch(() => null)),
        ]),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]).then(() => true)`);

      const showFooter = doc.footerConfig && doc.footerConfig.enabled !== false;
      const inch = (mm: number) => mm / 25.4;
      pdfData = await printWin.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        margins: {
          top: inch(PAGE_MM.marginTop),
          bottom: inch(PAGE_MM.marginBottom),
          left: inch(PAGE_MM.marginX),
          right: inch(PAGE_MM.marginX),
        },
        displayHeaderFooter: !!showFooter,
        headerTemplate: '<span></span>',
        footerTemplate: showFooter ? buildFooterTemplate(doc, interFontCss()) : '<span></span>',
        preferCSSPageSize: false,
      });
    } finally {
      printWin.close();
      fs.promises.unlink(htmlPath).catch(() => {});
    }

    await fs.promises.writeFile(filePath, pdfData);
    return { success: true, filePath };
  } catch (err: any) {
    console.error('Failed to export PDF:', err);
    return { success: false, error: err.message };
  }
});

// ───────────────────────── window controls ─────────────────────────

ipcMain.on('window-close', (event) => isTrusted(event) && mainWindow?.close());
ipcMain.on('window-minimize', (event) => isTrusted(event) && mainWindow?.minimize());
ipcMain.on('window-maximize', (event) => {
  if (!isTrusted(event) || !mainWindow) return;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});
