import React, { useEffect, useState } from 'react';
import { Editor } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';
import {
  Image as ImageIcon,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Minus,
  Plus,
  Columns2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

interface ImageQuickControlsProps {
  editor: Editor | null;
  brandPrimaryColor?: string;
}

function moveImageNode(editor: Editor, dir: 'up' | 'down') {
  const { state, dispatch } = editor.view;
  const { selection } = state;
  let pos = -1;
  let node: PMNode | null = null;

  if (selection instanceof NodeSelection && selection.node.type.name === 'image') {
    pos = selection.from;
    node = selection.node;
  } else {
    const $pos = selection.$from;
    for (let d = $pos.depth; d >= 0; d--) {
      const p = $pos.node(d);
      if (p.type.name === 'image') {
        pos = $pos.before(d);
        node = p;
        break;
      }
    }
  }

  if (pos < 0 || !node) return false;

  const $pos = state.doc.resolve(pos);
  const index = $pos.index();
  const parent = $pos.parent;

  if (dir === 'up') {
    if (index === 0) return false;
    const prevNode = parent.child(index - 1);
    const prevPos = pos - prevNode.nodeSize;
    const tr = state.tr.delete(pos, pos + node.nodeSize).insert(prevPos, node);
    tr.setSelection(NodeSelection.create(tr.doc, prevPos));
    dispatch(tr);
    editor.view.focus();
    return true;
  } else {
    if (index >= parent.childCount - 1) return false;
    const nextNode = parent.child(index + 1);
    const targetPos = pos + nextNode.nodeSize;
    const tr = state.tr.delete(pos, pos + node.nodeSize).insert(targetPos, node);
    tr.setSelection(NodeSelection.create(tr.doc, targetPos));
    dispatch(tr);
    editor.view.focus();
    return true;
  }
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
    const currentNum = parseFloat(width) || 100;
    const newNum = Math.max(15, Math.min(100, Math.round(currentNum + delta)));
    editor.chain().focus().updateAttributes('image', { width: `${newNum}%` }).run();
  };

  const handleSetAlignment = (align: 'left' | 'center' | 'right') => {
    editor.chain().focus().updateAttributes('image', { alignment: align }).run();
  };

  const handleTwoColumns = () => {
    const { state } = editor.view;
    const { selection } = state;
    let targetAlign: 'left' | 'right' = 'left';

    if (selection instanceof NodeSelection && selection.node.type.name === 'image') {
      const pos = selection.from;
      const $pos = state.doc.resolve(pos);
      const index = $pos.index();
      const parent = $pos.parent;
      if (index > 0 && parent.child(index - 1).type.name === 'image') {
        const prevAlign = parent.child(index - 1).attrs.alignment;
        targetAlign = prevAlign === 'left' ? 'right' : 'left';
      }
    }

    editor.chain().focus().updateAttributes('image', { width: '48.5%', alignment: targetAlign }).run();
  };

  const handleCaptionChange = (val: string) => {
    setCaptionText(val);
    editor.commands.updateAttributes('image', { caption: val });
  };

  const handleDelete = () => {
    editor.chain().focus().deleteSelection().run();
  };

  const isTwoCol = width === '48.5%' || width === '50%';

  return (
    <div className="bg-[#1a1917] border-b border-[#2e2a24] px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-200 select-none shadow-md">
      <div className="flex flex-wrap items-center gap-2">
        {/* Image Badge */}
        <span className="flex items-center gap-1.5 font-bold text-[#FF4C00] uppercase tracking-wider text-[11px] pr-2.5 border-r border-[#2e2a24]">
          <ImageIcon className="w-3.5 h-3.5" /> Picture Controls
        </span>

        {/* Move Up / Down */}
        <div className="flex items-center gap-1 pr-2 border-r border-[#2e2a24]">
          <span className="text-[10px] text-stone-400 font-semibold uppercase mr-0.5 hidden min-[1100px]:inline">
            Move:
          </span>
          <button
            onClick={() => moveImageNode(editor, 'up')}
            title="Move picture up before previous block"
            className="px-2 py-1 rounded bg-[#22201d] hover:bg-[#2c2925] text-stone-300 hover:text-white border border-[#322f2a] flex items-center gap-1 text-[11px] font-medium transition"
          >
            <ArrowUp className="w-3 h-3 text-emerald-400" />
            <span className="hidden min-[1200px]:inline">Up</span>
          </button>
          <button
            onClick={() => moveImageNode(editor, 'down')}
            title="Move picture down after next block"
            className="px-2 py-1 rounded bg-[#22201d] hover:bg-[#2c2925] text-stone-300 hover:text-white border border-[#322f2a] flex items-center gap-1 text-[11px] font-medium transition"
          >
            <ArrowDown className="w-3 h-3 text-blue-400" />
            <span className="hidden min-[1200px]:inline">Down</span>
          </button>
        </div>

        {/* 2-Columns Side by Side Button */}
        <div className="flex items-center gap-1 pr-2 border-r border-[#2e2a24]">
          <button
            onClick={handleTwoColumns}
            title="Set to 2-Column Side-by-Side (Pairs with neighboring image)"
            className={`px-2 py-1 rounded border flex items-center gap-1.5 text-[11px] font-medium transition ${
              isTwoCol && alignment !== 'center'
                ? 'bg-[#FF4C00]/20 text-[#FF4C00] border-[#FF4C00]/40 font-semibold'
                : 'bg-[#22201d] hover:bg-[#2c2925] text-stone-300 border-[#322f2a]'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5 text-[#FF4C00]" />
            <span>2-Col Side by Side</span>
          </button>
        </div>

        {/* Size Presets & Nudge */}
        <div className="flex items-center gap-1 pr-2 border-r border-[#2e2a24]">
          <span className="text-[10px] text-stone-400 font-semibold uppercase mr-0.5 hidden min-[1100px]:inline">
            Size:
          </span>
          {[
            { label: '25%', val: '25%' },
            { label: '50%', val: '48.5%' },
            { label: '75%', val: '75%' },
            { label: '100%', val: '100%' },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => handleSetWidth(item.val)}
              title={`Set width to ${item.label}`}
              className={`px-2 py-1 rounded border text-[11px] font-medium transition ${
                width === item.val || (item.label === '50%' && (width === '50%' || width === '48.5%'))
                  ? 'bg-[#FF4C00]/20 text-[#FF4C00] border-[#FF4C00]/40 font-semibold'
                  : 'bg-[#22201d] hover:bg-[#2c2925] text-stone-300 border-[#322f2a]'
              }`}
            >
              {item.label}
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
            title="Align Left (Left Column for Side-by-Side)"
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
            title="Align Center (Full width row)"
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
            title="Align Right (Right Column for Side-by-Side)"
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
            className="bg-[#121110] border border-[#2e2a24] focus:border-[#FF4C00] rounded px-2.5 py-1 text-xs text-stone-200 placeholder-stone-500 outline-none w-48 min-[1200px]:w-64 transition"
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
