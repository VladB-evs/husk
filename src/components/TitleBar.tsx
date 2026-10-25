import React from 'react';
import { ViewMode, HuskDocument } from '../types';
import type { SaveStatus } from '../utils/storage';
import { CHECK_UPDATE_EVENT } from './UpdateBanner';
import {
  FileText,
  FolderOpen,
  Download,
  Palette,
  ZoomIn,
  ZoomOut,
  LayoutTemplate,
  FolderCheck,
  Check,
  RefreshCw,
} from 'lucide-react';

interface TitleBarProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  currentDoc?: HuskDocument;
  onExportPDF: () => void;
  onOpenBranding: () => void;
  onOpenHuskFolder: () => void;
  zoomLevel: number;
  onZoomChange: (level: number) => void;
  saveStatus?: SaveStatus;
  onZoomReset?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  currentView,
  onViewChange,
  currentDoc,
  onExportPDF,
  onOpenBranding,
  onOpenHuskFolder,
  zoomLevel,
  onZoomChange,
  saveStatus = 'saved',
  onZoomReset,
}) => {
  return (
    <header className="no-print bg-[#121110] border-b border-[#26231f] text-stone-200 h-12 flex items-center justify-between px-3 select-none drag-region relative z-40">
      {/* Left traffic lights space + App Brand */}
      <div className="flex items-center gap-3 pl-20 no-drag">
        <div className="flex items-center gap-2">
          <img src="./Asset-1.png" alt="HUSK" className="w-5 h-5 object-contain" draggable={false} />
          <span className="font-bold text-xs tracking-wider text-white uppercase">HUSK</span>
        </div>

        <div className="h-4 w-[1px] bg-[#2d2a25] mx-1" />

        {/* View Switcher Tabs */}
        <nav className="flex items-center gap-1">
          <button
            onClick={() => onViewChange('editor')}
            title="Document Editor"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
              currentView === 'editor'
                ? 'bg-[#22201d] text-[#FF4C00] shadow-sm font-semibold border border-[#38332c]'
                : 'text-stone-400 hover:text-stone-200 hover:bg-[#1a1816]'
            }`}
          >
            <FileText className={`w-3.5 h-3.5 ${currentView === 'editor' ? 'text-[#FF4C00]' : 'text-stone-400'}`} />
            <span className="hidden min-[1000px]:inline whitespace-nowrap">Document Editor</span>
          </button>

          <button
            onClick={() => onViewChange('templates')}
            title="Template Studio"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
              currentView === 'templates'
                ? 'bg-[#22201d] text-[#FF4C00] shadow-sm font-semibold border border-[#38332c]'
                : 'text-stone-400 hover:text-stone-200 hover:bg-[#1a1816]'
            }`}
          >
            <LayoutTemplate className={`w-3.5 h-3.5 ${currentView === 'templates' ? 'text-[#FF4C00]' : 'text-stone-400'}`} />
            <span className="hidden min-[1000px]:inline whitespace-nowrap">Template Studio</span>
          </button>

          <button
            onClick={() => onViewChange('library')}
            title="All Documents"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
              currentView === 'library'
                ? 'bg-[#22201d] text-[#FF4C00] shadow-sm font-semibold border border-[#38332c]'
                : 'text-stone-400 hover:text-stone-200 hover:bg-[#1a1816]'
            }`}
          >
            <FolderOpen className={`w-3.5 h-3.5 ${currentView === 'library' ? 'text-[#FF4C00]' : 'text-stone-400'}`} />
            <span className="hidden min-[1000px]:inline whitespace-nowrap">All Documents</span>
          </button>
        </nav>
      </div>

      {/* Center: Current Document Name */}
      {currentView === 'editor' && currentDoc && (
        <div className="hidden min-[1100px]:flex items-center gap-2 text-xs text-stone-400 font-medium min-w-0">
          <div
            className="w-2 h-2 rounded-full shadow-sm shrink-0"
            style={{ backgroundColor: currentDoc.branding.primaryColor || '#FF4C00' }}
          />
          <span className="text-stone-200 font-semibold max-w-xs truncate">
            {currentDoc.title || 'Untitled Document'}
          </span>
        </div>
      )}

      {/* Right: Actions */}
      <div className="flex items-center gap-2 no-drag">
        {/* Save status: changes only when a write starts or ends, never per keystroke */}
        {currentView === 'editor' && currentDoc && (
          <span
            title={saveStatus === 'saved' ? 'All changes are saved in ~/Documents/HUSK' : 'Saving your changes'}
            className={`hidden min-[820px]:flex items-center gap-1 w-[62px] text-[11px] ${
              saveStatus === 'saved' ? 'text-stone-500' : 'text-[#FF4C00]/80'
            }`}
          >
            {saveStatus === 'saved' ? <Check className="w-3 h-3" /> : <span className="w-1.5 h-1.5 rounded-full bg-[#FF4C00]/80" />}
            {saveStatus === 'saved' ? 'Saved' : 'Saving'}
          </span>
        )}

        {/* Manual update check: UpdateBanner listens for this event and shows the answer under the title bar */}
        <button
          onClick={() => window.dispatchEvent(new Event(CHECK_UPDATE_EVENT))}
          title="Check for updates"
          className="px-2.5 py-1.5 rounded-lg bg-[#1a1917] hover:bg-[#25221e] text-stone-300 border border-[#2e2a24] text-xs font-medium flex items-center gap-1.5 transition"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#FF4C00]" />
          <span className="hidden min-[1100px]:inline whitespace-nowrap">Updates</span>
        </button>

        {/* Finder button */}
        <button
          onClick={onOpenHuskFolder}
          title="Open ~/Documents/HUSK in macOS Finder"
          className="px-2.5 py-1.5 rounded-lg bg-[#1a1917] hover:bg-[#25221e] text-stone-300 border border-[#2e2a24] text-xs font-medium flex items-center gap-1.5 transition"
        >
          <FolderCheck className="w-3.5 h-3.5 text-[#FF4C00]" />
          <span className="hidden min-[1100px]:inline">Finder</span>
        </button>

        {currentView === 'editor' && currentDoc && (
          <>
            {/* Zoom Controls */}
            <div className="flex items-center bg-[#1a1917] rounded-lg p-0.5 border border-[#2e2a24]">
              <button
                onClick={() => onZoomChange(Math.max(0.4, +(zoomLevel - 0.1).toFixed(2)))}
                title="Zoom Out"
                className="p-1 rounded text-stone-400 hover:text-white hover:bg-[#282520] transition"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onZoomReset}
                title="Fit the page to the window"
                className="px-1.5 text-[10px] font-mono text-stone-300 hover:text-white"
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button
                onClick={() => onZoomChange(Math.min(1.4, +(zoomLevel + 0.1).toFixed(2)))}
                title="Zoom In"
                className="p-1 rounded text-stone-400 hover:text-white hover:bg-[#282520] transition"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Company Color & Brand button */}
            <button
              onClick={onOpenBranding}
              title="Change Company Color Schema, Logo, and Brand details"
              className="px-2.5 py-1.5 rounded-lg bg-[#1a1917] hover:bg-[#25221e] text-stone-200 border border-[#2e2a24] hover:border-[#FF4C00]/40 text-xs font-medium flex items-center gap-1.5 transition"
            >
              <div
                className="w-3 h-3 rounded-full border border-white/30"
                style={{ backgroundColor: currentDoc.branding.primaryColor || '#FF4C00' }}
              />
              <span className="hidden min-[1100px]:inline whitespace-nowrap">Colors & Logo</span>
            </button>

            {/* Export PDF */}
            <button
              onClick={onExportPDF}
              title="Save document as clean A4 PDF"
              className="px-3.5 py-1.5 rounded-lg bg-[#FF4C00] hover:bg-[#DB5100] text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-[#FF4C00]/25 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden min-[760px]:inline whitespace-nowrap">Export PDF</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
};
