'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Hand, Monitor, User, Pin, MoreVertical } from 'lucide-react';
import { Participant } from '@/lib/types';

interface VideoTileProps {
  participant: Participant;
  stream: MediaStream | null;
  isLocal: boolean;
  isSpeaking?: boolean;
}

export const VideoTile: React.FC<VideoTileProps> = ({
  participant,
  stream,
  isLocal,
  isSpeaking,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [, setTrackState] = useState(0);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl && stream) {
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
      videoEl.play().catch(() => {
        // Autoplay policy fallback
      });
    }

    if (!stream) return;

    const handleTrackChange = () => {
      setTrackState((prev) => prev + 1);
      if (videoEl && stream) {
        videoEl.play().catch(() => {});
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
  }, [stream]);

  const videoTracks = stream ? stream.getVideoTracks() : [];
  const activeVideoTrack = videoTracks.find((t) => t.readyState === 'live');
  const hasVideo = !participant.isVideoMuted && Boolean(activeVideoTrack);

  return (
    <div
      id={`video-tile-${participant.userId}`}
      className={`relative w-full h-full rounded-lg overflow-hidden bg-[#3c4043] transition-all duration-200 flex items-center justify-center group select-none shadow-md ${
        isSpeaking ? 'active-speaker' : 'border border-[#3c4043]/60'
      }`}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal} // Always mute local
        className={`w-full h-full object-cover transition-opacity duration-200 ${
          hasVideo ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
        } ${isLocal && !participant.isScreenSharing ? 'scale-x-[-1]' : ''}`}
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
        </div>
      )}

      {/* Top Center Hover Action Buttons (Exact Google Meet tile hover) */}
      <div className="absolute inset-x-0 top-3 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-auto">
        <div className="bg-[#202124]/80 backdrop-blur-md px-2 py-1 rounded-full flex items-center gap-1 border border-[#5f6368]">
          <button
            title="Fixar na tela"
            className="p-1.5 rounded-full hover:bg-[#3c4043] text-white/90 hover:text-white transition-colors cursor-pointer"
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Hand Raised Notification (Meet Top Left) */}
      {participant.isHandRaised && (
        <div className="absolute top-3 left-3 bg-[#fbbc04] text-[#202124] font-medium px-2.5 py-1 rounded-full text-xs flex items-center gap-1.5 shadow-md">
          <Hand className="w-3.5 h-3.5 fill-[#202124]" />
          <span>Mão levantada</span>
        </div>
      )}

      {/* Screen Sharing Tag */}
      {participant.isScreenSharing && (
        <div className="absolute top-3 right-3 bg-[#8ab4f8] text-[#041e49] text-xs font-medium px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-md">
          <Monitor className="w-3.5 h-3.5" />
          <span>Apresentação</span>
        </div>
      )}

      {/* Bottom Left Name Tag & Mic Icon (Exact Google Meet overlay) */}
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
    </div>
  );
};
