'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Maximize2,
  X,
} from 'lucide-react';
import { sound } from '@/lib/sound';

interface MiniCallWindowProps {
  roomId: string;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  displayName: string;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onLeaveCall: () => void;
  isInRoom: boolean;
  openTrigger?: number;
  localStream: MediaStream | null;
  isSidebarOpen?: boolean;
}

interface MiniCameraFeedProps {
  stream: MediaStream | null;
  isVideoMuted: boolean;
  displayName: string;
}

const MiniCameraFeed: React.FC<MiniCameraFeedProps> = ({
  stream,
  isVideoMuted,
  displayName,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (stream && !isVideoMuted) {
      videoEl.srcObject = stream;
      videoEl.play().catch(() => {});
    } else {
      videoEl.srcObject = null;
    }
  }, [stream, isVideoMuted]);

  const hasVideoTrack =
    !isVideoMuted &&
    stream &&
    stream.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled);

  return (
    <div className="relative w-full h-full bg-[#18191c] flex items-center justify-center overflow-hidden select-none">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-200 ${
          hasVideoTrack ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
        }`}
      />

      {!hasVideoTrack && (
        <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#2b2d31] border border-[#3c4043] flex items-center justify-center text-lg sm:text-xl font-bold text-[#8ab4f8] shadow-inner">
            {displayName.trim().charAt(0).toUpperCase() || 'U'}
          </div>
          <span className="text-[11px] text-[#9aa0a6] font-medium tracking-wide">
            Câmera desativada
          </span>
        </div>
      )}
    </div>
  );
};

export const MiniCallWindow: React.FC<MiniCallWindowProps> = ({
  roomId,
  isAudioMuted,
  isVideoMuted,
  displayName,
  onToggleAudio,
  onToggleVideo,
  onLeaveCall,
  isInRoom,
  openTrigger,
  localStream,
  isSidebarOpen = false,
}) => {
  const [pipContainer, setPipContainer] = useState<HTMLElement | null>(null);
  const [showInAppMini, setShowInAppMini] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  const pipWindowRef = useRef<any>(null);
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    posX: number;
    posY: number;
  }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
  });

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
        width: 340,
        height: 220,
      });

      pipWindowRef.current = pipWindow;

      // Setup document in pipWindow
      pipWindow.document.title = `VideoMeet - ${displayName || roomId}`;
      pipWindow.document.body.style.margin = '0';
      pipWindow.document.body.style.padding = '0';
      pipWindow.document.body.style.backgroundColor = '#18191c';
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
      // In iframes or without permission, show floating in-app mini overlay
      setShowInAppMini(true);
    }
  }, [displayName, roomId]);

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

  // Detect when user leaves tab / changes window
  useEffect(() => {
    if (!isInRoom) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        openDesktopPiP();
        setShowInAppMini(true);
      }
    };

    const handleWindowBlur = () => {
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

  // Pointer drag events for in-app mini window
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;

    const widget = widgetRef.current;
    if (!widget) return;
    const rect = widget.getBoundingClientRect();

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: rect.left,
      posY: rect.top,
    };
    isDraggingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;

    const newX = Math.max(10, Math.min(window.innerWidth - 270, dragStartRef.current.posX + deltaX));
    const newY = Math.max(10, Math.min(window.innerHeight - 190, dragStartRef.current.posY + deltaY));

    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  // If not in room, do not render any mini overlay
  if (!isInRoom) {
    return null;
  }

  // Mini Call UI Content: Only camera + 3 essential action buttons
  const renderMiniContent = (isPiP = false) => (
    <div
      className={`relative w-full h-full overflow-hidden select-none group ${
        isPiP
          ? 'h-screen'
          : 'rounded-2xl border border-[#3c4043] shadow-2xl'
      }`}
      style={{
        backgroundColor: '#18191c',
        boxSizing: 'border-box',
      }}
    >
      {/* 1. The User's Camera Video Feed */}
      <MiniCameraFeed
        stream={localStream}
        isVideoMuted={isVideoMuted}
        displayName={displayName}
      />

      {/* 2. Top Header Overlay: Name tag & Maximize / Close Buttons */}
      <div className="absolute top-0 inset-x-0 p-2.5 flex items-center justify-between pointer-events-none bg-gradient-to-b from-black/60 via-black/20 to-transparent z-10">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-sm border border-white/10 text-white pointer-events-auto shadow-sm">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isAudioMuted ? 'bg-[#ea4335]' : 'bg-[#81c995] animate-pulse'
            }`}
          />
          <span className="text-[11px] font-medium text-white/90 truncate max-w-[100px]">
            {displayName.trim() || 'Você'}
          </span>
        </div>

        <div className="flex items-center gap-1 pointer-events-auto">
          <button
            id="mini-maximize-btn"
            type="button"
            onClick={handleFocusMainWindow}
            title="Voltar para chamada completa"
            className="w-7 h-7 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-sm text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-white/10"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          {!isPiP && (
            <button
              id="mini-close-btn"
              type="button"
              onClick={() => setShowInAppMini(false)}
              title="Fechar mini janela"
              className="w-7 h-7 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-sm text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-white/10"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Bottom Action Controls Bar: Fechar Câmera, Mutar Microfone, Desligar */}
      <div className="absolute bottom-0 inset-x-0 pt-8 pb-3 px-3 flex items-center justify-center gap-3 bg-gradient-to-t from-black/85 via-black/45 to-transparent z-10 pointer-events-auto">
        {/* Botão 1: Fechar / Ligar Câmera */}
        <button
          id="mini-toggle-video-btn"
          type="button"
          onClick={onToggleVideo}
          title={isVideoMuted ? 'Ligar câmera' : 'Fechar câmera'}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg ${
            isVideoMuted
              ? 'bg-[#ea4335] text-white hover:bg-[#d93025]'
              : 'bg-[#3c4043]/85 hover:bg-[#4a4d51] text-white backdrop-blur-sm border border-white/10'
          }`}
        >
          {isVideoMuted ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
        </button>

        {/* Botão 2: Mutar / Ativar Microfone */}
        <button
          id="mini-toggle-audio-btn"
          type="button"
          onClick={() => {
            sound.playToggleMute(!isAudioMuted);
            onToggleAudio();
          }}
          title={isAudioMuted ? 'Ativar microfone' : 'Mutar microfone'}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg ${
            isAudioMuted
              ? 'bg-[#ea4335] text-white hover:bg-[#d93025]'
              : 'bg-[#3c4043]/85 hover:bg-[#4a4d51] text-white backdrop-blur-sm border border-white/10'
          }`}
        >
          {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Botão 3: Desligar Chamada */}
        <button
          id="mini-hangup-btn"
          type="button"
          onClick={() => {
            sound.playHangup();
            closeDesktopPiP();
            setShowInAppMini(false);
            onLeaveCall();
          }}
          title="Desligar chamada"
          className="w-10 h-10 rounded-full bg-[#ea4335] hover:bg-[#d93025] text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
        >
          <PhoneOff className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Real Desktop Picture-in-Picture Portal (Chrome / Chromium on PC) */}
      {pipContainer && createPortal(renderMiniContent(true), pipContainer)}

      {/* 2. In-App Floating Mini Camera Window at Bottom-Right */}
      {showInAppMini && !pipContainer && isInRoom && (
        <div
          ref={widgetRef}
          id="in-app-mini-call-widget"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={`fixed z-50 w-64 sm:w-72 md:w-80 aspect-[16/10] cursor-grab active:cursor-grabbing transition-shadow duration-200 hover:shadow-2xl animate-fadeIn ${
            isSidebarOpen ? 'bottom-24 right-4 md:right-96' : 'bottom-24 right-4 sm:right-6'
          }`}
          style={
            position
              ? {
                  position: 'fixed',
                  left: `${position.x}px`,
                  top: `${position.y}px`,
                  bottom: 'auto',
                  right: 'auto',
                }
              : undefined
          }
        >
          {renderMiniContent(false)}
        </div>
      )}
    </>
  );
};
