import React, { useRef, useState } from 'react';
import { Editor } from '@tiptap/react';
import { insertImageFiles } from '../extensions/ImageUpload';
import { toggleCodeBlock } from '../extensions/codeBlockCommand';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  List,
  ListOrdered,
  Quote,
  SquareCode,
  Minus,
  Table as TableIcon,
  Plus,
  Trash2,
  Split,
  Undo2,
  Redo2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Highlighter,
  Palette,
  PenTool,
  ChevronDown,
  Grid,
  FileDown,
  SpellCheck,
  Image as ImageIcon,
} from 'lucide-react';

interface ToolbarProps {
  editor: Editor | null;
  brandPrimaryColor: string;
  onOpenSignatureModal: () => void;
  autocorrect?: boolean;
  onToggleAutocorrect?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  editor,
  brandPrimaryColor,
  onOpenSignatureModal,
  autocorrect = false,
  onToggleAutocorrect,
}) => {
  const [showTableMenu, setShowTableMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [hoverGrid, setHoverGrid] = useState<{ rows: number; cols: number }>({ rows: 3, cols: 3 });
  const imageInputRef = useRef<HTMLInputElement>(null);

  if (!editor) return null;

  const colorSwatches = [
    brandPrimaryColor || '#FF4C00',
    '#FF4C00',
    '#DB5100',
    '#0f172a',
    '#475569',
    '#2563eb',
    '#059669',
    '#dc2626',
  ];

  const highlightSwatches = [
    '#fed7aa', // Orange tint
    '#fef08a', // Yellow
    '#dbeafe', // Light Blue
    '#dcfce7', // Light Green
    '#fee2e2', // Light Red
  ];

  const insertCustomTable = (rows: number, cols: number) => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: Math.max(1, rows), cols: Math.max(1, cols), withHeaderRow: true })
      .run();
    setShowTableMenu(false);
  };

  return (
    <div className="no-print bg-[#121110] backdrop-blur border-b border-[#26231f] px-3 py-1.5 flex flex-wrap items-center gap-1.5 select-none sticky top-0 z-30 shadow-md">
      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5 border-r border-[#26231f] pr-2">
        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo (⌘Z)"
          className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-[#22201d] disabled:opacity-25 disabled:hover:bg-transparent transition"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo (⌘⇧Z)"
          className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-[#22201d] disabled:opacity-25 disabled:hover:bg-transparent transition"
        >
          <Redo2 className="w-4 h-4" />
        </button>
        {onToggleAutocorrect && (
          <button
            onClick={onToggleAutocorrect}
            title={
              autocorrect
                ? 'Autocorrect is on: typos are fixed when you type a space. Backspace right after undoes it. Click to turn off.'
                : 'Autocorrect is off. Click to turn on.'
            }
            aria-pressed={autocorrect}
            className={`p-1.5 rounded-lg transition ${
              autocorrect ? 'bg-[#FF4C00]/15 text-[#FF4C00]' : 'text-stone-500 hover:text-white hover:bg-[#22201d]'
            }`}
          >
            <SpellCheck className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Headings */}
      <div className="flex items-center gap-0.5 border-r border-[#26231f] pr-2">
        <button
          onClick={() => editor.chain().focus().setParagraph().run()}
          title="Normal Text"
          className={`p-1.5 rounded-lg transition ${
            editor.isActive('paragraph')
              ? 'bg-[#FF4C00]/15 text-[#FF4C00]'
              : 'text-stone-400 hover:text-white hover:bg-[#22201d]'
          }`}
        >
          <Pilcrow className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="Heading 1"
          className={`p-1.5 rounded-lg transition ${
            editor.isActive('heading', { level: 1 })
              ? 'bg-[#FF4C00]/15 text-[#FF4C00]'
              : 'text-stone-400 hover:text-white hover:bg-[#22201d]'
          }`}
        >
          <Heading1 className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Heading 2 (Company Section Header)"
          className={`p-1.5 rounded-lg transition ${
            editor.isActive('heading', { level: 2 })
              ? 'bg-[#FF4C00]/15 text-[#FF4C00]'
              : 'text-stone-400 hover:text-white hover:bg-[#22201d]'
          }`}
        >
          <Heading2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Heading 3 (Sub-heading)"
          className={`p-1.5 rounded-lg transition ${
            editor.isActive('heading', { level: 3 })
              ? 'bg-[#FF4C00]/15 text-[#FF4C00]'
              : 'text-stone-400 hover:text-white hover:bg-[#22201d]'
          }`}
        >
          <Heading3 className="w-4 h-4" />
        </button>
      </div>

      {/* Basic Text Formatting */}
      <div className="flex items-center gap-0.5 border-r border-[#26231f] pr-2">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold (⌘B)"
          className={`p-1.5 rounded-lg transition ${
            editor.isActive('bold')
              ? 'bg-[#FF4C00]/15 text-[#FF4C00] font-bold'
              : 'text-stone-400 hover:text-white hover:bg-[#22201d]'
          }`}
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic (⌘I)"
          className={`p-1.5 rounded-lg transition ${
            editor.isActive('italic')
              ? 'bg-[#FF4C00]/15 text-[#FF4C00]'
              : 'text-stone-400 hover:text-white hover:bg-[#22201d]'
          }`}
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline (⌘U)"
          className={`p-1.5 rounded-lg transition ${
            editor.isActive('underline')
              ? 'bg-[#FF4C00]/15 text-[#FF4C00]'
              : 'text-stone-400 hover:text-white hover:bg-[#22201d]'
          }`}
        >
          <UnderlineIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
          className={`p-1.5 rounded-lg transition ${
            editor.isActive('strike')
              ? 'bg-[#FF4C00]/15 text-[#FF4C00]'
              : 'text-stone-400 hover:text-white hover:bg-[#22201d]'
          }`}
        >
          <Strikethrough className="w-4 h-4" />
        </button>
      </div>

      {/* Colors & Highlight */}
      <div className="flex items-center gap-1 border-r border-[#26231f] pr-2 relative">
        <div className="relative">
          <button
            onClick={() => {
              setShowColorPicker(!showColorPicker);
              setShowHighlightPicker(false);
              setShowTableMenu(false);
            }}
            title="Text Color"
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-[#22201d] flex items-center gap-1 transition"
          >
            <Palette className="w-4 h-4" />
            <div
              className="w-2.5 h-2.5 rounded-full border border-stone-600"
              style={{ backgroundColor: brandPrimaryColor || '#FF4C00' }}
            />
          </button>
          {showColorPicker && (
            <div className="absolute top-full left-0 mt-1 bg-[#1a1917] border border-[#322f2a] rounded-xl p-2.5 shadow-2xl z-50 flex items-center gap-1.5">
              {colorSwatches.map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    editor.chain().focus().setColor(color).run();
                    setShowColorPicker(false);
                  }}
                  className="w-5 h-5 rounded-full border border-stone-600 hover:scale-125 transition"
                  style={{ backgroundColor: color }}
                />
              ))}
              <button
                onClick={() => {
                  editor.chain().focus().unsetColor().run();
                  setShowColorPicker(false);
                }}
                className="text-[10px] text-stone-400 hover:text-white px-1.5 py-0.5 border border-[#322f2a] rounded"
              >
                Reset
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => {
              setShowHighlightPicker(!showHighlightPicker);
              setShowColorPicker(false);
              setShowTableMenu(false);
            }}
            title="Text Highlight"
            className={`p-1.5 rounded-lg transition ${
              editor.isActive('highlight')
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-stone-400 hover:text-white hover:bg-[#22201d]'
            }`}
          >
            <Highlighter className="w-4 h-4" />
          </button>
          {showHighlightPicker && (
            <div className="absolute top-full left-0 mt-1 bg-[#1a1917] border border-[#322f2a] rounded-xl p-2.5 shadow-2xl z-50 flex items-center gap-1.5">
              {highlightSwatches.map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    editor.chain().focus().toggleHighlight({ color }).run();
                    setShowHighlightPicker(false);
                  }}
                  className="w-5 h-5 rounded border border-stone-600 hover:scale-125 transition"
                  style={{ backgroundColor: color }}
                />
              ))}
              <button
                onClick={() => {
                  editor.chain().focus().unsetHighlight().run();
                  setShowHighlightPicker(false);
                }}
                className="text-[10px] text-stone-400 hover:text-white px-1.5 py-0.5 border border-[#322f2a] rounded"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Alignment */}
      <div className="flex items-center gap-0.5 border-r border-[#26231f] pr-2">
        <button
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          title="Align Left"
          className={`p-1.5 rounded-lg transition ${
            editor.isActive({ textAlign: 'left' })
              ? 'bg-[#FF4C00]/15 text-[#FF4C00]'
              : 'text-stone-400 hover:text-white hover:bg-[#22201d]'
          }`}
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          title="Align Center"
          className={`p-1.5 rounded-lg transition ${
            editor.isActive({ textAlign: 'center' })
              ? 'bg-[#FF4C00]/15 text-[#FF4C00]'
              : 'text-stone-400 hover:text-white hover:bg-[#22201d]'
          }`}
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          title="Align Right"
          className={`p-1.5 rounded-lg transition ${
            editor.isActive({ textAlign: 'right' })
              ? 'bg-[#FF4C00]/15 text-[#FF4C00]'
              : 'text-stone-400 hover:text-white hover:bg-[#22201d]'
          }`}
        >
          <AlignRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          title="Justify"
          className={`p-1.5 rounded-lg transition ${
            editor.isActive({ textAlign: 'justify' })
              ? 'bg-[#FF4C00]/15 text-[#FF4C00]'
              : 'text-stone-400 hover:text-white hover:bg-[#22201d]'
          }`}
        >
          <AlignJustify className="w-4 h-4" />
        </button>
      </div>

      {/* Lists & Dividers */}
      <div className="flex items-center gap-0.5 border-r border-[#26231f] pr-2">
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet List"
          className={`p-1.5 rounded-lg transition ${
            editor.isActive('bulletList')
              ? 'bg-[#FF4C00]/15 text-[#FF4C00]'
              : 'text-stone-400 hover:text-white hover:bg-[#22201d]'
          }`}
        >
          <List className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered List"
          className={`p-1.5 rounded-lg transition ${
            editor.isActive('orderedList')
              ? 'bg-[#FF4C00]/15 text-[#FF4C00]'
              : 'text-stone-400 hover:text-white hover:bg-[#22201d]'
          }`}
        >
          <ListOrdered className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Callout Quote"
          className={`p-1.5 rounded-lg transition ${
            editor.isActive('blockquote')
              ? 'bg-[#FF4C00]/15 text-[#FF4C00]'
              : 'text-stone-400 hover:text-white hover:bg-[#22201d]'
          }`}
        >
          <Quote className="w-4 h-4" />
        </button>
        <button
          onClick={() => toggleCodeBlock(editor)}
          title="Code Block"
          className={`p-1.5 rounded-lg transition ${
            editor.isActive('codeBlock')
              ? 'bg-[#FF4C00]/15 text-[#FF4C00]'
              : 'text-stone-400 hover:text-white hover:bg-[#22201d]'
          }`}
        >
          <SquareCode className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal Divider"
          className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-[#22201d] transition"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().insertContent({ type: 'pageBreak' }).run()}
          title="Insert Page Break (Starts Next Page like Word / Pages)"
          className="px-2 py-1 rounded-lg text-stone-300 hover:text-[#FF4C00] hover:bg-[#22201d] border border-[#2e2a24] text-[11px] font-medium flex items-center gap-1 transition"
        >
          <FileDown className="w-3.5 h-3.5 text-[#FF4C00]" />
          <span className="hidden min-[1100px]:inline">Page Break</span>
        </button>
      </div>

      {/* Visual Table Inserter & Dropdown */}
      <div className="relative">
        <button
          onClick={() => {
            setShowTableMenu(!showTableMenu);
            setShowColorPicker(false);
            setShowHighlightPicker(false);
          }}
          title="Insert or Manage Table"
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
            editor.isActive('table')
              ? 'bg-[#FF4C00] text-white shadow-md shadow-[#FF4C00]/25'
              : 'bg-[#1a1917] text-stone-200 hover:bg-[#22201d] border border-[#2e2a24]'
          }`}
        >
          <TableIcon className={`w-4 h-4 ${editor.isActive('table') ? 'text-white' : 'text-[#FF4C00]'}`} />
          <span className="hidden min-[1100px]:inline">Table</span>
          <ChevronDown className="w-3.5 h-3.5 opacity-70" />
        </button>

        {showTableMenu && (
          <div className="absolute top-full left-0 mt-1 bg-[#181715] border border-[#322f2a] rounded-xl p-3 shadow-2xl z-50 w-64 space-y-3 text-xs animate-in fade-in duration-100">
            {/* Visual Interactive Grid Selector */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-stone-300 mb-2">
                <span className="flex items-center gap-1">
                  <Grid className="w-3.5 h-3.5 text-[#FF4C00]" /> Insert Grid:
                </span>
                <span className="text-[#FF4C00] font-mono font-bold">
                  {hoverGrid.cols} × {hoverGrid.rows}
                </span>
              </div>

              {/* 5x5 Grid Squares */}
              <div
                className="grid grid-cols-5 gap-1.5 p-2 bg-[#121110] rounded-lg border border-[#26231f] cursor-pointer"
                onMouseLeave={() => setHoverGrid({ rows: 3, cols: 3 })}
              >
                {Array.from({ length: 5 }).map((_, r) =>
                  Array.from({ length: 5 }).map((_, c) => {
                    const rowNum = r + 1;
                    const colNum = c + 1;
                    const isSelected = rowNum <= hoverGrid.rows && colNum <= hoverGrid.cols;
                    return (
                      <div
                        key={`${r}-${c}`}
                        onMouseEnter={() => setHoverGrid({ rows: rowNum, cols: colNum })}
                        onClick={() => insertCustomTable(rowNum, colNum)}
                        className={`w-8 h-8 rounded border transition-all ${
                          isSelected
                            ? 'bg-[#FF4C00] border-[#FF4C00] shadow-sm'
                            : 'bg-[#22201d] border-[#322f2a] hover:border-stone-500'
                        }`}
                      />
                    );
                  })
                )}
              </div>
            </div>

            {/* Quick 1-Click Templates */}
            <div className="space-y-1 pt-1 border-t border-[#26231f]">
              <span className="text-[10px] uppercase font-semibold text-stone-500 tracking-wider block mb-1">
                Quick Presets:
              </span>
              <button
                onClick={() => insertCustomTable(3, 2)}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-[#22201d] text-stone-300 hover:text-white flex items-center justify-between"
              >
                <span>2 Columns (Simple)</span>
                <span className="text-stone-500 text-[10px]">2×3</span>
              </button>
              <button
                onClick={() => insertCustomTable(4, 3)}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-[#22201d] text-stone-300 hover:text-white flex items-center justify-between"
              >
                <span>3 Columns (Status / Tasks)</span>
                <span className="text-stone-500 text-[10px]">3×4</span>
              </button>
              <button
                onClick={() => insertCustomTable(4, 4)}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-[#22201d] text-stone-300 hover:text-white flex items-center justify-between"
              >
                <span>4 Columns (Data Grid)</span>
                <span className="text-stone-500 text-[10px]">4×4</span>
              </button>
            </div>

            {/* If currently inside a table, also show quick table operations */}
            {editor.isActive('table') && (
              <div className="pt-2 border-t border-[#26231f] space-y-1">
                <span className="text-[10px] uppercase font-semibold text-[#FF4C00] tracking-wider block mb-1">
                  Active Table Actions:
                </span>
                <button
                  onClick={() => {
                    editor.chain().focus().addRowAfter().run();
                    setShowTableMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1 rounded text-stone-300 hover:bg-[#22201d] hover:text-white"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" /> Add Row
                </button>
                <button
                  onClick={() => {
                    editor.chain().focus().addColumnAfter().run();
                    setShowTableMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1 rounded text-stone-300 hover:bg-[#22201d] hover:text-white"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-400" /> Add Column
                </button>
                <button
                  onClick={() => {
                    editor.chain().focus().deleteTable().run();
                    setShowTableMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-rose-400 hover:bg-rose-500/20 font-semibold"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Entire Table
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Picture */}
      <div className="ml-1.5">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void insertImageFiles(editor, Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
        />
        <button
          onClick={() => imageInputRef.current?.click()}
          title="Insert Picture (or drop / paste one on the page)"
          className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition bg-[#1a1917] text-stone-200 hover:bg-[#22201d] border border-[#2e2a24]"
        >
          <ImageIcon className="w-4 h-4 text-[#FF4C00]" />
          <span className="hidden min-[1100px]:inline">Picture</span>
        </button>
      </div>

      {/* Signature button */}
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onOpenSignatureModal}
          title="Sign-off & Signature Settings"
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#FF4C00]/15 hover:bg-[#FF4C00]/25 text-[#FF4C00] border border-[#FF4C00]/30 flex items-center gap-1.5 transition shadow-sm"
        >
          <PenTool className="w-3.5 h-3.5 text-[#FF4C00]" />
          <span className="hidden min-[1100px]:inline whitespace-nowrap">Signature & Sign-off</span>
        </button>
      </div>
    </div>
  );
};
