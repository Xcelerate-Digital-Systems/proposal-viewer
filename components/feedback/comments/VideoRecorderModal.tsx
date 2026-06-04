'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Circle, Mic, MicOff, Square, Upload, X, RefreshCw } from 'lucide-react';

interface VideoRecorderModalProps {
  onClose: () => void;
  onUploaded: (url: string) => void;
  /** Admin path passes company_id; public path passes share_token. Exactly one required. */
  companyId?: string | null;
  shareToken?: string | null;
}

const MAX_SECONDS = 120; // 2 minutes

type Phase = 'idle' | 'recording' | 'preview' | 'uploading';

function pickMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  for (const t of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(t)) return t;
  }
  return 'video/webm';
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60).toString();
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * Screen + mic recorder. Modelled on markup.io's video feedback flow: click
 * to start, browser prompts for screen + mic permission, a 2-minute timer
 * caps the recording, preview in-place, then Upload hits the server which
 * returns a public URL to hand back to the composer.
 *
 * Falls back to screen-only if the user denies mic permission; fails cleanly
 * if the user denies screen permission.
 */
export default function VideoRecorderModal({
  onClose,
  onUploaded,
  companyId,
  shareToken,
}: VideoRecorderModalProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [micEnabled, setMicEnabled] = useState(true);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamsRef = useRef<MediaStream[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  const cleanupStreams = useCallback(() => {
    for (const s of streamsRef.current) {
      for (const t of s.getTracks()) t.stop();
    }
    streamsRef.current = [];
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    clearTimer();
  }, [clearTimer]);

  useEffect(() => {
    return () => {
      clearTimer();
      cleanupStreams();
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
    // We intentionally ignore recordedUrl changes — we only want the unmount
    // hook to clean up whatever the current value is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = async () => {
    setError(null);
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 24 },
        audio: true,
      });
      streamsRef.current.push(screen);

      let micStream: MediaStream | null = null;
      if (micEnabled) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamsRef.current.push(micStream);
        } catch {
          // User denied mic; continue without it.
          setMicEnabled(false);
        }
      }

      const tracks: MediaStreamTrack[] = [
        ...screen.getVideoTracks(),
        ...screen.getAudioTracks(),
        ...(micStream?.getAudioTracks() ?? []),
      ];
      const combined = new MediaStream(tracks);

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(combined, { mimeType });
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        setPhase('preview');
        cleanupStreams();
      };

      // If the user stops screen-sharing via the browser chrome, stop
      // the recorder so we finalise the blob cleanly.
      const videoTrack = screen.getVideoTracks()[0];
      if (videoTrack) videoTrack.addEventListener('ended', stopRecording);

      recorder.start(500);
      setPhase('recording');
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((n) => {
          const next = n + 1;
          if (next >= MAX_SECONDS) stopRecording();
          return next;
        });
      }, 1000);
    } catch (err: unknown) {
      cleanupStreams();
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('permission')) {
        setError('Screen sharing was blocked. Allow the browser prompt and try again.');
      } else {
        setError('Could not start recording. Your browser may not support screen capture.');
      }
      setPhase('idle');
    }
  };

  const resetToIdle = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    blobRef.current = null;
    chunksRef.current = [];
    setElapsed(0);
    setPhase('idle');
  };

  const uploadRecording = async () => {
    if (!blobRef.current) return;
    setPhase('uploading');
    setError(null);

    const form = new FormData();
    form.append('file', blobRef.current, `review-${Date.now()}.webm`);
    if (companyId) form.append('company_id', companyId);
    if (shareToken) form.append('share_token', shareToken);

    try {
      const res = await fetch('/api/review-comments/video-upload', {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error || 'Upload failed');
        setPhase('preview');
        return;
      }
      const { url } = await res.json();
      if (!url) {
        setError('Upload did not return a URL');
        setPhase('preview');
        return;
      }
      onUploaded(url);
      onClose();
    } catch {
      setError('Upload failed — check your connection and try again.');
      setPhase('preview');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-[560px] bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h3 className="text-lg font-semibold text-ink">Record a video</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-faint hover:text-prose hover:bg-surface transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-5 space-y-4">
          {phase === 'idle' && (
            <>
              <p className="text-sm text-dim leading-relaxed">
                Share your screen (and your mic, if you want voice) for up to {MAX_SECONDS / 60} minutes.
                Great for walking through something a static screenshot can&rsquo;t capture.
              </p>
              <label className="flex items-center gap-2 text-sm text-prose cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={micEnabled}
                  onChange={(e) => setMicEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-edge-hover text-teal focus:ring-teal/20"
                />
                <Mic size={14} className="text-faint" />
                Include microphone audio
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="button"
                onClick={startRecording}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
              >
                <Circle size={14} fill="currentColor" />
                Start recording
              </button>
            </>
          )}

          {phase === 'recording' && (
            <>
              <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-red-50 border border-red-200">
                <div className="flex items-center gap-2 text-red-700 font-medium text-sm">
                  <span className="inline-flex w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Recording
                  {!micEnabled && (
                    <span className="flex items-center gap-1 text-xs text-red-500 ml-2">
                      <MicOff size={12} /> no mic
                    </span>
                  )}
                </div>
                <div className="font-mono text-sm text-red-700">
                  {fmt(elapsed)} / {fmt(MAX_SECONDS)}
                </div>
              </div>
              <button
                type="button"
                onClick={stopRecording}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors"
              >
                <Square size={14} fill="currentColor" />
                Stop recording
              </button>
            </>
          )}

          {phase === 'preview' && recordedUrl && (
            <>
              <div className="rounded-2xl overflow-hidden bg-black">
                <video
                  ref={previewVideoRef}
                  src={recordedUrl}
                  controls
                  className="w-full max-h-[380px] block"
                />
              </div>
              <div className="text-xs text-dim text-center">
                Length: {fmt(elapsed)}
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetToIdle}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl border border-edge-strong text-prose text-sm font-semibold hover:bg-surface transition-colors"
                >
                  <RefreshCw size={14} />
                  Record again
                </button>
                <button
                  type="button"
                  onClick={uploadRecording}
                  className="flex-[1.4] flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-teal text-white text-sm font-semibold hover:bg-teal-hover transition-colors"
                >
                  <Upload size={14} />
                  Attach to comment
                </button>
              </div>
            </>
          )}

          {phase === 'uploading' && (
            <div className="py-10 flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-edge-strong border-t-teal rounded-full animate-spin" />
              <p className="text-sm text-dim">Uploading your recording…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
