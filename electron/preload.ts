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
  closeWindow: () => ipcRenderer.send('window-close'),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
});
