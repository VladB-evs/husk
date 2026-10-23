import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { Placeholder } from '@tiptap/extension-placeholder';
import { PageBreak } from '../extensions/PageBreak';
import { CustomTable, CustomTableRow, CustomTableCell, CustomTableHeader, TableKeys } from '../extensions/CustomTable';
import { Pagination, SIGNOFF_MARGIN } from '../extensions/Pagination';
import { Autocorrect } from '../extensions/Autocorrect';
import { HuskImage, ImageUpload, insertImageFiles, isImageFile } from '../extensions/ImageUpload';
import { addUserWord, loadSpellChecker } from '../utils/spell';
import type { PaginationPlan } from '../extensions/Pagination';
import { PAGE, buildDocumentCss, buildEditorChromeCss } from '../shared/documentLayout';
import { HuskDocument, MetadataField } from '../types';
import { Toolbar } from './Toolbar';
import { TableQuickControls } from './TableQuickControls';
import { SignatureModal } from './SignatureModal';
import { PenTool } from 'lucide-react';

interface DocumentEditorProps {
  document: HuskDocument;
  onChange: (updatedDoc: HuskDocument) => void;
  zoomLevel: number;
  /** Zoom at which the whole page width fits the window; reported when the window size changes. */
  onFitZoomChange?: (fit: number) => void;
}

