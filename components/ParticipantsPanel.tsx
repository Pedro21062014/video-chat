'use client';

import React from 'react';
import { X, Mic, MicOff, Video, VideoOff, Hand, User, UserPlus } from 'lucide-react';
import { Participant } from '@/lib/types';

interface ParticipantsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  participants: Participant[];
  currentUserId: string;
}

export const ParticipantsPanel: React.FC<ParticipantsPanelProps> = ({
  isOpen,
  onClose,
  participants,
  currentUserId,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="participants-panel"
      className="fixed inset-y-0 right-0 z-40 w-full sm:w-80 md:w-96 bg-[#202124] border-l border-[#3c4043] flex flex-col shadow-2xl transition-transform duration-200"
    >
      {/* Google Meet Header */}
      <div className="p-4 border-b border-[#3c4043] flex items-center justify-between">
        <div>
          <h3 className="font-medium text-[#e8eaed] text-base">Pessoas</h3>
          <p className="text-xs text-[#9aa0a6] mt-0.5">{participants.length} na chamada</p>
        </div>
        <button
          id="btn-close-participants"
          onClick={onClose}
          className="p-2 rounded-full hover:bg-[#3c4043] text-[#9aa0a6] hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Participants List */}
      <div className="flex-1 p-3 overflow-y-auto space-y-1">
        {participants.map((p) => {
          const isMe = p.userId === currentUserId;
          return (
            <div
              key={p.userId}
              className="p-2.5 rounded-lg hover:bg-[#28292c] flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0"
                  style={{ backgroundColor: p.avatarColor || '#1a73e8' }}
                >
                  {p.displayName ? p.displayName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-normal text-[#e8eaed] truncate">
                      {p.displayName} {isMe ? '(Você)' : ''}
                    </span>
                    {p.role === 'host' && (
                      <span className="text-[11px] text-[#9aa0a6]">
                        • Organizador da reunião
                      </span>
                    )}
                  </div>
                  {p.isHandRaised && (
                    <span className="text-xs text-[#fbbc04] flex items-center gap-1">
                      <Hand className="w-3 h-3 fill-[#fbbc04]" /> Mão levantada
                    </span>
                  )}
                </div>
              </div>

              {/* Media status indicators */}
              <div className="flex items-center gap-2 shrink-0">
                {p.isAudioMuted ? (
                  <MicOff className="w-4 h-4 text-[#ea4335]" />
                ) : (
                  <Mic className="w-4 h-4 text-[#81c995]" />
                )}
                {p.isVideoMuted ? (
                  <VideoOff className="w-4 h-4 text-[#ea4335]" />
                ) : (
                  <Video className="w-4 h-4 text-[#9aa0a6]" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
