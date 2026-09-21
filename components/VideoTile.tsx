'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Hand,
  ScreenShare,
  User,
  Pin,
  Sliders,
  Video,
  VideoOff,
  MoreVertical,
} from 'lucide-react';
import { Participant, VideoQualityId } from '@/lib/types';

interface VideoTileProps {
  participant: Participant;
  stream: MediaStream | null;
  isLocal: boolean;
  isSpeaking?: boolean;
  onOpenSettings?: () => void;
  onToggleVideo?: () => void;
  currentQuality?: VideoQualityId;
  className?: string;
}

export const VideoTile: React.FC<VideoTileProps> = ({
  participant,
  stream,
  isLocal,
  isSpeaking,
  onOpenSettings,
  onToggleVideo,
  currentQuality,
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [, setTrackState] = useState(0);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Close context menu on outside click or scroll or escape
  useEffect(() => {
    if (!contextMenuPos) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenuPos(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenuPos(null);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenuPos]);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl && stream) {
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
      videoEl.play().catch(() => {
        // Autoplay policy fallback: on mobile, if unmuted play fails, mute temporarily so video displays
        if (!isLocal) {
          videoEl.muted = true;
          videoEl.play().catch(() => {});
        }
      });
    }

    if (!stream) return;

    const handleTrackChange = () => {
      setTrackState((prev) => prev + 1);
      if (videoEl && stream) {
        videoEl.play().catch(() => {
          if (!isLocal) {
            videoEl.muted = true;
            videoEl.play().catch(() => {});
          }
        });
      }
    };

    stream.addEventListener('addtrack', handleTrackChange);
    stream.addEventListener('removetrack', handleTrackChange);
    stream.getVideoTracks().forEach((track) => {
      track.addEventListener('unmute', handleTrackChange);
      track.addEventListener('mute', handleTrackChange);
    });

    return () => {
      stream.removeEventListener('addtrack', handleTrackChange);
      stream.removeEventListener('removetrack', handleTrackChange);
      stream.getVideoTracks().forEach((track) => {
        track.removeEventListener('unmute', handleTrackChange);
        track.removeEventListener('mute', handleTrackChange);
      });
    };
  }, [stream, isLocal]);

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!isLocal) return;
    e.preventDefault();
    e.stopPropagation();

    // Prevent menu going offscreen
    const menuWidth = 190;
    const menuHeight = 105;
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }

    setContextMenuPos({ x: Math.max(10, x), y: Math.max(10, y) });
  };

  // Touch device long press support for mobile right-click experience
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isLocal) return;
    const touch = e.touches[0];
    const clientX = touch.clientX;
    const clientY = touch.clientY;

    touchTimerRef.current = setTimeout(() => {
      let x = clientX;
      let y = clientY;
      const menuWidth = 190;
      const menuHeight = 105;
      if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
      if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;
      setContextMenuPos({ x: Math.max(10, x), y: Math.max(10, y) });
    }, 600);
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  // Auto unmute remote video when user taps screen on mobile
  useEffect(() => {
    if (isLocal) return;
    const handleTouch = () => {
      const videoEl = videoRef.current;
      if (videoEl && videoEl.muted) {
        videoEl.muted = false;
        videoEl.play().catch(() => {});
      }
    };
    window.addEventListener('touchstart', handleTouch, { passive: true });
    window.addEventListener('click', handleTouch);
    return () => {
      window.removeEventListener('touchstart', handleTouch);
      window.removeEventListener('click', handleTouch);
    };
  }, [isLocal]);

  const videoTracks = stream ? stream.getVideoTracks() : [];
  const activeVideoTrack = videoTracks.find((t) => t.readyState !== 'ended');
  const hasVideo = isLocal
    ? !participant.isVideoMuted && Boolean(activeVideoTrack)
    : Boolean(activeVideoTrack) && (!participant.isVideoMuted || Boolean(activeVideoTrack?.enabled));

  return (
    <div
      ref={containerRef}
      id={`video-tile-${participant.userId}`}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`relative w-full h-full rounded-lg sm:rounded-xl overflow-hidden bg-[#3c4043] transition-all duration-200 flex items-center justify-center group select-none shadow-md ${
        isSpeaking ? 'active-speaker' : 'border border-[#3c4043]/60'
      } ${isLocal ? 'cursor-context-menu' : ''} ${className}`}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal} // Always mute local
        onCanPlay={(e) => {
          const vid = e.currentTarget;
          vid.play().catch(() => {
            if (!isLocal) {
              vid.muted = true;
              vid.play().catch(() => {});
            }
          });
        }}
        style={{
          transform: isLocal && !participant.isScreenSharing ? 'scaleX(-1) translateZ(0)' : 'translateZ(0)',
          willChange: 'transform',
          ...(isLocal && (currentQuality === '144p' || currentQuality === '240p')
            ? { imageRendering: 'pixelated' }
            : {}),
        }}
        className={`w-full h-full ${
          participant.isScreenSharing ? 'object-contain bg-black' : 'object-cover'
        } transition-opacity duration-200 ${
          hasVideo ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
        }`}
      />

      {/* Meet Style Inactive Video State */}
      {!hasVideo && (
        <div className="flex flex-col items-center justify-center gap-3 select-none">
          <div
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center text-white text-2xl sm:text-4xl font-normal shadow-lg"
            style={{ backgroundColor: participant.avatarColor || '#1a73e8' }}
          >
            {participant.displayName ? (
              participant.displayName.charAt(0).toUpperCase()
            ) : (
              <User className="w-10 h-10 text-white" />
            )}
          </div>
          {isLocal && (
            <span className="text-xs text-[#9aa0a6] bg-[#202124]/70 px-2 py-0.5 rounded-full">
              Clique com botão direito para opções
            </span>
          )}
        </div>
      )}

      {/* Top Center Hover Action Buttons */}
      <div className="absolute inset-x-0 top-3 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-auto">
        <div className="bg-[#202124]/80 backdrop-blur-md px-2 py-1 rounded-full flex items-center gap-1 border border-[#5f6368]">
          <button
            title="Fixar na tela"
            className="p-1.5 rounded-full hover:bg-[#3c4043] text-white/90 hover:text-white transition-colors cursor-pointer"
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
          {isLocal && onOpenSettings && (
            <button
              id="btn-tile-camera-settings"
              onClick={onOpenSettings}
              title="Configurações da câmera"
              className="p-1.5 rounded-full hover:bg-[#3c4043] text-white/90 hover:text-[#8ab4f8] transition-colors cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Hand Raised Notification (Meet Top Left) */}
      {participant.isHandRaised && (
        <div className="absolute top-3 left-3 bg-[#fbbc04] text-[#202124] font-medium px-2.5 py-1 rounded-full text-xs flex items-center gap-1.5 shadow-md z-10">
          <Hand className="w-3.5 h-3.5 fill-[#202124]" />
          <span>Mão levantada</span>
        </div>
      )}

      {/* Screen Sharing Tag */}
      {participant.isScreenSharing && (
        <div className="absolute top-3 right-3 bg-[#8ab4f8] text-[#041e49] text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-md z-10">
          <ScreenShare className="w-3.5 h-3.5" />
          <span>Apresentando</span>
        </div>
      )}

      {/* Local Video Quality Badge (Top Right when not presenting) */}
      {isLocal && !participant.isScreenSharing && currentQuality && (
        <button
          onClick={onOpenSettings}
          title="Clique para alterar qualidade de vídeo"
          className="absolute top-3 right-3 bg-[#202124]/80 hover:bg-[#28292c] backdrop-blur-sm border border-[#3c4043] text-[11px] font-mono text-[#8ab4f8] px-2 py-0.5 rounded-md flex items-center gap-1 shadow z-10 transition-colors cursor-pointer"
        >
          <span>{currentQuality.toUpperCase()}</span>
        </button>
      )}

      {/* Bottom Left Name Tag & Mic Icon */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 z-10 pointer-events-none">
        <div className="bg-[#202124]/75 backdrop-blur-sm px-2.5 py-1 rounded-md text-xs font-normal text-white flex items-center gap-2 shadow">
          <span className="truncate max-w-[180px]">
            {participant.displayName} {isLocal ? '(Você)' : ''}
          </span>
          {participant.isAudioMuted ? (
            <div className="w-4 h-4 rounded-full bg-[#ea4335] flex items-center justify-center shrink-0">
              <MicOff className="w-2.5 h-2.5 text-white" />
            </div>
          ) : (
            <div className="w-4 h-4 rounded-full bg-[#81c995]/20 flex items-center justify-center shrink-0">
              <Mic className="w-2.5 h-2.5 text-[#81c995]" />
            </div>
          )}
        </div>
      </div>

      {/* Right-click Context Menu for Local Camera Tile */}
      {isLocal && contextMenuPos && (
        <div
          ref={menuRef}
          id="camera-context-menu"
          style={{
            position: 'fixed',
            left: `${contextMenuPos.x}px`,
            top: `${contextMenuPos.y}px`,
          }}
          className="z-50 w-48 bg-[#28292c] border border-[#3c4043] py-1.5 rounded-xl shadow-2xl flex flex-col text-sm text-[#e8eaed] animate-fadeIn select-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Option 1: Configurações */}
          <button
            id="btn-context-settings"
            type="button"
            onClick={() => {
              setContextMenuPos(null);
              onOpenSettings?.();
            }}
            className="px-3.5 py-2 hover:bg-[#3c4043] flex items-center gap-2.5 text-left w-full cursor-pointer transition-colors text-[#e8eaed]"
          >
            <Sliders className="w-4 h-4 text-[#8ab4f8]" />
            <span className="font-medium text-xs sm:text-sm">Configurações</span>
          </button>

          {/* Option 2: Desligar câmera / Ligar câmera */}
          <button
            id="btn-context-toggle-camera"
            type="button"
            onClick={() => {
              setContextMenuPos(null);
              onToggleVideo?.();
            }}
            className="px-3.5 py-2 hover:bg-[#3c4043] flex items-center gap-2.5 text-left w-full cursor-pointer transition-colors text-[#e8eaed]"
          >
            {participant.isVideoMuted ? (
              <>
                <Video className="w-4 h-4 text-[#81c995]" />
                <span className="font-medium text-xs sm:text-sm">Ligar câmera</span>
              </>
            ) : (
              <>
                <VideoOff className="w-4 h-4 text-[#ea4335]" />
                <span className="font-medium text-xs sm:text-sm text-[#f28b82]">Desligar câmera</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

