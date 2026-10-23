import React from 'react';
import { Editor } from '@tiptap/react';
import {
  Trash2,
  Table as TableIcon,
  Split,
  Heading,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';

interface TableQuickControlsProps {
  editor: Editor | null;
  brandPrimaryColor?: string;
}

export const TableQuickControls: React.FC<TableQuickControlsProps> = ({
  editor,
  brandPrimaryColor = '#FF4C00',
}) => {
  if (!editor || !editor.isActive('table')) return null;

  const rowDensity: 'compact' | 'normal' | 'spacious' = editor.getAttributes('table').density || 'normal';

  const handleSetRowDensity = (density: 'compact' | 'normal' | 'spacious') => {
    editor.chain().focus().updateAttributes('table', { density }).run();
  };

  return (
    <div className="bg-[#1a1917] border-b border-[#2e2a24] px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-200 select-none shadow-md">
      <div className="flex flex-wrap items-center gap-2">
        {/* Table Badge */}
        <span className="flex items-center gap-1.5 font-bold text-[#FF4C00] uppercase tracking-wider text-[11px] pr-2.5 border-r border-[#2e2a24]">
          <TableIcon className="w-3.5 h-3.5" /> Table Controls
        </span>

        {/* Row Operations */}
        <div className="flex items-center gap-1 pr-2 border-r border-[#2e2a24]">
          <span className="text-[10px] text-stone-400 font-semibold uppercase mr-0.5 hidden min-[1100px]:inline">Rows:</span>
          <button
            onClick={() => editor.chain().focus().addRowBefore().run()}
            title="Insert a new row above"
            className="px-2 py-1 rounded bg-[#22201d] hover:bg-[#2c2925] hover:text-[#FF4C00] border border-[#322f2a] flex items-center gap-1 text-[11px] font-medium transition"
          >
            <ArrowUp className="w-3 h-3 text-emerald-400" />
            <span>+ Above</span>
          </button>
          <button
            onClick={() => editor.chain().focus().addRowAfter().run()}
            title="Insert a new row below"
            className="px-2 py-1 rounded bg-[#22201d] hover:bg-[#2c2925] hover:text-[#FF4C00] border border-[#322f2a] flex items-center gap-1 text-[11px] font-medium transition"
          >
            <ArrowDown className="w-3 h-3 text-emerald-400" />
            <span>+ Below</span>
          </button>
          <button
            onClick={() => editor.chain().focus().deleteRow().run()}
            title="Delete current row"
            className="px-2 py-1 rounded bg-[#22201d] hover:bg-rose-500/20 text-rose-400 border border-[#322f2a] flex items-center gap-1 text-[11px] font-medium transition"
          >
            <Trash2 className="w-3 h-3" />
            <span className="hidden min-[1100px]:inline whitespace-nowrap">Delete Row</span>
          </button>
        </div>

        {/* Column Operations */}
        <div className="flex items-center gap-1 pr-2 border-r border-[#2e2a24]">
          <span className="text-[10px] text-stone-400 font-semibold uppercase mr-0.5 hidden min-[1100px]:inline">Columns:</span>
          <button
            onClick={() => editor.chain().focus().addColumnBefore().run()}
            title="Insert a new column to the left"
            className="px-2 py-1 rounded bg-[#22201d] hover:bg-[#2c2925] hover:text-[#FF4C00] border border-[#322f2a] flex items-center gap-1 text-[11px] font-medium transition"
          >
            <ArrowLeft className="w-3 h-3 text-blue-400" />
            <span>+ Left</span>
          </button>
          <button
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            title="Insert a new column to the right"
            className="px-2 py-1 rounded bg-[#22201d] hover:bg-[#2c2925] hover:text-[#FF4C00] border border-[#322f2a] flex items-center gap-1 text-[11px] font-medium transition"
          >
            <ArrowRight className="w-3 h-3 text-blue-400" />
            <span>+ Right</span>
          </button>
          <button
            onClick={() => editor.chain().focus().deleteColumn().run()}
            title="Delete current column"
            className="px-2 py-1 rounded bg-[#22201d] hover:bg-rose-500/20 text-rose-400 border border-[#322f2a] flex items-center gap-1 text-[11px] font-medium transition"
          >
            <Trash2 className="w-3 h-3" />
            <span className="hidden min-[1100px]:inline whitespace-nowrap">Delete Col</span>
          </button>
        </div>

        {/* Row Density Heights */}
        <div className="flex items-center gap-1 pr-2 border-r border-[#2e2a24]">
          <div className="flex items-center bg-[#121110] rounded p-0.5 border border-[#2e2a24]">
            <span className="text-[10px] text-stone-500 px-1 font-semibold uppercase hidden min-[1100px]:inline">Row Height:</span>
            <button
              onClick={() => handleSetRowDensity('compact')}
              title="Compact row height"
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition ${
                rowDensity === 'compact'
                  ? 'bg-[#FF4C00] text-white'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Compact
            </button>
            <button
              onClick={() => handleSetRowDensity('normal')}
              title="Normal row height"
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition ${
                rowDensity === 'normal'
                  ? 'bg-[#FF4C00] text-white'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Normal
            </button>
            <button
              onClick={() => handleSetRowDensity('spacious')}
              title="Spacious row height"
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition ${
                rowDensity === 'spacious'
                  ? 'bg-[#FF4C00] text-white'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Spacious
            </button>
          </div>
        </div>

        {/* Header & Cell Styling */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => editor.chain().focus().toggleHeaderRow().run()}
            title="Toggle company colored header row"
            className="px-2.5 py-1 rounded bg-[#22201d] hover:bg-[#2c2925] text-stone-200 hover:text-white border border-[#322f2a] flex items-center gap-1.5 text-[11px] font-medium transition"
          >
            <Heading className="w-3 h-3 text-[#FF4C00]" />
            <span className="hidden min-[1100px]:inline whitespace-nowrap">Header Row</span>
          </button>
          <button
            onClick={() => editor.chain().focus().mergeOrSplit().run()}
            title="Merge selected cells or split merged cell"
            className="px-2.5 py-1 rounded bg-[#22201d] hover:bg-[#2c2925] text-stone-200 hover:text-white border border-[#322f2a] flex items-center gap-1.5 text-[11px] font-medium transition"
          >
            <Split className="w-3 h-3 text-amber-400" />
            <span className="hidden min-[1100px]:inline whitespace-nowrap">Merge / Split</span>
          </button>
        </div>
      </div>

      {/* Delete Entire Table */}
      <div>
        <button
          onClick={() => editor.chain().focus().deleteTable().run()}
          title="Remove this entire table from the document"
          className="px-3 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1.5 text-xs font-semibold transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="hidden min-[1100px]:inline whitespace-nowrap">Delete Entire Table</span>
        </button>
      </div>
    </div>
  );
};
