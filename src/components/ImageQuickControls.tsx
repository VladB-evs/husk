import React, { useEffect, useState } from 'react';
import { Editor } from '@tiptap/react';
import {
  Image as ImageIcon,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Minus,
  Plus,
} from 'lucide-react';

interface ImageQuickControlsProps {
  editor: Editor | null;
  brandPrimaryColor?: string;
}

export const ImageQuickControls: React.FC<ImageQuickControlsProps> = ({
  editor,
  brandPrimaryColor = '#FF4C00',
}) => {
  if (!editor || !editor.isActive('image')) return null;

  const attrs = editor.getAttributes('image');
  const width: string = attrs.width || '100%';
  const alignment: 'left' | 'center' | 'right' = attrs.alignment || 'center';
  const rawCaption: string = attrs.caption || '';

  const [captionText, setCaptionText] = useState(rawCaption);

  useEffect(() => {
    setCaptionText(rawCaption);
  }, [rawCaption]);

  const handleSetWidth = (w: string) => {
    editor.chain().focus().updateAttributes('image', { width: w }).run();
  };

  const handleNudgeWidth = (delta: number) => {
    const currentNum = parseInt(width, 10) || 100;
    const newNum = Math.max(15, Math.min(100, currentNum + delta));
    editor.chain().focus().updateAttributes('image', { width: `${newNum}%` }).run();
  };

  const handleSetAlignment = (align: 'left' | 'center' | 'right') => {
    editor.chain().focus().updateAttributes('image', { alignment: align }).run();
  };

  const handleCaptionChange = (val: string) => {
    setCaptionText(val);
    editor.commands.updateAttributes('image', { caption: val });
  };

  const handleDelete = () => {
    editor.chain().focus().deleteSelection().run();
  };

  return (
    <div className="bg-[#1a1917] border-b border-[#2e2a24] px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-200 select-none shadow-md">
      <div className="flex flex-wrap items-center gap-2">
        {/* Image Badge */}
        <span className="flex items-center gap-1.5 font-bold text-[#FF4C00] uppercase tracking-wider text-[11px] pr-2.5 border-r border-[#2e2a24]">
          <ImageIcon className="w-3.5 h-3.5" /> Picture Controls
        </span>

        {/* Size Presets & Nudge */}
        <div className="flex items-center gap-1 pr-2 border-r border-[#2e2a24]">
          <span className="text-[10px] text-stone-400 font-semibold uppercase mr-0.5 hidden min-[1100px]:inline">
            Size:
          </span>
          {(['25%', '50%', '75%', '100%'] as const).map((pct) => (
            <button
              key={pct}
              onClick={() => handleSetWidth(pct)}
              title={`Set width to ${pct}`}
              className={`px-2 py-1 rounded border text-[11px] font-medium transition ${
                width === pct
                  ? 'bg-[#FF4C00]/20 text-[#FF4C00] border-[#FF4C00]/40 font-semibold'
                  : 'bg-[#22201d] hover:bg-[#2c2925] text-stone-300 border-[#322f2a]'
              }`}
            >
              {pct}
            </button>
          ))}
          <button
            onClick={() => handleNudgeWidth(-5)}
            title="Reduce width by 5%"
            className="p-1 rounded bg-[#22201d] hover:bg-[#2c2925] text-stone-300 hover:text-white border border-[#322f2a] transition ml-0.5"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-[11px] font-mono text-stone-300 px-1 min-w-[34px] text-center">{width}</span>
          <button
            onClick={() => handleNudgeWidth(5)}
            title="Increase width by 5%"
            className="p-1 rounded bg-[#22201d] hover:bg-[#2c2925] text-stone-300 hover:text-white border border-[#322f2a] transition"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {/* Alignment */}
        <div className="flex items-center gap-1 pr-2 border-r border-[#2e2a24]">
          <span className="text-[10px] text-stone-400 font-semibold uppercase mr-0.5 hidden min-[1100px]:inline">
            Align:
          </span>
          <button
            onClick={() => handleSetAlignment('left')}
            title="Align left"
            className={`p-1.5 rounded border transition ${
              alignment === 'left'
                ? 'bg-[#FF4C00]/20 text-[#FF4C00] border-[#FF4C00]/40'
                : 'bg-[#22201d] hover:bg-[#2c2925] text-stone-400 hover:text-white border-[#322f2a]'
            }`}
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleSetAlignment('center')}
            title="Align center"
            className={`p-1.5 rounded border transition ${
              alignment === 'center'
                ? 'bg-[#FF4C00]/20 text-[#FF4C00] border-[#FF4C00]/40'
                : 'bg-[#22201d] hover:bg-[#2c2925] text-stone-400 hover:text-white border-[#322f2a]'
            }`}
          >
            <AlignCenter className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleSetAlignment('right')}
            title="Align right"
            className={`p-1.5 rounded border transition ${
              alignment === 'right'
                ? 'bg-[#FF4C00]/20 text-[#FF4C00] border-[#FF4C00]/40'
                : 'bg-[#22201d] hover:bg-[#2c2925] text-stone-400 hover:text-white border-[#322f2a]'
            }`}
          >
            <AlignRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Description / Caption Input */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-stone-400 font-semibold uppercase hidden min-[1100px]:inline">
            Description:
          </span>
          <input
            type="text"
            value={captionText}
            onChange={(e) => handleCaptionChange(e.target.value)}
            placeholder="Add description / caption..."
            className="bg-[#121110] border border-[#2e2a24] focus:border-[#FF4C00] rounded px-2.5 py-1 text-xs text-stone-200 placeholder-stone-500 outline-none w-52 min-[1200px]:w-72 transition"
          />
        </div>
      </div>

      {/* Delete Picture */}
      <button
        onClick={handleDelete}
        title="Delete picture"
        className="px-2 py-1 rounded bg-[#22201d] hover:bg-rose-500/20 text-rose-400 border border-[#322f2a] flex items-center gap-1 text-[11px] font-medium transition"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span className="hidden min-[1100px]:inline whitespace-nowrap">Delete Picture</span>
      </button>
    </div>
  );
};
