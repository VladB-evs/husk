import React, { useRef, useState, useEffect } from 'react';
import { X, Upload, PenTool, Check, Trash2 } from 'lucide-react';
import { getStoredUserProfile, saveUserProfile } from '../utils/storage';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplySignature: (signatureUrl: string, name?: string, role?: string) => void;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({
  isOpen,
  onClose,
  onApplySignature,
}) => {
  const [tab, setTab] = useState<'draw' | 'upload'>('draw');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [saveAsDefault, setSaveAsDefault] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      const profile = getStoredUserProfile();
      setName(profile.defaultName || '');
      setRole(profile.defaultRole || '');
      if (profile.savedSignatureUrl) {
        setUploadedUrl(profile.savedSignatureUrl);
      }
      setTimeout(initCanvas, 50);
    }
  }, [isOpen]);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setUploadedUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    let finalSignatureUrl = '';

    if (tab === 'draw') {
      const canvas = canvasRef.current;
      if (canvas && hasDrawn) {
        finalSignatureUrl = canvas.toDataURL('image/png');
      }
    } else {
      finalSignatureUrl = uploadedUrl;
    }

    if (!finalSignatureUrl && uploadedUrl) {
      finalSignatureUrl = uploadedUrl;
    }

    if (saveAsDefault) {
      saveUserProfile({
        savedSignatureUrl: finalSignatureUrl,
        defaultName: name,
        defaultRole: role,
      });
    }

    onApplySignature(finalSignatureUrl, name, role);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-[#181715] border border-[#322f2a] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#26231f]">
          <div>
            <h3 className="text-lg font-semibold text-white">Document Signature</h3>
            <p className="text-xs text-stone-400">Configure your official sign-off for documents</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-[#22201d] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-[#26231f] px-6 pt-3 gap-4">
          <button
            onClick={() => setTab('draw')}
            className={`pb-2 text-sm font-medium flex items-center gap-2 border-b-2 transition ${
              tab === 'draw'
                ? 'border-[#FF4C00] text-[#FF4C00]'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <PenTool className="w-4 h-4" /> Draw Signature
          </button>
          <button
            onClick={() => setTab('upload')}
            className={`pb-2 text-sm font-medium flex items-center gap-2 border-b-2 transition ${
              tab === 'upload'
                ? 'border-[#FF4C00] text-[#FF4C00]'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Upload className="w-4 h-4" /> Upload Image
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {tab === 'draw' ? (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs text-stone-400">
                <span>Draw your signature below using mouse or trackpad:</span>
                {hasDrawn && (
                  <button
                    onClick={clearCanvas}
                    className="flex items-center gap-1 text-rose-400 hover:text-rose-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Clear
                  </button>
                )}
              </div>
              <div className="bg-white rounded-xl border border-stone-300 overflow-hidden relative shadow-inner">
                <canvas
                  ref={canvasRef}
                  width={460}
                  height={150}
                  className="w-full h-[150px] cursor-crosshair touch-none"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
                {!hasDrawn && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-sm select-none">
                    Sign on this line
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-xs text-stone-400 block">Upload signature file (PNG with transparent background recommended):</label>
              <div className="border-2 border-dashed border-[#322f2a] hover:border-[#FF4C00] rounded-xl p-6 text-center cursor-pointer transition bg-[#1e1c19] relative">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                {uploadedUrl ? (
                  <div className="flex flex-col items-center">
                    <img
                      src={uploadedUrl}
                      alt="Signature Preview"
                      className="max-h-24 object-contain filter contrast-125 bg-white/90 p-2 rounded-lg shadow-sm"
                    />
                    <p className="text-xs text-emerald-400 mt-2 font-medium">Image uploaded. Click to replace.</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-stone-400">
                    <Upload className="w-8 h-8 text-[#FF4C00]" />
                    <span className="text-sm font-medium text-stone-300">Click or drag & drop signature</span>
                    <span className="text-xs text-stone-500">PNG, JPG, or SVG</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Signer Info */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-medium text-stone-400 mb-1">Signer Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jane Smith"
                className="w-full px-3 py-2 bg-[#22201d] border border-[#322f2a] rounded-lg text-sm text-white focus:outline-none focus:border-[#FF4C00]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-400 mb-1">Signer Role</label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Founder & CEO"
                className="w-full px-3 py-2 bg-[#22201d] border border-[#322f2a] rounded-lg text-sm text-white focus:outline-none focus:border-[#FF4C00]"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={saveAsDefault}
              onChange={(e) => setSaveAsDefault(e.target.checked)}
              className="rounded bg-[#22201d] border-[#322f2a] text-[#FF4C00] focus:ring-[#FF4C00]"
            />
            Save as default signature profile for all future documents
          </label>
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
            <Check className="w-4 h-4" /> Apply Signature
          </button>
        </div>
      </div>
    </div>
  );
};
