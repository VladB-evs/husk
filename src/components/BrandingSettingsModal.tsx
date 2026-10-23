import React, { useState } from 'react';
import { X, Check, Upload, Palette, Building2, LayoutTemplate } from 'lucide-react';
import { BrandingConfig } from '../types';

interface BrandingSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  branding: BrandingConfig;
  onSaveBranding: (branding: BrandingConfig) => void;
  onSaveAsTemplate?: (name: string, description: string) => void;
}

const PRESET_COLOR_SCHEMES = [
  { name: 'HUSK Flame (Signature)', primary: '#FF4C00', accent: '#fff7ed', border: '#fed7aa' },
  { name: 'Violet', primary: '#9353d3', accent: '#f6f3ff', border: '#ede9fe' },
  { name: 'Royal Indigo', primary: '#4f46e5', accent: '#eef2ff', border: '#e0e7ff' },
  { name: 'Ocean Cobalt', primary: '#0284c7', accent: '#f0f9ff', border: '#e0f2fe' },
  { name: 'Forest Emerald', primary: '#059669', accent: '#ecfdf5', border: '#d1fae5' },
  { name: 'Corporate Slate', primary: '#334155', accent: '#f8fafc', border: '#e2e8f0' },
  { name: 'Ruby Crimson', primary: '#e11d48', accent: '#fff1f2', border: '#ffe4e6' },
];

