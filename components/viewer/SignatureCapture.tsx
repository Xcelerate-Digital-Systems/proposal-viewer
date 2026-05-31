'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { PenTool, Type, Eraser } from 'lucide-react';

export interface SignatureData {
  mode: 'typed' | 'drawn';
  typed_name?: string;
  signature_image_base64?: string;
}

interface SignatureCaptureProps {
  signerName: string;
  onSignerNameChange?: (name: string) => void;
  accentColor?: string;
  hairlineColor?: string;
  inputBg?: string;
  inputColor?: string;
  labelColor?: string;
  labelFont?: string;
  onSignatureChange: (data: SignatureData | null) => void;
}

export default function SignatureCapture({
  signerName,
  onSignerNameChange,
  accentColor = '#017C87',
  hairlineColor = '#d1d5db',
  inputBg = '#ffffff',
  inputColor = '#1f2937',
  labelColor,
  labelFont,
  onSignatureChange,
}: SignatureCaptureProps) {
  const [mode, setMode] = useState<'typed' | 'drawn'>('typed');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    if (mode === 'typed' && signerName.trim()) {
      onSignatureChange({ mode: 'typed', typed_name: signerName.trim() });
    } else if (mode === 'typed') {
      onSignatureChange(null);
    }
  }, [mode, signerName, onSignatureChange]);

  const getCanvasContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    return { canvas, ctx };
  }, []);

  const initCanvas = useCallback(() => {
    const result = getCanvasContext();
    if (!result) return;
    const { canvas, ctx } = result;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [getCanvasContext]);

  useEffect(() => {
    if (mode === 'drawn') {
      initCanvas();
    }
  }, [mode, initCanvas]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const result = getCanvasContext();
    if (!result) return;
    const { ctx } = result;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const result = getCanvasContext();
    if (!result) return;
    const { ctx } = result;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (hasDrawn) {
      const canvas = canvasRef.current;
      if (canvas) {
        const dataUrl = canvas.toDataURL('image/png');
        onSignatureChange({ mode: 'drawn', signature_image_base64: dataUrl });
      }
    }
  };

  const clearCanvas = () => {
    const result = getCanvasContext();
    if (!result) return;
    const { canvas, ctx } = result;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onSignatureChange(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 p-1 bg-black/5 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => { setMode('typed'); onSignatureChange(signerName.trim() ? { mode: 'typed', typed_name: signerName.trim() } : null); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            mode === 'typed' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Type size={13} />
          Type
        </button>
        <button
          type="button"
          onClick={() => { setMode('drawn'); onSignatureChange(null); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            mode === 'drawn' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <PenTool size={13} />
          Draw
        </button>
      </div>

      {mode === 'typed' ? (
        <div className="space-y-2">
          <input
            type="text"
            value={signerName}
            onChange={(e) => onSignerNameChange?.(e.target.value)}
            placeholder="Type your full name"
            className="w-full px-3 py-2.5 rounded-lg text-base md:text-sm focus:outline-none transition-colors"
            style={{ border: `1px solid ${hairlineColor}`, backgroundColor: inputBg, color: inputColor }}
          />
          <div
            className="h-16 rounded-xl border-2 border-dashed flex items-center justify-center px-6"
            style={{ borderColor: signerName.trim() ? accentColor : '#d1d5db' }}
          >
            {signerName.trim() ? (
              <span
                className="text-3xl italic select-none"
                style={{ fontFamily: "'Dancing Script', 'Brush Script MT', cursive", color: inputColor }}
              >
                {signerName}
              </span>
            ) : (
              <span className="text-sm" style={{ color: '#9ca3af' }}>Your signature will appear here</span>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {onSignerNameChange && (
            <input
              type="text"
              value={signerName}
              onChange={(e) => onSignerNameChange(e.target.value)}
              placeholder="Type your full name"
              className="w-full px-3 py-2.5 rounded-lg text-base md:text-sm focus:outline-none transition-colors"
              style={{ border: `1px solid ${hairlineColor}`, backgroundColor: inputBg, color: inputColor }}
            />
          )}
          <div className="relative">
          <canvas
            ref={canvasRef}
            className="w-full h-28 rounded-xl border-2 border-dashed cursor-crosshair touch-none"
            style={{ borderColor: hasDrawn ? accentColor : '#d1d5db' }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
          {hasDrawn && (
            <button
              type="button"
              onClick={clearCanvas}
              className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md bg-white/90 text-xs text-gray-500 hover:text-gray-700 shadow-sm border border-gray-200"
            >
              <Eraser size={12} />
              Clear
            </button>
          )}
          {!hasDrawn && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-sm text-gray-400">Draw your signature here</span>
            </div>
          )}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        By signing, you confirm your identity and agree to the terms above.
      </p>
    </div>
  );
}
