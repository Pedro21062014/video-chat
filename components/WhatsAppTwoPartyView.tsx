'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Participant, VideoQualityId } from '@/lib/types';
import { MicOff, ArrowLeftRight, MonitorUp } from 'lucide-react';

interface WhatsAppTwoPartyViewProps {
  localParticipant?: Participant | null;
  remoteParticipant?: Participant | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  currentQuality?: VideoQualityId;
  onOpenSettings?: () => void;
  onToggleVideo?: () => void;
}

type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const DEFAULT_FALLBACK_PARTICIPANT: Participant = {
  userId: 'unknown',
  displayName: 'Participante',
  isAudioMuted: false,
  isVideoMuted: false,
  isScreenSharing: false,
  isHandRaised: false,
  joinedAt: 0,
  lastSeen: 0,
  role: 'guest',
  avatarColor: '#3b82f6',
};

export const WhatsAppTwoPartyView: React.FC<WhatsAppTwoPartyViewProps> = ({
  localParticipant,
  remoteParticipant,
  localStream,
  remoteStream,
  currentQuality,
}) => {
  // isSwapped: false -> Main is Remote, PIP is Local (WhatsApp default)
  // isSwapped: true  -> Main is Local, PIP is Remote
  const [isSwapped, setIsSwapped] = useState(false);

  // Container ref and size
  const containerRef = useRef<HTMLDivElement>(null);
  const pipRef = useRef<HTMLDivElement>(null);

  // Corner snapping and custom drag position
  const [corner, setCorner] = useState<Corner>('bottom-right');
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Drag tracking refs
  const dragStartRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    initialPosX: number;
    initialPosY: number;
    distanceMoved: number;
  } | null>(null);

  // Main and PIP video elements
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const pipVideoRef = useRef<HTMLVideoElement>(null);

  // Defensive participant resolution (guarantees non-null objects)
  const resolvedLocal = localParticipant || DEFAULT_FALLBACK_PARTICIPANT;
  const resolvedRemote = remoteParticipant || DEFAULT_FALLBACK_PARTICIPANT;

  const mainParticipant = isSwapped ? resolvedLocal : resolvedRemote;
  const pipParticipant = isSwapped ? resolvedRemote : resolvedLocal;

  const mainStream = isSwapped ? localStream : remoteStream;
  const pipStream = isSwapped ? remoteStream : localStream;

  const isMainLocal = isSwapped;
  const isPipLocal = !isSwapped;

  // Track video streams state safely
  const mainVideoTracks = mainStream ? mainStream.getVideoTracks() : [];
  const hasLiveMainTrack = mainVideoTracks.some((t) => t && t.readyState !== 'ended');
  const hasMainVideo = isMainLocal
    ? Boolean(hasLiveMainTrack) && !mainParticipant.isVideoMuted
    : Boolean(hasLiveMainTrack) && (!mainParticipant.isVideoMuted || mainVideoTracks.some((t) => t.enabled));

  const pipVideoTracks = pipStream ? pipStream.getVideoTracks() : [];
  const hasLivePipTrack = pipVideoTracks.some((t) => t && t.readyState !== 'ended');
  const hasPipVideo = isPipLocal
    ? Boolean(hasLivePipTrack) && !pipParticipant.isVideoMuted
    : Boolean(hasLivePipTrack) && (!pipParticipant.isVideoMuted || pipVideoTracks.some((t) => t.enabled));

  // Bind main video stream safely
  useEffect(() => {
    try {
      const videoEl = mainVideoRef.current;
      if (videoEl && mainStream) {
        if (videoEl.srcObject !== mainStream) {
          videoEl.srcObject = mainStream;
        }
        const playPromise = videoEl.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('Autoplay unmuted blocked on main video:', err);
            // If blocked on mobile because unmuted, mute temporarily so video displays immediately!
            if (!isMainLocal) {
              videoEl.muted = true;
              videoEl.play().catch(() => {});
            }
          });
        }
      }
    } catch {
      // ignore
    }
  }, [mainStream, isSwapped, isMainLocal]);

  // Auto unmute main remote video when user taps screen on mobile
  useEffect(() => {
    if (isMainLocal) return;
    const handleUserInteraction = () => {
      const videoEl = mainVideoRef.current;
      if (videoEl && videoEl.muted) {
        videoEl.muted = false;
        videoEl.play().catch(() => {});
      }
    };
    window.addEventListener('touchstart', handleUserInteraction, { passive: true });
    window.addEventListener('click', handleUserInteraction);
    return () => {
      window.removeEventListener('touchstart', handleUserInteraction);
      window.removeEventListener('click', handleUserInteraction);
    };
  }, [isMainLocal]);

  // Bind PIP video stream safely
  useEffect(() => {
    try {
      const videoEl = pipVideoRef.current;
      if (videoEl && pipStream) {
        if (videoEl.srcObject !== pipStream) {
          videoEl.srcObject = pipStream;
        }
        const playPromise = videoEl.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('Autoplay blocked on pip video:', err);
            if (!isPipLocal) {
              videoEl.muted = true;
              videoEl.play().catch(() => {});
            }
          });
        }
      }
    } catch {
      // ignore
    }
  }, [pipStream, isSwapped, isPipLocal]);

  // Compute corner positions safely
  const getCornerPosition = useCallback(
    (targetCorner: Corner, containerW: number, containerH: number, pipW: number, pipH: number) => {
      const padX = 16;
      const padY = 16;
      const safeW = Math.max(containerW, 200);
      const safeH = Math.max(containerH, 200);
      const safePipW = Math.max(pipW, 80);
      const safePipH = Math.max(pipH, 100);

      switch (targetCorner) {
        case 'top-left':
          return { x: padX, y: padY };
        case 'top-right':
          return { x: Math.max(padX, safeW - safePipW - padX), y: padY };
        case 'bottom-left':
          return { x: padX, y: Math.max(padY, safeH - safePipH - padY) };
        case 'bottom-right':
        default:
          return {
            x: Math.max(padX, safeW - safePipW - padX),
            y: Math.max(padY, safeH - safePipH - padY),
          };
      }
    },
    []
  );

  // Recalculate position on container resize or corner change
  const updatePipPosition = useCallback(() => {
    if (isDragging) return;
    try {
      const container = containerRef.current;
      const pip = pipRef.current;
      if (!container || !pip) return;

      const cRect = container.getBoundingClientRect();
      const pRect = pip.getBoundingClientRect();
      const pipW = pRect.width || 120;
      const pipH = pRect.height || 160;

      const pos = getCornerPosition(corner, cRect.width, cRect.height, pipW, pipH);
      setPosition(pos);
    } catch {
      // ignore
    }
  }, [corner, isDragging, getCornerPosition]);

  useEffect(() => {
    updatePipPosition();
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    try {
      const observer = new ResizeObserver(() => {
        updatePipPosition();
      });
      observer.observe(container);
      return () => observer.disconnect();
    } catch {
      // ignore
    }
  }, [updatePipPosition]);

  // Pointer drag events for PIP tile
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const target = e.currentTarget;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      // ignore pointer capture if not allowed
    }

    try {
      const rect = target.getBoundingClientRect();
      const container = containerRef.current?.getBoundingClientRect();
      if (!container) return;

      const currentX = position ? position.x : rect.left - container.left;
      const currentY = position ? position.y : rect.top - container.top;

      dragStartRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        initialPosX: currentX,
        initialPosY: currentY,
        distanceMoved: 0,
      };
      setIsDragging(true);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current || dragStartRef.current.pointerId !== e.pointerId) return;

    try {
      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;
      dragStartRef.current.distanceMoved = Math.sqrt(dx * dx + dy * dy);

      const container = containerRef.current;
      const pip = pipRef.current;
      if (!container || !pip) return;

      const cRect = container.getBoundingClientRect();
      const pRect = pip.getBoundingClientRect();

      const minX = 8;
      const maxX = Math.max(8, cRect.width - pRect.width - 8);
      const minY = 8;
      const maxY = Math.max(8, cRect.height - pRect.height - 8);

      const nextX = Math.min(maxX, Math.max(minX, dragStartRef.current.initialPosX + dx));
      const nextY = Math.min(maxY, Math.max(minY, dragStartRef.current.initialPosY + dy));

      setPosition({ x: nextX, y: nextY });
    } catch {
      // ignore
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current || dragStartRef.current.pointerId !== e.pointerId) return;

    const target = e.currentTarget;
    try {
      target.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const distance = dragStartRef.current.distanceMoved;
    dragStartRef.current = null;
    setIsDragging(false);

    // If tap/click with minimal movement, SWAP the cameras!
    if (distance <= 8) {
      setIsSwapped((prev) => !prev);
      return;
    }

    // Otherwise snap to the closest of the 4 corners
    try {
      const container = containerRef.current;
      const pip = pipRef.current;
      if (!container || !pip) return;

      const cRect = container.getBoundingClientRect();
      const pRect = pip.getBoundingClientRect();
      const currentX = position?.x ?? 0;
      const currentY = position?.y ?? 0;

      const corners: { corner: Corner; x: number; y: number }[] = [
        { corner: 'top-left', ...getCornerPosition('top-left', cRect.width, cRect.height, pRect.width, pRect.height) },
        { corner: 'top-right', ...getCornerPosition('top-right', cRect.width, cRect.height, pRect.width, pRect.height) },
        { corner: 'bottom-left', ...getCornerPosition('bottom-left', cRect.width, cRect.height, pRect.width, pRect.height) },
        { corner: 'bottom-right', ...getCornerPosition('bottom-right', cRect.width, cRect.height, pRect.width, pRect.height) },
      ];

      let closestCorner: Corner = 'bottom-right';
      let minDistance = Infinity;

      for (const c of corners) {
        const d = Math.hypot(c.x - currentX, c.y - currentY);
        if (d < minDistance) {
          minDistance = d;
          closestCorner = c.corner;
        }
      }

      setCorner(closestCorner);
      const snapPos = getCornerPosition(closestCorner, cRect.width, cRect.height, pRect.width, pRect.height);
      setPosition(snapPos);
    } catch {
      // ignore
    }
  };

  return (
    <div
      ref={containerRef}
      id="whatsapp-two-party-container"
      className="relative w-full h-full flex-1 overflow-hidden bg-[#111b21] md:bg-[#202124] select-none"
    >
      {/* 1. MAIN FULLSCREEN VIDEO (Remote participant by default, or Local if swapped) */}
      <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden bg-[#111b21]">
        <video
          ref={mainVideoRef}
          autoPlay
          playsInline
          muted={isMainLocal} // Mute local audio feedback
          onCanPlay={(e) => {
            const vid = e.currentTarget;
            vid.play().catch(() => {
              if (!isMainLocal) {
                vid.muted = true;
                vid.play().catch(() => {});
              }
            });
          }}
          style={{
            transform: isMainLocal && !mainParticipant.isScreenSharing ? 'scaleX(-1) translateZ(0)' : 'translateZ(0)',
            willChange: 'transform',
            ...(isMainLocal && (currentQuality === '144p' || currentQuality === '240p')
              ? { imageRendering: 'pixelated' }
              : {}),
          }}
          className={`w-full h-full ${
            mainParticipant.isScreenSharing ? 'object-contain bg-black' : 'object-cover'
          } transition-opacity duration-200 ${
            hasMainVideo ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
          }`}
        />

        {/* Inactive Video State for Main Participant */}
        {!hasMainVideo && (
          <div className="flex flex-col items-center justify-center gap-4 select-none animate-fadeIn">
            <div
              className="w-24 h-24 sm:w-32 sm:h-32 rounded-full flex items-center justify-center text-white text-3xl sm:text-4xl font-semibold shadow-2xl border-2 border-white/10"
              style={{ backgroundColor: mainParticipant.avatarColor || '#3b82f6' }}
            >
              {(mainParticipant.displayName || 'P').charAt(0).toUpperCase()}
            </div>
            <div className="text-center">
              <span className="text-base sm:text-lg font-medium text-white block">
                {mainParticipant.displayName || 'Participante'}
              </span>
              <span className="text-xs sm:text-sm text-[#9aa0a6] mt-0.5 block">
                Câmera desligada
              </span>
            </div>
          </div>
        )}

        {/* Overlay Badges for Main Participant */}
        <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10 flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-md">
          <span className="text-xs sm:text-sm font-medium text-white truncate max-w-[140px] sm:max-w-[200px]">
            {mainParticipant.displayName || 'Participante'} {isMainLocal && '(Você)'}
          </span>
          {mainParticipant.isScreenSharing && (
            <span className="bg-[#8ab4f8] text-[#041e49] text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
              <MonitorUp className="w-2.5 h-2.5" />
              <span>Apresentando</span>
            </span>
          )}
          {mainParticipant.isAudioMuted && (
            <MicOff className="w-3.5 h-3.5 text-[#ea4335]" />
          )}
        </div>
      </div>

      {/* 2. FLOATING PIP TILE (WhatsApp style draggable corner thumbnail with tap-to-swap) */}
      <div
        ref={pipRef}
        id="whatsapp-pip-thumbnail"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        title="Arraste para mudar de canto ou toque para alternar"
        style={{
          transform: position ? `translate3d(${position.x}px, ${position.y}px, 0)` : undefined,
          touchAction: 'none',
        }}
        className={`absolute ${
          !position ? 'right-3 bottom-16 sm:right-5 sm:bottom-20' : 'top-0 left-0'
        } z-30 w-24 sm:w-32 md:w-40 aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl border-2 border-white/30 bg-[#202124] cursor-grab active:cursor-grabbing select-none ${
          isDragging ? 'scale-105 shadow-2xl border-white/60 opacity-95 duration-0' : 'transition-all duration-300'
        }`}
      >
        {/* PIP Video Stream */}
        <video
          ref={pipVideoRef}
          autoPlay
          playsInline
          muted={isPipLocal}
          onCanPlay={(e) => {
            const vid = e.currentTarget;
            vid.play().catch(() => {
              if (!isPipLocal) {
                vid.muted = true;
                vid.play().catch(() => {});
              }
            });
          }}
          style={{
            transform: isPipLocal && !pipParticipant.isScreenSharing ? 'scaleX(-1) translateZ(0)' : 'translateZ(0)',
            willChange: 'transform',
          }}
          className={`w-full h-full ${
            pipParticipant.isScreenSharing ? 'object-contain bg-black' : 'object-cover'
          } pointer-events-none transition-opacity duration-200 ${
            hasPipVideo ? 'opacity-100' : 'opacity-0 absolute'
          }`}
        />

        {/* PIP Inactive Video Fallback */}
        {!hasPipVideo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-2 bg-[#28292c]">
            <div
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-white text-base sm:text-lg font-semibold shadow-md"
              style={{ backgroundColor: pipParticipant.avatarColor || '#3b82f6' }}
            >
              {(pipParticipant.displayName || 'P').charAt(0).toUpperCase()}
            </div>
            <span className="text-[11px] text-[#9aa0a6] mt-1.5 font-medium truncate max-w-full px-1">
              Câmera off
            </span>
          </div>
        )}

        {/* PIP Tap to Swap Indicator Icon */}
        <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-sm p-1 rounded-full text-white/90 shadow pointer-events-none">
          <ArrowLeftRight className="w-3 h-3" />
        </div>

        {/* PIP Bottom Name Tag */}
        <div className="absolute bottom-1.5 inset-x-1.5 flex items-center justify-between bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md text-[10px] sm:text-xs text-white pointer-events-none border border-white/10">
          <div className="flex items-center gap-1 min-w-0">
            <span className="truncate font-medium">
              {isPipLocal ? 'Você' : pipParticipant.displayName || 'Participante'}
            </span>
            {pipParticipant.isScreenSharing && (
              <span className="bg-[#8ab4f8] text-[#041e49] text-[9px] font-bold px-1 rounded shrink-0">
                Tela
              </span>
            )}
          </div>
          {pipParticipant.isAudioMuted && (
            <MicOff className="w-2.5 h-2.5 text-[#ea4335] shrink-0 ml-1" />
          )}
        </div>
      </div>
    </div>
  );
};

