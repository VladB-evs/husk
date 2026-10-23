import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  exportCleanPDF: (doc: any) => ipcRenderer.invoke('export-clean-pdf', doc),
  exportPDF: (doc: any) => ipcRenderer.invoke('export-clean-pdf', doc), // alias
  getStoragePaths: () => ipcRenderer.invoke('get-storage-paths'),
  openHuskFolder: (subfolder?: string) => ipcRenderer.invoke('open-husk-folder', subfolder),
  storageLoadAll: () => ipcRenderer.invoke('storage-load-all'),
  storageMigrate: (data: { documents: any[]; templates: any[] }) => ipcRenderer.invoke('storage-migrate', data),
  saveDocument: (doc: any) => ipcRenderer.invoke('save-document', doc),
  saveDocumentSync: (doc: any) => ipcRenderer.sendSync('save-document-sync', doc),
  deleteDocument: (id: string) => ipcRenderer.invoke('delete-document', id),
  saveTemplate: (template: any) => ipcRenderer.invoke('save-template', template),
  deleteTemplate: (id: string) => ipcRenderer.invoke('delete-template', id),
  loadProfile: () => ipcRenderer.invoke('load-profile'),
  saveProfile: (profile: any) => ipcRenderer.invoke('save-profile', profile),
  showItemInFolder: (fullPath: string) => ipcRenderer.invoke('show-item-in-folder', fullPath),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdate: () => ipcRenderer.invoke('update-check'),
  installUpdate: () => ipcRenderer.invoke('update-install'),
  onUpdateProgress: (callback: (fraction: number) => void) => {
    const listener = (_event: unknown, fraction: number) => callback(fraction);
    ipcRenderer.on('update-progress', listener);
    return () => ipcRenderer.removeListener('update-progress', listener);
  },
  onDictionaryWordAdded: (callback: (word: string) => void) => {
    const listener = (_event: unknown, word: string) => callback(word);
    ipcRenderer.on('dictionary-word-added', listener);
    return () => ipcRenderer.removeListener('dictionary-word-added', listener);
  },
  closeWindow: () => ipcRenderer.send('window-close'),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
});
