import React, { useState } from 'react';
import { HuskDocument, DocumentTemplate } from '../types';
import { ConfirmDialog } from './ConfirmDialog';
import {
  FileText,
  Plus,
  Trash2,
  Copy,
  Calendar,
  Search,
  ExternalLink,
  Download,
} from 'lucide-react';

interface DocumentsLibraryProps {
  documents: HuskDocument[];
  templates: DocumentTemplate[];
  onOpenDocument: (doc: HuskDocument) => void;
  onCreateNewDocument: (template: DocumentTemplate) => void;
  onDuplicateDocument: (doc: HuskDocument) => void;
  onDeleteDocument: (id: string) => void;
  onExportPDF: (doc: HuskDocument) => void;
}

export const DocumentsLibrary: React.FC<DocumentsLibraryProps> = ({
  documents,
  templates,
  onOpenDocument,
  onCreateNewDocument,
  onDuplicateDocument,
  onDeleteDocument,
  onExportPDF,
}) => {
  const [search, setSearch] = useState('');
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<HuskDocument | null>(null);

  const filteredDocs = documents.filter(
    (d) =>
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.subtitle.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col bg-[#121110] overflow-y-auto">
      {/* Top Header */}
      <div className="px-8 py-6 border-b border-[#26231f] bg-[#161513] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Saved Documents</h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Manage your company documents, export PDFs, or create new ones
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents..."
              className="pl-9 pr-3 py-1.5 rounded-xl bg-[#22201d] border border-[#322f2a] text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#FF4C00] w-56"
            />
          </div>

          <button
            onClick={() => setShowTemplatePicker(true)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#FF4C00] hover:bg-[#DB5100] text-white flex items-center gap-2 shadow-lg shadow-[#FF4C00]/20 transition"
          >
            <Plus className="w-4 h-4" /> New Document
          </button>
        </div>
      </div>

      {/* Grid of Documents */}
      <div className="p-8 flex-1">
        {filteredDocs.length === 0 ? (
          <div className="h-96 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-[#FF4C00]/10 border border-[#FF4C00]/25 flex items-center justify-center text-[#FF4C00] mb-4 shadow-sm">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-white">No documents found</h3>
            <p className="text-xs text-stone-400 mt-1 mb-5">
              Create your official company document from one of your saved templates.
            </p>
            <button
              onClick={() => setShowTemplatePicker(true)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#FF4C00] hover:bg-[#DB5100] text-white flex items-center gap-2 transition"
            >
              <Plus className="w-4 h-4" /> Create Document
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                onClick={() => onOpenDocument(doc)}
                className="bg-[#181715] border border-[#2b2722] hover:border-[#FF4C00]/60 hover:bg-[#1f1d1a] rounded-2xl p-5 cursor-pointer transition shadow-lg group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shadow"
                        style={{ backgroundColor: doc.branding.primaryColor || '#FF4C00' }}
                      />
                      <span className="text-xs font-medium text-stone-400">
                        {doc.branding.companyName || 'Document'}
                      </span>
                    </div>

                    <span className="text-[10px] text-stone-500 flex items-center gap-1 font-mono">
                      <Calendar className="w-3 h-3" />
                      {new Date(doc.updatedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white group-hover:text-[#FF4C00] transition line-clamp-1">
                    {doc.title || 'Untitled Document'}
                  </h3>
                  <p className="text-xs text-stone-400 line-clamp-2 mt-1 leading-relaxed">
                    {doc.subtitle || 'No description'}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-[#26231f] flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicateDocument(doc);
                      }}
                      title="Duplicate Document"
                      className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-[#282520] transition"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onExportPDF(doc);
                      }}
                      title="Export as PDF"
                      className="p-1.5 rounded-lg text-stone-400 hover:text-[#FF4C00] hover:bg-[#282520] transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDelete(doc);
                      }}
                      title="Delete"
                      className="p-1.5 rounded-lg text-stone-400 hover:text-rose-400 hover:bg-[#282520] transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <span className="text-xs font-semibold text-[#FF4C00] group-hover:translate-x-1 transition flex items-center gap-1">
                    Open <ExternalLink className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete "${pendingDelete.title || 'Untitled Document'}"?`}
          message="This document is removed for good. Export a PDF first if you still need it."
          onConfirm={() => {
            onDeleteDocument(pendingDelete.id);
            setPendingDelete(null);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {/* Template picker modal */}
      {showTemplatePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl bg-[#181715] border border-[#322f2a] rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-white">Choose a Template</h3>
                <p className="text-xs text-stone-400">Select which company template to start with</p>
              </div>
              <button
                onClick={() => setShowTemplatePicker(false)}
                className="text-stone-400 hover:text-white text-xs px-2 py-1 rounded"
              >
                Close
              </button>
            </div>

            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => {
                    onCreateNewDocument(tpl);
                    setShowTemplatePicker(false);
                  }}
                  className="p-3.5 rounded-xl border border-[#2e2a24] hover:border-[#FF4C00] bg-[#22201d]/60 hover:bg-[#22201d] cursor-pointer transition flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full border border-white/20"
                      style={{ backgroundColor: tpl.branding.primaryColor || '#FF4C00' }}
                    />
                    <div>
                      <h4 className="text-sm font-semibold text-white">{tpl.name}</h4>
                      <p className="text-xs text-stone-400 line-clamp-1">{tpl.description}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-[#FF4C00]">Select →</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
