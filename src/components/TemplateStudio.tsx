import React, { useEffect, useRef, useState } from 'react';
import { DocumentTemplate, HuskDocument } from '../types';
import { TemplatePreview } from './TemplatePreview';
import { footerLeftTextFor, footerSuffix } from '../shared/printDocument';
import { ConfirmDialog } from './ConfirmDialog';
import {
  ArrowLeft,
  Building2,
  Copy,
  FileText,
  FolderOpen,
  LayoutTemplate,
  Palette,
  PenTool,
  Pencil,
  Plus,
  Trash2,
  Upload,
  ZoomIn,
  ZoomOut,
  ListChecks,
  PanelBottom,
} from 'lucide-react';

interface TemplateStudioProps {
  templates: DocumentTemplate[];
  documents: HuskDocument[];
  onCreateNewDocument: (template: DocumentTemplate) => void;
  onSaveTemplate: (template: DocumentTemplate) => void;
  onDeleteTemplate: (templateId: string) => void;
  onOpenSignatureModal: () => void;
  savedSignatureUrl: string;
  onOpenHuskFolder: () => void;
}

const PRESET_COLORS = [
  { name: 'HUSK Flame', primary: '#FF4C00', accent: '#fff7ed', border: '#fed7aa' },
  { name: 'Violet', primary: '#9353d3', accent: '#f6f3ff', border: '#ede9fe' },
  { name: 'Royal Indigo', primary: '#4f46e5', accent: '#eef2ff', border: '#e0e7ff' },
  { name: 'Ocean Cobalt', primary: '#0284c7', accent: '#f0f9ff', border: '#e0f2fe' },
  { name: 'Forest Emerald', primary: '#059669', accent: '#ecfdf5', border: '#d1fae5' },
  { name: 'Corporate Slate', primary: '#334155', accent: '#f8fafc', border: '#e2e8f0' },
  { name: 'Ruby Crimson', primary: '#e11d48', accent: '#fff1f2', border: '#ffe4e6' },
];

const inputCls =
  'w-full px-3 py-2 bg-[#22201d] border border-[#322f2a] rounded-lg text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#FF4C00]';
const ghostBtn =
  'px-3 py-1.5 rounded-lg bg-[#22201d] hover:bg-[#2c2925] text-stone-200 text-xs font-medium border border-[#322f2a] flex items-center gap-1.5 transition disabled:opacity-40 disabled:hover:bg-[#22201d]';
const primaryBtn =
  'px-4 py-2 rounded-xl text-xs font-semibold bg-[#FF4C00] hover:bg-[#DB5100] text-white flex items-center gap-2 shadow-lg shadow-[#FF4C00]/20 transition';

const stamp = () => new Date().toISOString();

function newBlankTemplate(signatureUrl: string): DocumentTemplate {
  return {
    id: 'template_' + Date.now(),
    name: 'Untitled template',
    description: 'Clean template ready for your branding',
    isDefault: false,
    branding: {
      companyName: '',
      legalEntity: '',
      contactInfo: '',
      logoUrl: '',
      logoWidth: 140,
      primaryColor: '#FF4C00',
      accentColor: '#fff7ed',
      borderColor: '#fed7aa',
      textColor: '#1e293b',
      fontFamily: 'Inter',
    },
    titlePlaceholder: 'Document title',
    subtitlePlaceholder: 'Short description of what this document is',
    metadataFields: [
      { id: '1', label: 'Document type', value: '' },
      { id: '2', label: 'Version', value: '' },
      { id: '3', label: 'Status', value: '' },
      { id: '4', label: 'Date', value: '' },
      { id: '5', label: 'Author', value: '' },
      { id: '6', label: 'Reviewer', value: '' },
    ],
    signOffConfig: { enabled: true, title: 'Sign-off', name: '', role: '', date: '', signatureUrl },
    footerConfig: { enabled: true, leftText: 'Document title | Confidential', rightText: 'Page 1' },
    contentHtml: '',
    createdAt: stamp(),
    updatedAt: stamp(),
  };
}

