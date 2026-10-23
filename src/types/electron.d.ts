export interface SaveResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  canceled?: boolean;
  error?: string;
}

export interface LoadedData {
  documents: any[];
  templates: any[];
  recovered: string[];
}

export interface ElectronAPI {
  isElectron: boolean;
  exportCleanPDF: (doc: any) => Promise<ExportResult>;
  exportPDF: (doc: any) => Promise<ExportResult>;
  getStoragePaths: () => Promise<{
    base: string;
    templates: string;
    documents: string;
    signatures: string;
    exports: string;
  }>;
  openHuskFolder: (subfolder?: string) => Promise<boolean>;
  storageLoadAll: () => Promise<LoadedData>;
  storageMigrate: (data: { documents: any[]; templates: any[] }) => Promise<LoadedData>;
  saveDocument: (doc: any) => Promise<SaveResult>;
  saveDocumentSync: (doc: any) => SaveResult;
  deleteDocument: (id: string) => Promise<SaveResult>;
  saveTemplate: (template: any) => Promise<SaveResult>;
  deleteTemplate: (id: string) => Promise<SaveResult>;
  loadProfile: () => Promise<any | null>;
  saveProfile: (profile: any) => Promise<SaveResult>;
  showItemInFolder: (fullPath: string) => Promise<boolean>;
  getAppVersion: () => Promise<string>;
  closeWindow: () => void;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
