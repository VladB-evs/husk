import React, { useState, useEffect, useCallback } from 'react';
import { ViewMode, HuskDocument, DocumentTemplate } from './types';
import {
  AppData,
  loadAppData,
  persistDocument,
  persistTemplate,
  removeDocument,
  removeTemplate,
  flushPendingSync,
  subscribeSaveStatus,
  type SaveStatus,
  setSaveErrorHandler,
  getCurrentDocId,
  setCurrentDocId,
  createDocumentFromTemplate,
  getStoredUserProfile,
} from './utils/storage';
import { buildPrintHtml } from './shared/printDocument';
import { INTER_FACE_CSS } from './utils/fonts';
import { TitleBar } from './components/TitleBar';
import { DocumentEditor } from './components/DocumentEditor';
import { TemplateStudio } from './components/TemplateStudio';
import { DocumentsLibrary } from './components/DocumentsLibrary';
import { BrandingSettingsModal } from './components/BrandingSettingsModal';
import { SignatureModal } from './components/SignatureModal';
import { CheckCircle2, AlertCircle, FolderCheck, FileText } from 'lucide-react';

export const App: React.FC = () => {
  const [data, setData] = useState<AppData | null>(null);

  useEffect(() => {
    loadAppData().then(setData);
  }, []);

  if (!data) return <div className="h-full bg-[#121110]" />;
  return <Workspace initial={data} />;
};

