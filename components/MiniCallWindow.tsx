'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Copy,
  Check,
  Maximize2,
  Users,
  Radio,
  X,
} from 'lucide-react';

interface MiniCallWindowProps {
  roomId: string;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  participantsCount: number;
  displayName: string;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onLeaveCall: () => void;
  isInRoom: boolean;
  openTrigger?: number;
}

export const MiniCallWindow: React.FC<MiniCallWindowProps> = ({
  roomId,
  isAudioMuted,
  isVideoMuted,
  participantsCount,
  displayName,
  onToggleAudio,
  onToggleVideo,
  onLeaveCall,
  isInRoom,
  openTrigger,
}) => {
  const [pipContainer, setPipContainer] = useState<HTMLElement | null>(null);
  const [showInAppMini, setShowInAppMini] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const pipWindowRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);

  // Track call duration
  useEffect(() => {
    if (!isInRoom) return;
    const start = Date.now();
    startTimeRef.current = start;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isInRoom]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Open Document Picture-in-Picture window (Chromium on PC)
  const openDesktopPiP = useCallback(async () => {
    if (typeof window === 'undefined' || !('documentPictureInPicture' in window)) {
      setShowInAppMini(true);
      return;
    }

    if (pipWindowRef.current) {
      try {
        pipWindowRef.current.focus();
      } catch {
        // ignore
      }
      return;
    }

    try {
      const pipWindow = await (window as any).documentPictureInPicture.requestWindow({
        width: 360,
        height: 220,
      });

      pipWindowRef.current = pipWindow;

      // Setup document in pipWindow
      pipWindow.document.title = `VideoMeet - ${roomId}`;
      pipWindow.document.body.style.margin = '0';
      pipWindow.document.body.style.padding = '0';
      pipWindow.document.body.style.backgroundColor = '#202124';
      pipWindow.document.body.style.color = '#e8eaed';
      pipWindow.document.body.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      pipWindow.document.body.style.overflow = 'hidden';

      // Copy stylesheets
      Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).forEach((sheet) => {
        try {
          pipWindow.document.head.appendChild(sheet.cloneNode(true));
        } catch {
          // ignore
        }
      });

      const container = pipWindow.document.createElement('div');
      container.id = 'pip-root';
      container.style.width = '100%';
      container.style.height = '100%';
      pipWindow.document.body.appendChild(container);

      setPipContainer(container);
      setShowInAppMini(false);

      pipWindow.addEventListener('pagehide', () => {
        pipWindowRef.current = null;
        setPipContainer(null);
      });
    } catch {
      // If browser prevents opening without immediate gesture, show floating mini overlay
      setShowInAppMini(true);
    }
  }, [roomId]);

  const closeDesktopPiP = useCallback(() => {
    if (pipWindowRef.current) {
      try {
        pipWindowRef.current.close();
      } catch {
        // ignore
      }
      pipWindowRef.current = null;
    }
    setPipContainer(null);
  }, []);

  // Return to main window/tab
  const handleFocusMainWindow = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.focus();
    }
    closeDesktopPiP();
    setShowInAppMini(false);
  }, [closeDesktopPiP]);

  // Copy meeting code
  const handleCopyCode = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(roomId).catch(() => {});
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  }, [roomId]);

  // Detect when user leaves tab / changes window
  useEffect(() => {
    if (!isInRoom) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // User switched tab or minimized window!
        openDesktopPiP();
        setShowInAppMini(true);
      }
    };

    const handleWindowBlur = () => {
      // Window lost focus
      if (document.visibilityState === 'hidden') {
        openDesktopPiP();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isInRoom, openDesktopPiP]);

  // Clean up native PiP window if leaving room
  useEffect(() => {
    if (!isInRoom && pipWindowRef.current) {
      try {
        pipWindowRef.current.close();
      } catch {
        // ignore
      }
      pipWindowRef.current = null;
    }
  }, [isInRoom]);

  // Open PiP when user clicks the PiP button on ControlsBar
  useEffect(() => {
    if (openTrigger && openTrigger > 0) {
      const timer = setTimeout(() => {
        openDesktopPiP();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [openTrigger, openDesktopPiP]);

  // If not in room, do not render any mini overlay
  if (!isInRoom) {
    return null;
  }

  // Mini Card UI Content (shared between Desktop PiP and in-page Mini overlay)
  const renderMiniContent = (isPiP = false) => (
    <div
      className={`w-full h-full flex flex-col justify-between p-4 bg-[#202124] text-[#e8eaed] ${
        isPiP ? 'h-screen' : 'rounded-2xl border border-[#5f6368]/40 shadow-2xl backdrop-blur-md'
      }`}
      style={{
        backgroundColor: '#202124',
        color: '#e8eaed',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Header: Status & Room Code */}
      <div className="flex items-center justify-between pb-2 border-b border-[#3c4043]">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#81c995]"></span>
          </span>
          <span className="text-xs font-semibold text-[#81c995] uppercase tracking-wider flex items-center gap-1">
            <Radio className="w-3 h-3 text-[#81c995]" />
            Ao vivo
          </span>
          <span className="text-xs text-[#9aa0a6]">|</span>
          <span className="text-xs font-mono font-medium text-[#e8eaed]">{roomId}</span>
          <button
            id="mini-copy-code-btn"
            onClick={handleCopyCode}
            title="Copiar código da sala"
            className="p-1 rounded hover:bg-[#3c4043] text-[#9aa0a6] hover:text-[#e8eaed] cursor-pointer"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-[#81c995]" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            id="mini-focus-main-btn"
            onClick={handleFocusMainWindow}
            title="Voltar para a chamada completa"
            className="p-1.5 rounded-lg bg-[#303134] hover:bg-[#3c4043] text-[#8ab4f8] hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-xs"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Voltar</span>
          </button>
          {!isPiP && (
            <button
              id="mini-close-btn"
              onClick={() => setShowInAppMini(false)}
              title="Fechar mini janela"
              className="p-1.5 rounded-lg text-[#9aa0a6] hover:bg-[#3c4043] hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Middle Details: Call Stats */}
      <div className="py-3 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[11px] uppercase tracking-wider text-[#9aa0a6]">Duração</span>
          <span className="text-xl font-bold font-mono text-[#e8eaed]">{formatDuration(elapsedSeconds)}</span>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-[11px] uppercase tracking-wider text-[#9aa0a6]">Participantes</span>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-[#e8eaed]">
            <Users className="w-4 h-4 text-[#8ab4f8]" />
            <span>{participantsCount}</span>
          </div>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-[11px] uppercase tracking-wider text-[#9aa0a6]">Você</span>
          <span className="text-xs font-medium text-[#e8eaed] truncate max-w-[100px]">{displayName}</span>
        </div>
      </div>

      {/* Bottom Quick Controls */}
      <div className="flex items-center justify-between pt-2 border-t border-[#3c4043]/60">
        <div className="flex items-center gap-2">
          {/* Audio toggle */}
          <button
            id="mini-audio-toggle"
            onClick={onToggleAudio}
            title={isAudioMuted ? 'Ativar microfone' : 'Silenciar microfone'}
            className={`p-2 rounded-full cursor-pointer transition-colors ${
              isAudioMuted ? 'bg-[#ea4335] text-white hover:bg-[#d93025]' : 'bg-[#3c4043] text-white hover:bg-[#4a4d51]'
            }`}
          >
            {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Video toggle */}
          <button
            id="mini-video-toggle"
            onClick={onToggleVideo}
            title={isVideoMuted ? 'Ligar câmera' : 'Desligar câmera'}
            className={`p-2 rounded-full cursor-pointer transition-colors ${
              isVideoMuted ? 'bg-[#ea4335] text-white hover:bg-[#d93025]' : 'bg-[#3c4043] text-white hover:bg-[#4a4d51]'
            }`}
          >
            {isVideoMuted ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </button>
        </div>

        {/* Hangup */}
        <button
          id="mini-hangup-btn"
          onClick={() => {
            closeDesktopPiP();
            setShowInAppMini(false);
            onLeaveCall();
          }}
          title="Sair da reunião"
          className="px-3 py-1.5 rounded-full bg-[#ea4335] hover:bg-[#d93025] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow transition-colors"
        >
          <PhoneOff className="w-3.5 h-3.5" />
          <span>Sair</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Real Desktop Picture-in-Picture Portal (Chrome / Chromium on PC) */}
      {pipContainer && createPortal(renderMiniContent(true), pipContainer)}

      {/* 2. In-App Floating Mini Window at Bottom-Right (fallback / dock) */}
      {showInAppMini && !pipContainer && isInRoom && (
        <div
          id="in-app-mini-call-widget"
          className="fixed bottom-20 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          {renderMiniContent(false)}
        </div>
      )}
    </>
  );
};
