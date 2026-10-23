import React from 'react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}) => (
  <div
    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    onClick={onCancel}
  >
    <div
      className="w-full max-w-sm bg-[#181715] border border-[#322f2a] rounded-2xl shadow-2xl p-5 space-y-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div>
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <p className="text-xs text-stone-400 mt-1.5 leading-relaxed">{message}</p>
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-stone-300 bg-[#22201d] hover:bg-[#2c2925] border border-[#322f2a] transition"
        >
          Cancel
        </button>
        <button
          autoFocus
          onClick={onConfirm}
          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);