export const TemplateStudio: React.FC<TemplateStudioProps> = (props) => {
  const { templates, documents, onSaveTemplate, onDeleteTemplate } = props;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DocumentTemplate | null>(null);

  const editing = templates.find((t) => t.id === editingId) || null;

  const handleNew = () => {
    const t = newBlankTemplate(props.savedSignatureUrl || '');
    onSaveTemplate(t);
    setEditingId(t.id);
  };

  const handleDuplicate = (tpl: DocumentTemplate) => {
    const copy: DocumentTemplate = {
      ...tpl,
      id: 'template_' + Date.now(),
      name: `${tpl.name} (Copy)`,
      isDefault: false,
      createdAt: stamp(),
      updatedAt: stamp(),
    };
    onSaveTemplate(copy);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    onDeleteTemplate(pendingDelete.id);
    if (editingId === pendingDelete.id) setEditingId(null);
    setPendingDelete(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#121110]">
      {editing ? (
        <TemplateEditor
          template={editing}
          canDelete={templates.length > 1}
          onBack={() => setEditingId(null)}
          onChange={onSaveTemplate}
          onDuplicate={() => handleDuplicate(editing)}
          onDelete={() => setPendingDelete(editing)}
          onUse={() => props.onCreateNewDocument(editing)}
          onOpenSignatureModal={props.onOpenSignatureModal}
          savedSignatureUrl={props.savedSignatureUrl}
        />
      ) : (
        <TemplateGallery
          templates={templates}
          documents={documents}
          onNew={handleNew}
          onEdit={(t) => setEditingId(t.id)}
          onUse={props.onCreateNewDocument}
          onDuplicate={handleDuplicate}
          onDelete={(t) => setPendingDelete(t)}
          canDelete={templates.length > 1}
          onOpenHuskFolder={props.onOpenHuskFolder}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete "${pendingDelete.name}"?`}
          message="The template is removed for good. Documents already made from it are not changed."
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
};

// ───────────────────────── gallery ─────────────────────────

const TemplateGallery: React.FC<{
  templates: DocumentTemplate[];
  documents: HuskDocument[];
  canDelete: boolean;
  onNew: () => void;
  onEdit: (t: DocumentTemplate) => void;
  onUse: (t: DocumentTemplate) => void;
  onDuplicate: (t: DocumentTemplate) => void;
  onDelete: (t: DocumentTemplate) => void;
  onOpenHuskFolder: () => void;
}> = ({ templates, documents, canDelete, onNew, onEdit, onUse, onDuplicate, onDelete, onOpenHuskFolder }) => (
  <div className="flex-1 overflow-y-auto">
    <div className="px-8 py-6 border-b border-[#26231f] bg-[#161513] flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <LayoutTemplate className="w-5 h-5 text-[#FF4C00]" /> Templates
          <span className="text-xs font-mono font-normal text-stone-500">{templates.length}</span>
        </h2>
        <p className="text-xs text-stone-400 mt-0.5">
          Every company template you made. Open one to edit it, or start a new document from it.
        </p>
      </div>
      <div className="flex items-center gap-2.5">
        <button onClick={onOpenHuskFolder} className={ghostBtn} title="Open the HUSK folder in Finder">
          <FolderOpen className="w-3.5 h-3.5 text-[#FF4C00]" /> Open in Finder
        </button>
        <button onClick={onNew} className={primaryBtn}>
          <Plus className="w-4 h-4" /> New Template
        </button>
      </div>
    </div>

    <div
      className="p-8 grid gap-6"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
    >
      {templates.map((tpl) => {
        const used = documents.filter((d) => d.templateId === tpl.id).length;
        const b = tpl.branding;
        return (
          <div
            key={tpl.id}
            className="group bg-[#181715] border border-[#2b2722] hover:border-[#FF4C00]/60 rounded-2xl overflow-hidden flex flex-col transition shadow-lg"
          >
            <button
              onClick={() => onEdit(tpl)}
              title="Edit this template"
              className="relative bg-[#0f0e0d] pt-5 px-5 flex justify-center h-[300px] overflow-hidden cursor-pointer"
            >
              <TemplatePreview template={tpl} scale={0.3} />
              <div className="absolute inset-0 bg-gradient-to-t from-[#181715] via-transparent to-transparent pointer-events-none" />
              <span className="absolute top-3 right-3 px-2 py-1 rounded-md bg-black/70 text-[10px] font-semibold text-white opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
                <Pencil className="w-3 h-3" /> Edit
              </span>
            </button>

            <div className="p-4 flex-1 flex flex-col gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white truncate">{tpl.name || 'Untitled template'}</h3>
                  {tpl.isDefault && (
                    <span className="text-[9px] font-bold uppercase tracking-wide text-[#FF4C00] border border-[#FF4C00]/40 rounded px-1 py-px">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-400 mt-1 line-clamp-2 min-h-[2rem]">
                  {tpl.description || 'No description'}
                </p>
              </div>

              <div className="flex items-center justify-between text-[10px] text-stone-500 font-mono">
                <span className="flex items-center gap-1">
                  {[b.primaryColor, b.accentColor, b.borderColor].map((c, i) => (
                    <span
                      key={i}
                      className="w-3 h-3 rounded-full border border-white/20"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </span>
                <span>
                  {used} {used === 1 ? 'document' : 'documents'} · {new Date(tpl.updatedAt).toLocaleDateString()}
                </span>
              </div>

              <div className="mt-auto flex items-center gap-1.5 pt-1">
                <button onClick={() => onUse(tpl)} className={`${primaryBtn} flex-1 justify-center py-1.5`}>
                  <FileText className="w-3.5 h-3.5" /> Use
                </button>
                <button onClick={() => onEdit(tpl)} className={ghostBtn} title="Edit template">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onDuplicate(tpl)} className={ghostBtn} title="Duplicate template">
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDelete(tpl)}
                  disabled={!canDelete}
                  className={`${ghostBtn} hover:!text-rose-400`}
                  title={canDelete ? 'Delete template' : 'Keep at least one template'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}

      <button
        onClick={onNew}
        className="min-h-[420px] rounded-2xl border-2 border-dashed border-[#322f2a] hover:border-[#FF4C00] text-stone-500 hover:text-[#FF4C00] flex flex-col items-center justify-center gap-2 transition"
      >
        <Plus className="w-8 h-8" />
        <span className="text-xs font-semibold">New blank template</span>
      </button>
    </div>
  </div>
);

// ───────────────────────── editor ─────────────────────────

const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode; aside?: React.ReactNode }> = ({
  icon,
  title,
  children,
  aside,
}) => (
  <section className="bg-[#1a1917] border border-[#2b2722] rounded-xl p-4 space-y-3.5">
    <div className="flex items-center justify-between">
      <h4 className="text-[11px] font-bold text-stone-200 uppercase tracking-wider flex items-center gap-2">
        <span className="text-[#FF4C00]">{icon}</span> {title}
      </h4>
      {aside}
    </div>
    {children}
  </section>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="block text-[11px] font-medium text-stone-400 mb-1">{label}</span>
    {children}
  </label>
);

const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void; label: string }> = ({ on, onChange, label }) => (
  <button
    onClick={() => onChange(!on)}
    className="flex items-center gap-2 text-[11px] text-stone-400 hover:text-stone-200"
    role="switch"
    aria-checked={on}
  >
    <span className={`w-7 h-4 rounded-full p-0.5 transition ${on ? 'bg-[#FF4C00]' : 'bg-[#322f2a]'}`}>
      <span className={`block w-3 h-3 rounded-full bg-white transition ${on ? 'translate-x-3' : ''}`} />
    </span>
    {label}
  </button>
);

const ColorField: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({
  label,
  value,
  onChange,
}) => (
  <Field label={label}>
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={value.startsWith('#') && value.length === 7 ? value : '#ffffff'}
        onChange={(e) => onChange(e.target.value)}
        className="w-8 h-8 shrink-0 rounded-lg cursor-pointer bg-[#22201d] border border-[#322f2a] p-0.5"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} font-mono !px-2`}
      />
    </div>
  </Field>
);

const TemplateEditor: React.FC<{
  template: DocumentTemplate;
  canDelete: boolean;
  onBack: () => void;
  onChange: (t: DocumentTemplate) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onUse: () => void;
  onOpenSignatureModal: () => void;
  savedSignatureUrl: string;
}> = ({ template, canDelete, onBack, onChange, onDuplicate, onDelete, onUse, onOpenSignatureModal, savedSignatureUrl }) => {
  const [zoom, setZoom] = useState(0.9);
  const previewBoxRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  useEffect(() => {
    const el = previewBoxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setBoxWidth(el.clientWidth));
    observer.observe(el);
    setBoxWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);
  // never wider than the space we have
  const shownScale = boxWidth ? Math.max(0.3, Math.min(zoom, (boxWidth - 24) / 794)) : zoom;
  const brand = template.branding;

  const update = (patch: Partial<DocumentTemplate>) => onChange({ ...template, ...patch, updatedAt: stamp() });
  const updateBrand = (patch: Partial<DocumentTemplate['branding']>) => update({ branding: { ...brand, ...patch } });
  const updateSignOff = (patch: Partial<DocumentTemplate['signOffConfig']>) =>
    update({ signOffConfig: { ...template.signOffConfig, ...patch } });
  const updateFooter = (patch: Partial<DocumentTemplate['footerConfig']>) =>
    update({ footerConfig: { ...template.footerConfig, ...patch } });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => updateBrand({ logoUrl: event.target?.result as string });
    reader.readAsDataURL(file);
  };

  return (
    <>
      <div className="bg-[#161513] border-b border-[#26231f] px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 shrink-0">
        <button onClick={onBack} className={ghostBtn}>
          <ArrowLeft className="w-3.5 h-3.5" /> All templates
        </button>
        <div className="flex-1 min-w-0 max-[900px]:order-last max-[900px]:basis-full">
          <input
            type="text"
            value={template.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Template name"
            className="w-full text-base font-bold text-white bg-transparent border-b border-transparent hover:border-stone-700 focus:border-[#FF4C00] focus:outline-none"
          />
          <input
            type="text"
            value={template.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="Short description"
            className="w-full text-xs text-stone-400 bg-transparent border-b border-transparent hover:border-stone-700 focus:border-[#FF4C00] focus:outline-none mt-0.5"
          />
        </div>
        <span className="text-[10px] text-stone-500 font-mono hidden lg:block">
          Saved automatically · {new Date(template.updatedAt).toLocaleTimeString()}
        </span>
        <button onClick={onDuplicate} className={ghostBtn} title="Duplicate template">
          <Copy className="w-3.5 h-3.5" /> <span className="hidden min-[1100px]:inline">Duplicate</span>
        </button>
        <button
          onClick={onDelete}
          disabled={!canDelete}
          className={`${ghostBtn} hover:!text-rose-400`}
          title={canDelete ? 'Delete template' : 'Keep at least one template'}
        >
          <Trash2 className="w-3.5 h-3.5" /> <span className="hidden min-[1100px]:inline">Delete</span>
        </button>
        <button onClick={onUse} className={primaryBtn}>
          <FileText className="w-4 h-4 shrink-0" /> <span className="whitespace-nowrap">New document</span>
        </button>
      </div>

      <div className="flex-1 flex max-[900px]:flex-col overflow-hidden max-[900px]:overflow-y-auto">
        <div className="w-[430px] max-[900px]:w-full shrink-0 border-r max-[900px]:border-r-0 max-[900px]:border-b border-[#26231f] overflow-y-auto max-[900px]:overflow-visible p-4 space-y-4 bg-[#141312]">
          <Section icon={<Palette className="w-3.5 h-3.5" />} title="Colors">
            <div className="grid grid-cols-2 gap-1.5">
              {PRESET_COLORS.map((preset) => {
                const active = brand.primaryColor.toLowerCase() === preset.primary.toLowerCase();
                return (
                  <button
                    key={preset.name}
                    onClick={() =>
                      updateBrand({ primaryColor: preset.primary, accentColor: preset.accent, borderColor: preset.border })
                    }
                    className={`p-2 rounded-lg border text-left flex items-center gap-2 transition ${
                      active
                        ? 'border-[#FF4C00] bg-[#FF4C00]/10 text-white'
                        : 'border-[#2e2a24] bg-[#1e1c19] text-stone-400 hover:border-stone-600'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                      style={{ backgroundColor: preset.primary }}
                    />
                    <span className="text-[11px] font-medium truncate">{preset.name}</span>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-1 gap-2.5">
              <ColorField label="Primary (titles, lines)" value={brand.primaryColor} onChange={(v) => updateBrand({ primaryColor: v })} />
              <ColorField label="Table tint" value={brand.accentColor} onChange={(v) => updateBrand({ accentColor: v })} />
              <ColorField label="Border line" value={brand.borderColor} onChange={(v) => updateBrand({ borderColor: v })} />
            </div>
          </Section>

          <Section icon={<Building2 className="w-3.5 h-3.5" />} title="Header & logo">
            <Field label="Company name">
              <input
                type="text"
                value={brand.companyName}
                onChange={(e) => updateBrand({ companyName: e.target.value })}
                placeholder="e.g. Acme"
                className={inputCls}
              />
            </Field>
            <Field label="Legal line">
              <input
                type="text"
                value={brand.legalEntity}
                onChange={(e) => updateBrand({ legalEntity: e.target.value })}
                placeholder="e.g. Acme Ltd | Acme"
                className={inputCls}
              />
            </Field>
            <Field label="Contact line">
              <input
                type="text"
                value={brand.contactInfo}
                onChange={(e) => updateBrand({ contactInfo: e.target.value })}
                placeholder="e.g. acme.com | hello@acme.com"
                className={inputCls}
              />
            </Field>
            <div className="bg-[#1e1c19] p-3 rounded-xl border border-[#2e2a24] flex items-center gap-3">
              <div className="w-28 h-14 shrink-0 bg-white rounded-lg p-1.5 flex items-center justify-center border border-stone-300 overflow-hidden">
                {brand.logoUrl ? (
                  <img src={brand.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-[10px] text-stone-400 font-mono">No logo</span>
                )}
              </div>
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <label className="px-2.5 py-1 bg-[#2a2723] hover:bg-[#34302b] text-stone-200 border border-stone-600 rounded text-xs font-medium cursor-pointer transition inline-flex items-center gap-1">
                    <Upload className="w-3 h-3 text-[#FF4C00]" /> Upload
                    <input type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={handleLogoUpload} className="hidden" />
                  </label>
                  {brand.logoUrl && (
                    <button onClick={() => updateBrand({ logoUrl: '' })} className="text-xs text-rose-400 hover:text-rose-300">
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-stone-400">Width</span>
                  <input
                    type="range"
                    min="60"
                    max="220"
                    value={brand.logoWidth}
                    onChange={(e) => updateBrand({ logoWidth: Number(e.target.value) })}
                    className="flex-1 accent-[#FF4C00]"
                  />
                  <span className="text-[10px] text-stone-400 font-mono w-9 text-right">{brand.logoWidth}px</span>
                </div>
              </div>
            </div>
          </Section>

          <Section icon={<FileText className="w-3.5 h-3.5" />} title="Title">
            <Field label="Title placeholder">
              <input
                type="text"
                value={template.titlePlaceholder}
                onChange={(e) => update({ titlePlaceholder: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Subtitle placeholder">
              <input
                type="text"
                value={template.subtitlePlaceholder}
                onChange={(e) => update({ subtitlePlaceholder: e.target.value })}
                className={inputCls}
              />
            </Field>
          </Section>

          <Section
            icon={<ListChecks className="w-3.5 h-3.5" />}
            title="Info table fields"
            aside={
              <button
                onClick={() =>
                  update({
                    metadataFields: [...template.metadataFields, { id: 'f_' + Date.now(), label: 'New field', value: '' }],
                  })
                }
                className="text-xs text-[#FF4C00] hover:text-[#DB5100] flex items-center gap-1 font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            }
          >
            <div className="grid grid-cols-2 gap-1.5">
              {template.metadataFields.map((field) => (
                <div key={field.id} className="flex items-center gap-1 p-1 rounded-lg bg-[#1e1c19] border border-[#2e2a24]">
                  <input
                    type="text"
                    value={field.label}
                    onChange={(e) =>
                      update({
                        metadataFields: template.metadataFields.map((f) =>
                          f.id === field.id ? { ...f, label: e.target.value } : f
                        ),
                      })
                    }
                    className="w-full min-w-0 bg-[#121110] px-2 py-1 rounded text-xs text-white border border-[#322f2a] focus:border-[#FF4C00] focus:outline-none"
                  />
                  <button
                    onClick={() => update({ metadataFields: template.metadataFields.filter((f) => f.id !== field.id) })}
                    className="text-stone-500 hover:text-rose-400 p-1"
                    title="Remove field"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </Section>

          <Section
            icon={<PenTool className="w-3.5 h-3.5" />}
            title="Sign-off block"
            aside={
              <Toggle
                on={template.signOffConfig.enabled}
                onChange={(v) => updateSignOff({ enabled: v })}
                label={template.signOffConfig.enabled ? 'On' : 'Off'}
              />
            }
          >
            {template.signOffConfig.enabled && (
              <>
                <Field label="Heading">
                  <input
                    type="text"
                    value={template.signOffConfig.title}
                    onChange={(e) => updateSignOff({ title: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2.5">
                  <Field label="Signer name">
                    <input
                      type="text"
                      value={template.signOffConfig.name}
                      onChange={(e) => updateSignOff({ name: e.target.value })}
                      placeholder="Full name"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Signer role">
                    <input
                      type="text"
                      value={template.signOffConfig.role}
                      onChange={(e) => updateSignOff({ role: e.target.value })}
                      placeholder="Designation"
                      className={inputCls}
                    />
                  </Field>
                </div>
                <button onClick={onOpenSignatureModal} className="text-xs text-[#FF4C00] hover:text-[#DB5100] font-semibold">
                  {savedSignatureUrl ? 'Change saved signature' : 'Add a saved signature'}
                </button>
              </>
            )}
          </Section>

          <Section
            icon={<PanelBottom className="w-3.5 h-3.5" />}
            title="Page footer"
            aside={
              <Toggle
                on={template.footerConfig.enabled}
                onChange={(v) => updateFooter({ enabled: v })}
                label={template.footerConfig.enabled ? 'On' : 'Off'}
              />
            }
          >
            {template.footerConfig.enabled && (
              <Field label="Footer text after the document title (page numbers are added on the right)">
                <input
                  type="text"
                  value={footerSuffix(template.footerConfig.leftText)}
                  placeholder="Confidential"
                  onChange={(e) => updateFooter({ leftText: footerLeftTextFor(e.target.value) })}
                  className={inputCls}
                />
              </Field>
            )}
          </Section>
        </div>

        <div ref={previewBoxRef} className="flex-1 overflow-auto max-[900px]:overflow-visible max-[900px]:shrink-0 bg-[#0e0d0c] p-6 max-[900px]:px-3 flex flex-col items-center">
          <div className="w-full flex items-center justify-between pb-4 text-xs text-stone-400" style={{ maxWidth: 794 * shownScale }}>
            <span className="font-semibold text-stone-300">Live preview (A4)</span>
            <div className="flex items-center bg-[#1a1917] rounded-lg p-1 border border-[#2e2a24]">
              <button onClick={() => setZoom(Math.max(0.5, +(zoom - 0.1).toFixed(2)))} className="p-1 hover:text-white">
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 font-mono text-[11px] text-[#FF4C00]">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(Math.min(1.2, +(zoom + 0.1).toFixed(2)))} className="p-1 hover:text-white">
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <TemplatePreview template={template} scale={shownScale} debounceMs={150} />
        </div>
      </div>
    </>
  );
};