const PITCH = PAGE.height + PAGE.gap;

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  document: doc,
  onChange,
  zoomLevel,
  onFitZoomChange,
}) => {
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [layout, setLayout] = useState({ pages: 1, signoffPush: 0 });

  const scrollRef = useRef<HTMLDivElement>(null);
  // Autocorrect (iPhone style). The choice is remembered on this Mac.
  const [autocorrectOn, setAutocorrectOn] = useState(() => {
    try {
      return localStorage.getItem('husk_autocorrect') !== 'off';
    } catch {
      return true;
    }
  });
  const autocorrectRef = useRef(autocorrectOn);
  autocorrectRef.current = autocorrectOn;
  const toggleAutocorrect = () =>
    setAutocorrectOn((on) => {
      try {
        localStorage.setItem('husk_autocorrect', on ? 'off' : 'on');
      } catch {
        // the choice just will not be remembered
      }
      return !on;
    });

  const sheetRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const signoffRef = useRef<HTMLDivElement>(null);

  // The editor is created once, so it reads the latest document through a ref.
  const docRef = useRef(doc);
  docRef.current = doc;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const onPlan = useCallback((plan: PaginationPlan) => {
    setLayout((prev) =>
      prev.pages === plan.pages && Math.abs(prev.signoffPush - plan.signoffPush) < 0.25
        ? prev
        : { pages: plan.pages, signoffPush: plan.signoffPush }
    );
  }, []);

  const editor = useEditor({
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      CustomTable.configure({ HTMLAttributes: { class: 'husk-document-table' } }),
      CustomTableRow,
      CustomTableHeader,
      CustomTableCell,
      TableKeys,
      PageBreak,
      HuskImage,
      ImageUpload,
      Autocorrect.configure({ isEnabled: () => autocorrectRef.current }),
      Placeholder.configure({ placeholder: 'Write your document sections, paragraphs, tables...' }),
      Pagination.configure({
        getEnv: () => (sheetRef.current ? { sheet: sheetRef.current, signoff: signoffRef.current } : null),
        onPlan,
      }),
    ],
    content: doc.contentHtml,
    onUpdate: ({ editor }) => {
      onChangeRef.current({
        ...docRef.current,
        contentHtml: editor.getHTML(),
        updatedAt: new Date().toISOString(),
      });
    },
  });

  const schedulePagination = useCallback(() => {
    (editor?.storage as any)?.pagination?.schedule();
  }, [editor]);

  // Load the spelling dictionary a moment after the editor opens, so the start of the app stays fast
  useEffect(() => {
    if (!autocorrectOn) return;
    const timer = setTimeout(() => void loadSpellChecker(), 600);
    return () => clearTimeout(timer);
  }, [autocorrectOn]);

  // "Add to Dictionary" in the right-click menu also teaches the autocorrect
  useEffect(() => window.electronAPI?.onDictionaryWordAdded(addUserWord), []);

  // Tell the app how far the page can be zoomed and still fit the window width
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !onFitZoomChange) return;
    const report = () => {
      const fit = (el.clientWidth - 32) / PAGE.width;
      onFitZoomChange(Math.min(1, Math.max(0.4, Math.floor(fit * 100) / 100)));
    };
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, [onFitZoomChange]);

  // Re-measure when anything above or below the editor changes size (title, metadata, sign-off, logo, fonts).
  useEffect(() => {
    if (!editor || !flowRef.current) return;
    const observer = new ResizeObserver(schedulePagination);
    observer.observe(flowRef.current);
    if (signoffRef.current) observer.observe(signoffRef.current);
    window.document.fonts?.ready.then(schedulePagination);
    schedulePagination();
    return () => observer.disconnect();
  }, [editor, schedulePagination, doc.signOff.enabled]);

  // Keep TipTap in sync if the open document changes. The editor adds structure the stored HTML may not have
  // (for example an empty paragraph after a table), so the document is saved in the editor's own form. That
  // way the PDF, which is made from the stored HTML, has the same content as the page on screen.
  useEffect(() => {
    if (!editor) return;
    if (doc.contentHtml !== editor.getHTML()) {
      editor.commands.setContent(doc.contentHtml, { emitUpdate: false });
    }
    const normalized = editor.getHTML();
    if (normalized !== doc.contentHtml) onChangeRef.current({ ...docRef.current, contentHtml: normalized });
  }, [editor, doc.id]);

  const touch = (patch: Partial<HuskDocument>) =>
    onChange({ ...doc, ...patch, updatedAt: new Date().toISOString() });

  const handleMetadataChange = (id: string, value: string) =>
    touch({ metadataFields: doc.metadataFields.map((f) => (f.id === id ? { ...f, value } : f)) });

  const handleMetadataLabelChange = (id: string, label: string) =>
    touch({ metadataFields: doc.metadataFields.map((f) => (f.id === id ? { ...f, label } : f)) });

  const handleApplySignature = (sigUrl: string, name?: string, role?: string) =>
    touch({
      signOff: {
        ...doc.signOff,
        signatureUrl: sigUrl,
        name: name !== undefined ? name : doc.signOff.name,
        role: role !== undefined ? role : doc.signOff.role,
        date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      },
    });

  const metaPairs: [MetadataField, MetadataField | null][] = [];
  for (let i = 0; i < doc.metadataFields.length; i += 2) {
    metaPairs.push([doc.metadataFields[i], doc.metadataFields[i + 1] || null]);
  }

  const css = useMemo(
    () => buildDocumentCss(doc.branding, 'editor') + buildEditorChromeCss(),
    [doc.branding.primaryColor, doc.branding.accentColor, doc.branding.borderColor]
  );

  const { pages, signoffPush } = layout;
  const sheetHeight = pages * PAGE.height + (pages - 1) * PAGE.gap;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#121110]">
      <Toolbar
        editor={editor}
        brandPrimaryColor={doc.branding.primaryColor}
        onOpenSignatureModal={() => setIsSignatureModalOpen(true)}
        autocorrect={autocorrectOn}
        onToggleAutocorrect={toggleAutocorrect}
      />

      <TableQuickControls editor={editor} brandPrimaryColor={doc.branding.primaryColor} />

      {/* Page canvas: a stack of real A4 pages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto bg-[#121110] px-4 py-6"
        // A picture dropped outside the text (margin, header, grey area) is added at the end of the document.
        // The editor handles drops on the text itself and marks them as handled.
        onDragOver={(e) => {
          if (Array.from(e.dataTransfer.items).some((i) => i.kind === 'file')) e.preventDefault();
        }}
        onDrop={(e) => {
          const files = Array.from(e.dataTransfer.files).filter(isImageFile);
          if (e.defaultPrevented || !editor || !files.length) return;
          e.preventDefault();
          void insertImageFiles(editor, files, editor.state.doc.content.size);
        }}
      >
        <div
          className="relative"
          style={{ width: PAGE.width * zoomLevel, height: sheetHeight * zoomLevel, margin: '0 auto' }}
        >
          <style>{css}</style>
          <div
            ref={sheetRef}
            className="hd hd-edit absolute left-0 top-0"
            style={{
              width: PAGE.width,
              height: sheetHeight,
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'top left',
            }}
          >
            {/* Paper */}
            {Array.from({ length: pages }, (_, k) => (
              <div
                key={k}
                onMouseDown={() => editor?.commands.focus('end')}
                className="absolute bg-white"
                style={{
                  left: 0,
                  top: k * PITCH,
                  width: PAGE.width,
                  height: PAGE.height,
                  boxShadow: '0 15px 35px -5px rgba(0,0,0,.6), 0 10px 15px -6px rgba(0,0,0,.5)',
                }}
              />
            ))}

            {/* Flowing content, laid out inside the page margins */}
            <div
              ref={flowRef}
              style={{
                position: 'relative',
                zIndex: 1,
                paddingTop: PAGE.marginTop,
                paddingLeft: PAGE.marginX,
                paddingRight: PAGE.marginX,
              }}
            >
              <header className="hd-header">
                <div>
                  {doc.branding.logoUrl ? (
                    <img
                      src={doc.branding.logoUrl}
                      alt={doc.branding.companyName}
                      className="hd-logo"
                      style={{ width: doc.branding.logoWidth }}
                      onLoad={schedulePagination}
                    />
                  ) : (
                    <span className="hd-company">{doc.branding.companyName || 'Company'}</span>
                  )}
                </div>
                <div className="hd-right">
                  <div className="legal">{doc.branding.legalEntity}</div>
                  <div>{doc.branding.contactInfo}</div>
                </div>
              </header>

              <div className="hd-titlebox">
                <input
                  type="text"
                  className="hd-title"
                  value={doc.title}
                  onChange={(e) => touch({ title: e.target.value })}
                  placeholder="Document title"
                />
                <input
                  type="text"
                  className="hd-subtitle"
                  value={doc.subtitle}
                  onChange={(e) => touch({ subtitle: e.target.value })}
                  placeholder="Short description of what this document is"
                />
              </div>

              {metaPairs.length > 0 && (
                <table className="hd-meta">
                  <tbody>
                    {metaPairs.map(([f1, f2], idx) => (
                      <tr key={idx}>
                        <td className="lbl">
                          <input
                            type="text"
                            value={f1.label}
                            style={{ fontWeight: 600 }}
                            onChange={(e) => handleMetadataLabelChange(f1.id, e.target.value)}
                          />
                        </td>
                        <td className="val">
                          <input
                            type="text"
                            value={f1.value}
                            placeholder="—"
                            onChange={(e) => handleMetadataChange(f1.id, e.target.value)}
                          />
                        </td>
                        {f2 ? (
                          <>
                            <td className="lbl">
                              <input
                                type="text"
                                value={f2.label}
                                style={{ fontWeight: 600 }}
                                onChange={(e) => handleMetadataLabelChange(f2.id, e.target.value)}
                              />
                            </td>
                            <td className="val">
                              <input
                                type="text"
                                value={f2.value}
                                placeholder="—"
                                onChange={(e) => handleMetadataChange(f2.id, e.target.value)}
                              />
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="lbl" />
                            <td className="val" />
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className="hd-body">
                <EditorContent editor={editor} />
              </div>

              {doc.signOff.enabled && (
                <div
                  ref={signoffRef}
                  className="hd-signoff"
                  style={{ marginTop: SIGNOFF_MARGIN + signoffPush }}
                >
                  <div className="hd-signoff-title">{doc.signOff.title || 'Sign-off'}</div>
                  <table className="hd-signoff-table">
                    <tbody>
                      <tr>
                        <td>
                          <span className="hd-signoff-label">Name</span>
                          <input
                            type="text"
                            className="hd-signoff-val"
                            value={doc.signOff.name}
                            placeholder="Full name"
                            onChange={(e) => touch({ signOff: { ...doc.signOff, name: e.target.value } })}
                          />
                        </td>
                        <td>
                          <span className="hd-signoff-label">Role</span>
                          <input
                            type="text"
                            className="hd-signoff-val"
                            value={doc.signOff.role}
                            placeholder="Designation / Title"
                            onChange={(e) => touch({ signOff: { ...doc.signOff, role: e.target.value } })}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <span className="hd-signoff-label">Date</span>
                          <input
                            type="text"
                            className="hd-signoff-val"
                            value={doc.signOff.date}
                            placeholder="DD MMM YYYY"
                            onChange={(e) => touch({ signOff: { ...doc.signOff, date: e.target.value } })}
                          />
                        </td>
                        <td>
                          <div className="flex items-center justify-between">
                            <span className="hd-signoff-label">Signature</span>
                            <button
                              onClick={() => setIsSignatureModalOpen(true)}
                              className="text-[11px] text-[#FF4C00] hover:text-[#DB5100] font-semibold flex items-center gap-1"
                            >
                              <PenTool className="w-3 h-3" />
                              {doc.signOff.signatureUrl ? 'Change' : 'Sign Now'}
                            </button>
                          </div>
                          <div style={{ minHeight: 56, display: 'flex', alignItems: 'center' }}>
                            {doc.signOff.signatureUrl ? (
                              <img src={doc.signOff.signatureUrl} alt="Signature" className="hd-signoff-img" />
                            ) : (
                              <button
                                onClick={() => setIsSignatureModalOpen(true)}
                                className="w-full h-12 border-2 border-dashed border-slate-200 hover:border-[#FF4C00] rounded-lg flex items-center justify-center text-slate-400 hover:text-[#FF4C00] text-xs transition"
                              >
                                Click to attach your signature
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Page footers sit in the bottom margin of every page */}
            {doc.footerConfig.enabled &&
              Array.from({ length: pages }, (_, k) => (
                <div
                  key={k}
                  style={{
                    position: 'absolute',
                    zIndex: 2,
                    left: PAGE.marginX,
                    right: PAGE.marginX,
                    top: k * PITCH + PAGE.height - PAGE.marginBottom + 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 16,
                    paddingTop: 8,
                    borderTop: '1px solid #e2e8f0',
                    fontSize: 10,
                    color: '#94a3b8',
                  }}
                >
                  <input
                    type="text"
                    value={doc.footerConfig.leftText}
                    style={{ width: '60%' }}
                    onChange={(e) => touch({ footerConfig: { ...doc.footerConfig, leftText: e.target.value } })}
                  />
                  <span style={{ whiteSpace: 'nowrap' }}>
                    Page {k + 1} of {pages}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>

      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onApplySignature={handleApplySignature}
      />
    </div>
  );
};