export const BrandingSettingsModal: React.FC<BrandingSettingsModalProps> = ({
  isOpen,
  onClose,
  branding,
  onSaveBranding,
  onSaveAsTemplate,
}) => {
  const [config, setConfig] = useState<BrandingConfig>({ ...branding });
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');
  const [showSaveTemplateForm, setShowSaveTemplateForm] = useState(false);

  if (!isOpen) return null;

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setConfig({ ...config, logoUrl: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  const handleApplyPreset = (preset: typeof PRESET_COLOR_SCHEMES[0]) => {
    setConfig({
      ...config,
      primaryColor: preset.primary,
      accentColor: preset.accent,
      borderColor: preset.border,
    });
  };

  const handleSave = () => {
    onSaveBranding(config);
    if (showSaveTemplateForm && newTemplateName.trim() && onSaveAsTemplate) {
      onSaveAsTemplate(newTemplateName.trim(), newTemplateDesc.trim());
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl max-h-[90vh] rounded-2xl bg-[#181715] border border-[#322f2a] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#26231f]">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shadow"
              style={{ backgroundColor: config.primaryColor || '#FF4C00' }}
            >
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Company Branding & Color Schema</h3>
              <p className="text-xs text-stone-400">Customise header, colors, logo, and company credentials</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-[#22201d] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Company Details */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-[#FF4C00] uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Company Header Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-400 mb-1">Company / Brand Name</label>
                <input
                  type="text"
                  value={config.companyName}
                  onChange={(e) => setConfig({ ...config, companyName: e.target.value })}
                  placeholder="e.g. Acme"
                  className="w-full px-3 py-2 bg-[#22201d] border border-[#322f2a] rounded-lg text-sm text-white focus:outline-none focus:border-[#FF4C00]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-400 mb-1">Legal Entity Subtitle</label>
                <input
                  type="text"
                  value={config.legalEntity}
                  onChange={(e) => setConfig({ ...config, legalEntity: e.target.value })}
                  placeholder="e.g. Acme Ltd | Acme"
                  className="w-full px-3 py-2 bg-[#22201d] border border-[#322f2a] rounded-lg text-sm text-white focus:outline-none focus:border-[#FF4C00]"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-stone-400 mb-1">Contact & Web Address Line</label>
                <input
                  type="text"
                  value={config.contactInfo}
                  onChange={(e) => setConfig({ ...config, contactInfo: e.target.value })}
                  placeholder="e.g. acme.com | hello@acme.com"
                  className="w-full px-3 py-2 bg-[#22201d] border border-[#322f2a] rounded-lg text-sm text-white focus:outline-none focus:border-[#FF4C00]"
                />
              </div>
            </div>
          </div>

          {/* Logo Section */}
          <div className="space-y-3 pt-2 border-t border-[#26231f]">
            <h4 className="text-xs font-semibold text-[#FF4C00] uppercase tracking-wider flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" /> Company Logo
            </h4>
            <div className="flex items-center gap-4 bg-[#1e1c19] p-4 rounded-xl border border-[#2e2a24]">
              <div className="w-40 h-16 bg-white rounded-lg flex items-center justify-center p-2 border border-stone-300 overflow-hidden shadow-inner">
                {config.logoUrl ? (
                  <img
                    src={config.logoUrl}
                    alt="Company Logo"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-stone-400">No logo</span>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <label className="px-3 py-1.5 bg-[#2a2723] hover:bg-[#34302b] text-stone-200 border border-stone-600 rounded-lg text-xs font-medium cursor-pointer transition inline-flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-[#FF4C00]" /> Replace Logo
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                  {config.logoUrl && (
                    <button
                      onClick={() => setConfig({ ...config, logoUrl: '' })}
                      className="text-xs text-rose-400 hover:text-rose-300"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-400">Logo Width:</span>
                  <input
                    type="range"
                    min="60"
                    max="220"
                    value={config.logoWidth}
                    onChange={(e) => setConfig({ ...config, logoWidth: Number(e.target.value) })}
                    className="w-32 accent-[#FF4C00]"
                  />
                  <span className="text-xs text-stone-400 font-mono">{config.logoWidth}px</span>
                </div>
              </div>
            </div>
          </div>

          {/* Color Schema */}
          <div className="space-y-4 pt-2 border-t border-[#26231f]">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-[#FF4C00] uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5" /> Company Color Schema
              </h4>
              <span className="text-xs text-stone-400">Applies to headings, subtitles, tables & lines</span>
            </div>

            {/* Presets */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {PRESET_COLOR_SCHEMES.map((scheme) => (
                <button
                  key={scheme.name}
                  onClick={() => handleApplyPreset(scheme)}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-left transition ${
                    config.primaryColor.toLowerCase() === scheme.primary.toLowerCase()
                      ? 'border-[#FF4C00] bg-[#FF4C00]/10 text-white'
                      : 'border-[#2e2a24] bg-[#1e1c19] text-stone-400 hover:border-stone-600 hover:text-stone-200'
                  }`}
                >
                  <div
                    className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                    style={{ backgroundColor: scheme.primary }}
                  />
                  <span className="text-xs font-medium truncate">{scheme.name}</span>
                </button>
              ))}
            </div>

            {/* Custom hex colors */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-xs font-medium text-stone-400 mb-1">Primary Brand Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config.primaryColor}
                    onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                    className="w-9 h-9 rounded-lg cursor-pointer bg-[#22201d] border border-[#322f2a] p-0.5"
                  />
                  <input
                    type="text"
                    value={config.primaryColor}
                    onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-[#22201d] border border-[#322f2a] rounded-lg text-xs font-mono text-white focus:outline-none focus:border-[#FF4C00]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-400 mb-1">Table Tint (Accent)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config.accentColor.startsWith('#') ? config.accentColor : '#fff7ed'}
                    onChange={(e) => setConfig({ ...config, accentColor: e.target.value })}
                    className="w-9 h-9 rounded-lg cursor-pointer bg-[#22201d] border border-[#322f2a] p-0.5"
                  />
                  <input
                    type="text"
                    value={config.accentColor}
                    onChange={(e) => setConfig({ ...config, accentColor: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-[#22201d] border border-[#322f2a] rounded-lg text-xs font-mono text-white focus:outline-none focus:border-[#FF4C00]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-400 mb-1">Border Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config.borderColor.startsWith('#') ? config.borderColor : '#fed7aa'}
                    onChange={(e) => setConfig({ ...config, borderColor: e.target.value })}
                    className="w-9 h-9 rounded-lg cursor-pointer bg-[#22201d] border border-[#322f2a] p-0.5"
                  />
                  <input
                    type="text"
                    value={config.borderColor}
                    onChange={(e) => setConfig({ ...config, borderColor: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-[#22201d] border border-[#322f2a] rounded-lg text-xs font-mono text-white focus:outline-none focus:border-[#FF4C00]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Save as Template Option */}
          {onSaveAsTemplate && (
            <div className="pt-2 border-t border-[#26231f]">
              {!showSaveTemplateForm ? (
                <button
                  onClick={() => setShowSaveTemplateForm(true)}
                  className="text-xs text-[#FF4C00] hover:text-[#DB5100] flex items-center gap-1.5 font-semibold"
                >
                  <LayoutTemplate className="w-3.5 h-3.5" /> Save these settings as a new reusable Company Template
                </button>
              ) : (
                <div className="bg-[#1e1c19] border border-[#38332c] rounded-xl p-3.5 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-[#FF4C00]">Save as Reusable Template</span>
                    <button
                      onClick={() => setShowSaveTemplateForm(false)}
                      className="text-stone-400 hover:text-white text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs text-stone-400 mb-1">Template Name</label>
                    <input
                      type="text"
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      placeholder="e.g. Official Policy Template"
                      className="w-full px-3 py-1.5 bg-[#22201d] border border-[#322f2a] rounded-lg text-xs text-white focus:outline-none focus:border-[#FF4C00]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-400 mb-1">Description (optional)</label>
                    <input
                      type="text"
                      value={newTemplateDesc}
                      onChange={(e) => setNewTemplateDesc(e.target.value)}
                      placeholder="Short description of who and what this template is for"
                      className="w-full px-3 py-1.5 bg-[#22201d] border border-[#322f2a] rounded-lg text-xs text-white focus:outline-none focus:border-[#FF4C00]"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-[#141311] border-t border-[#26231f]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-stone-400 hover:bg-[#22201d] transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#FF4C00] hover:bg-[#DB5100] text-white flex items-center gap-2 shadow-lg shadow-[#FF4C00]/20 transition"
          >
            <Check className="w-4 h-4" /> Save Branding
          </button>
        </div>
      </div>
    </div>
  );
};
