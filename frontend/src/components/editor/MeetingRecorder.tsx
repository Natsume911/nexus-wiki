import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Square, Loader2, X, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import { transcribeMeetingAudio } from '@/api/meeting';

type RecordingState = 'idle' | 'recording' | 'processing';
type ProcessingStep = 'transcribing' | 'generating';

interface MeetingRecorderProps {
  onInsert: (content: Record<string, unknown>) => void;
  onClose: () => void;
}

export function MeetingRecorder({ onInsert, onClose }: MeetingRecorderProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [processingStep, setProcessingStep] = useState<ProcessingStep>('transcribing');
  const [captureTab, setCaptureTab] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const t = useT();

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamsRef = useRef<MediaStream[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Cleanup all media resources
  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamsRef.current.forEach(s => s.getTracks().forEach(t => t.stop()));
    streamsRef.current = [];
    if (audioCtxRef.current?.state !== 'closed') {
      audioCtxRef.current?.close().catch(() => {});
    }
    audioCtxRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const startRecording = useCallback(async () => {
    setErrorMsg(null);
    try {
      // Check if mediaDevices API is available (requires HTTPS or localhost)
      if (!navigator.mediaDevices) {
        setErrorMsg(t('meeting.errorMediaDevices'));
        return;
      }

      let streamToRecord: MediaStream;

      if (captureTab) {
        // Check if getDisplayMedia is supported
        if (!navigator.mediaDevices.getDisplayMedia) {
          setErrorMsg(t('meeting.errorDisplayMedia'));
          return;
        }

        // Capture tab audio (both sides of the call)
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,  // Required by browser API, we'll ignore the video
          audio: true,
        });

        // Capture microphone
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        streamsRef.current = [displayStream, micStream];

        // Stop video tracks immediately — we only need audio
        displayStream.getVideoTracks().forEach(t => t.stop());

        // Check if display audio was actually captured
        const displayAudioTracks = displayStream.getAudioTracks();

        if (displayAudioTracks.length > 0) {
          // Mix both audio streams
          const audioContext = new AudioContext();
          audioCtxRef.current = audioContext;
          const dest = audioContext.createMediaStreamDestination();

          const displaySource = audioContext.createMediaStreamSource(
            new MediaStream(displayAudioTracks)
          );
          const micSource = audioContext.createMediaStreamSource(micStream);
          displaySource.connect(dest);
          micSource.connect(dest);

          streamToRecord = dest.stream;
        } else {
          // Fallback: no tab audio available, use mic only
          streamToRecord = micStream;
        }
      } else {
        // Microphone only
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamsRef.current = [micStream];
        streamToRecord = micStream;
      }

      // Determine supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/ogg';

      const recorder = new MediaRecorder(streamToRecord, { mimeType });
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const ext = mimeType.includes('webm') ? 'webm' : 'ogg';
        const file = new File([blob], `riunione-${Date.now()}.${ext}`, { type: mimeType });

        cleanup();
        setState('processing');
        setProcessingStep('transcribing');

        try {
          // Small delay for UX
          setTimeout(() => setProcessingStep('generating'), 5000);

          const result = await transcribeMeetingAudio(file);
          // insertContent wants the content array, not the doc wrapper
          const doc = result.content as { type?: string; content?: unknown[] };
          const nodes = doc.type === 'doc' && doc.content ? doc.content : doc;
          console.log('[MeetingRecorder] inserting nodes:', JSON.stringify(nodes).slice(0, 500));
          onInsert(nodes as Record<string, unknown>);
          onClose();
        } catch (err: any) {
          setErrorMsg(err.message || t('meeting.errorProcessing'));
          setState('idle');
        }
      };

      recorder.start(1000); // Collect data every second
      setState('recording');
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(prev => prev + 1), 1000);
    } catch (err: any) {
      cleanup();
      if (err.name === 'NotAllowedError') {
        setErrorMsg(t('meeting.errorPermission'));
      } else {
        setErrorMsg(err.message || t('meeting.errorStart'));
      }
    }
  }, [captureTab, cleanup, onInsert, onClose]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-bg-primary border border-border-primary rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-primary">
          <div className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-accent" />
            <h3 className="font-semibold text-text-primary">{t('meeting.title')}</h3>
          </div>
          {state === 'idle' && (
            <button
              onClick={onClose}
              className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-5 py-6">
          {state === 'idle' && (
            <div className="space-y-5">
              <p className="text-sm text-text-secondary">
                {t('meeting.description')}
              </p>

              {/* Capture tab toggle */}
              <label className="flex items-center gap-3 p-3 rounded-xl bg-bg-secondary border border-border-primary cursor-pointer hover:border-accent/30 transition-colors">
                <input
                  type="checkbox"
                  checked={captureTab}
                  onChange={(e) => setCaptureTab(e.target.checked)}
                  className="h-4 w-4 rounded border-border-primary text-accent focus:ring-accent"
                />
                <Monitor className="h-4 w-4 text-text-muted" />
                <div>
                  <div className="text-sm font-medium text-text-primary">{t('meeting.captureTab')}</div>
                  <div className="text-xs text-text-muted">
                    {t('meeting.captureTabDesc')}
                  </div>
                </div>
              </label>

              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                  {errorMsg}
                </div>
              )}

              <button
                onClick={startRecording}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-accent text-white font-medium hover:bg-accent/90 transition-colors"
              >
                <Mic className="h-4 w-4" />
                {t('meeting.start')}
              </button>
            </div>
          )}

          {state === 'recording' && (
            <div className="flex flex-col items-center space-y-6">
              {/* Pulsating indicator */}
              <div className="relative">
                <div className="h-20 w-20 rounded-full bg-red-500/20 flex items-center justify-center">
                  <div className="h-12 w-12 rounded-full bg-red-500/40 flex items-center justify-center animate-pulse">
                    <div className="h-6 w-6 rounded-full bg-red-500" />
                  </div>
                </div>
              </div>

              <div className="text-center">
                <div className="text-3xl font-mono font-bold text-text-primary tabular-nums">
                  {formatTime(elapsed)}
                </div>
                <div className="text-sm text-red-400 mt-1 flex items-center justify-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  {t('meeting.recording')}
                </div>
              </div>

              <button
                onClick={stopRecording}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-bg-secondary border border-border-primary text-text-primary font-medium hover:bg-bg-hover transition-colors"
              >
                <Square className="h-4 w-4 fill-current" />
                {t('meeting.stop')}
              </button>
            </div>
          )}

          {state === 'processing' && (
            <div className="flex flex-col items-center space-y-5 py-4">
              <Loader2 className="h-10 w-10 text-accent animate-spin" />
              <div className="text-center">
                <div className="font-medium text-text-primary">
                  {processingStep === 'transcribing'
                    ? t('meeting.transcribing')
                    : t('meeting.generating')}
                </div>
                <div className="text-sm text-text-muted mt-1">
                  {processingStep === 'transcribing'
                    ? t('meeting.transcribingDesc')
                    : t('meeting.generatingDesc')}
                </div>
              </div>

              {/* Progress steps */}
              <div className="w-full space-y-2">
                <div className={cn(
                  'flex items-center gap-2 text-sm px-3 py-2 rounded-lg',
                  'bg-accent/10 text-accent',
                )}>
                  {processingStep === 'transcribing'
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <span className="text-green-400">✓</span>}
                  <span>{t('meeting.stepTranscribe')}</span>
                </div>
                <div className={cn(
                  'flex items-center gap-2 text-sm px-3 py-2 rounded-lg',
                  processingStep === 'generating'
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-muted',
                )}>
                  {processingStep === 'generating'
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <span className="h-3.5 w-3.5 flex items-center justify-center text-text-muted">○</span>}
                  <span>{t('meeting.stepGenerate')}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