const Workspace: React.FC<{ initial: AppData }> = ({ initial }) => {
  const [templates, setTemplates] = useState<DocumentTemplate[]>(initial.templates);
  const [documents, setDocuments] = useState<HuskDocument[]>(initial.documents);
  const [currentDocId, setCurrentDocIdState] = useState<string>(() => {
    const savedId = getCurrentDocId();
    if (savedId && documents.some((d) => d.id === savedId)) return savedId;
    return documents[0]?.id || '';
  });

  const [currentView, setCurrentView] = useState<ViewMode>('editor');
  // null = fit the page to the window width; a number = the zoom the user chose
  const [zoomChoice, setZoomChoice] = useState<number | null>(null);
  const [fitZoom, setFitZoom] = useState<number>(1);
  const zoomLevel = zoomChoice ?? fitZoom;
  const [isBrandingModalOpen, setIsBrandingModalOpen] = useState<boolean>(false);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error';
    filePath?: string;
  } | null>(null);

  const currentDoc =
    documents.find((d) => d.id === currentDocId) || documents[0];

  const userProfile = getStoredUserProfile();

  const showNotification = (
    message: string,
    type: 'success' | 'error' = 'success',
    filePath?: string
  ) => {
    setNotification({ message, type, filePath });
    setTimeout(() => {
      setNotification(null);
    }, 6000);
  };

  useEffect(() => {
    setSaveErrorHandler((message) => showNotification(message, 'error'));
    initial.notices.forEach((n) => showNotification(n));
    window.addEventListener('beforeunload', flushPendingSync);
    const unsubscribe = subscribeSaveStatus(setSaveStatus);
    return () => {
      window.removeEventListener('beforeunload', flushPendingSync);
      unsubscribe();
    };
  }, []);

  const handleOpenHuskFolder = async (subfolder?: string) => {
    if (window.electronAPI) {
      await window.electronAPI.openHuskFolder(subfolder);
    } else {
      showNotification('Saved at ~/Documents/HUSK on your Mac');
    }
  };

  const handleUpdateCurrentDoc = useCallback(
    (updated: HuskDocument) => {
      setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      persistDocument(updated);
    },
    []
  );

  const handleCreateDocument = (template: DocumentTemplate) => {
    const newDoc = createDocumentFromTemplate(template);
    setDocuments([newDoc, ...documents]);
    persistDocument(newDoc);
    setCurrentDocIdState(newDoc.id);
    setCurrentDocId(newDoc.id);
    setCurrentView('editor');
    showNotification(`New document created from "${template.name}"`);
  };

  const handleDuplicateDocument = (doc: HuskDocument) => {
    const duplicated: HuskDocument = {
      ...doc,
      id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      title: `${doc.title} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setDocuments([duplicated, ...documents]);
    persistDocument(duplicated);
    showNotification('Document duplicated and saved to ~/Documents/HUSK/Documents');
  };

  const handleDeleteDocument = (id: string) => {
    const nextDocs = documents.filter((d) => d.id !== id);
    setDocuments(nextDocs);
    removeDocument(id);
    if (currentDocId === id) {
      const nextId = nextDocs[0]?.id || '';
      setCurrentDocIdState(nextId);
      setCurrentDocId(nextId);
    }
    showNotification('Document deleted');
  };

  const handleSaveTemplate = (tpl: DocumentTemplate) => {
    setTemplates((prev) =>
      prev.some((t) => t.id === tpl.id) ? prev.map((t) => (t.id === tpl.id ? tpl : t)) : [...prev, tpl]
    );
    persistTemplate(tpl);
  };

  const handleDeleteTemplate = (templateId: string) => {
    setTemplates(templates.filter((t) => t.id !== templateId));
    removeTemplate(templateId);
    showNotification('Template deleted');
  };

  // PDF export: Electron prints the A4 document itself. In a plain browser we print it from a hidden frame.
  const handleExportPDF = async (target: HuskDocument | undefined = currentDoc) => {
    if (!target) return;

    if (window.electronAPI) {
      showNotification('Generating A4 PDF...', 'success');

      const result = await window.electronAPI.exportCleanPDF(target);

      if (result.success && result.filePath) {
        showNotification(
          `Exported PDF to ${result.filePath.split('/').pop()}`,
          'success',
          result.filePath
        );
      } else if (!result.canceled && result.error) {
        showNotification(`Export failed: ${result.error}`, 'error');
      }
    } else {
      const frame = window.document.createElement('iframe');
      frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
      frame.onload = () => {
        setTimeout(() => {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
          setTimeout(() => frame.remove(), 1000);
        }, 400);
      };
      frame.srcdoc = buildPrintHtml(target, { browserPrint: true, fontCss: INTER_FACE_CSS });
      window.document.body.appendChild(frame);
    }
  };

  // Keyboard shortcuts (Cmd+P for PDF export)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        handleExportPDF();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentDoc]);

  return (
    <div className="h-full flex flex-col bg-[#121110] text-stone-100 font-sans overflow-hidden">
      {/* Top Title Bar */}
      <TitleBar
        currentView={currentView}
        onViewChange={setCurrentView}
        currentDoc={currentDoc}
        onExportPDF={() => handleExportPDF()}
        onOpenBranding={() => setIsBrandingModalOpen(true)}
        onOpenHuskFolder={() => handleOpenHuskFolder()}
        zoomLevel={zoomLevel}
        onZoomChange={setZoomChoice}
        onZoomReset={() => setZoomChoice(null)}
        saveStatus={saveStatus}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative">
        {currentView === 'editor' && currentDoc && (
          <DocumentEditor
            document={currentDoc}
            onChange={handleUpdateCurrentDoc}
            zoomLevel={zoomLevel}
            onFitZoomChange={setFitZoom}
          />
        )}

        {currentView === 'editor' && !currentDoc && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 px-6">
            <div className="w-16 h-16 rounded-2xl bg-[#FF4C00]/10 border border-[#FF4C00]/25 flex items-center justify-center text-[#FF4C00]">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">No document open</h3>
              <p className="text-xs text-stone-400 mt-1">Start a new document from one of your templates.</p>
            </div>
            <button
              onClick={() => setCurrentView('templates')}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#FF4C00] hover:bg-[#DB5100] text-white transition"
            >
              Choose a template
            </button>
          </div>
        )}

        {currentView === 'templates' && (
          <TemplateStudio
            templates={templates}
            documents={documents}
            onCreateNewDocument={handleCreateDocument}
            onSaveTemplate={handleSaveTemplate}
            onDeleteTemplate={handleDeleteTemplate}
            onOpenSignatureModal={() => setIsSignatureModalOpen(true)}
            savedSignatureUrl={userProfile.savedSignatureUrl}
            onOpenHuskFolder={() => handleOpenHuskFolder('templates')}
          />
        )}

        {currentView === 'library' && (
          <DocumentsLibrary
            documents={documents}
            templates={templates}
            onOpenDocument={(doc) => {
              setCurrentDocIdState(doc.id);
              setCurrentDocId(doc.id);
              setCurrentView('editor');
            }}
            onCreateNewDocument={handleCreateDocument}
            onDuplicateDocument={handleDuplicateDocument}
            onDeleteDocument={handleDeleteDocument}
            onExportPDF={handleExportPDF}
          />
        )}
      </main>

      {/* Modals */}
      {currentDoc && (
        <BrandingSettingsModal
          isOpen={isBrandingModalOpen}
          onClose={() => setIsBrandingModalOpen(false)}
          branding={currentDoc.branding}
          onSaveBranding={(newBranding) => {
            handleUpdateCurrentDoc({ ...currentDoc, branding: newBranding });
            showNotification('Company branding and color schema updated');
          }}
          onSaveAsTemplate={(name, desc) => {
            const newTpl: DocumentTemplate = {
              id: 'template_' + Date.now(),
              name,
              description: desc,
              branding: currentDoc.branding,
              titlePlaceholder: currentDoc.title,
              subtitlePlaceholder: currentDoc.subtitle,
              metadataFields: currentDoc.metadataFields,
              signOffConfig: currentDoc.signOff,
              footerConfig: currentDoc.footerConfig,
              contentHtml: currentDoc.contentHtml,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            handleSaveTemplate(newTpl);
            showNotification(`Template "${name}" saved. Find it in Template Studio.`);
          }}
        />
      )}

      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onApplySignature={(sigUrl, name, role) => {
          if (currentDoc) {
            handleUpdateCurrentDoc({
              ...currentDoc,
              signOff: {
                ...currentDoc.signOff,
                signatureUrl: sigUrl,
                name: name || currentDoc.signOff.name,
                role: role || currentDoc.signOff.role,
              },
            });
            showNotification('Signature attached');
          }
        }}
      />

      {/* Floating Notification Toast */}
      {notification && (
        <div className="no-print fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#181715] border border-[#322f2a] shadow-2xl text-xs font-medium text-white animate-in slide-in-from-bottom duration-200">
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{notification.message}</span>
          {notification.filePath && window.electronAPI && (
            <button
              onClick={() => window.electronAPI?.showItemInFolder(notification.filePath!)}
              className="ml-2 text-[#FF4C00] hover:text-[#DB5100] underline font-semibold flex items-center gap-1"
            >
              <FolderCheck className="w-3.5 h-3.5" /> Show in Finder
            </button>
          )}
        </div>
      )}
    </div>
  );
};
