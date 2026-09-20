'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  SwitchCamera,
  Share2,
  PhoneOff,
  Smile,
  Hand,
  MessageSquare,
  Users,
  Copy,
  Check,
  MoreVertical,
  Info,
  LogOut,
  ChevronUp,
  PictureInPicture2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { sound } from '@/lib/sound';

interface ControlsBarProps {
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  unreadChatCount: number;
  participantsCount: number;
  availableCameras: MediaDeviceInfo[];
  activeCameraId?: string;
  isChatOpen: boolean;
  isParticipantsOpen: boolean;
  currentTime: string;
  isHost?: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleHandRaise: () => void;
  onSwitchCamera: () => void;
  onSendReaction: (emoji: string) => void;
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onLeaveCall: () => void;
  onEndCallForEveryone?: () => void;
  onOpenPiP?: () => void;
  roomId: string;
}

const EMOJI_REACTIONS = ['❤️', '👍', '🎉', '👏', '😂', '😮', '😢', '🔥'];

export const ControlsBar: React.FC<ControlsBarProps> = ({
  isAudioMuted,
  isVideoMuted,
  isScreenSharing,
  isHandRaised,
  unreadChatCount,
  participantsCount,
  availableCameras,
  isChatOpen,
  isParticipantsOpen,
  currentTime,
  isHost,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleHandRaise,
  onSwitchCamera,
  onSendReaction,
  onToggleChat,
  onToggleParticipants,
  onLeaveCall,
  onEndCallForEveryone,
  onOpenPiP,
  roomId,
}) => {
  const [showReactionsMenu, setShowReactionsMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showAdminHangupMenu, setShowAdminHangupMenu] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const reactionsRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const adminMenuHoverTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleAdminHoverEnter = () => {
    if (!isHost) return;
    if (adminMenuHoverTimeout.current) clearTimeout(adminMenuHoverTimeout.current);
    setShowAdminHangupMenu(true);
  };

  const handleAdminHoverLeave = () => {
    if (!isHost) return;
    adminMenuHoverTimeout.current = setTimeout(() => {
      setShowAdminHangupMenu(false);
    }, 280);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (reactionsRef.current && !reactionsRef.current.contains(event.target as Node)) {
        setShowReactionsMenu(false);
      }
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}?room=${roomId}`;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleSelectReaction = (emoji: string) => {
    onSendReaction(emoji);
    setShowReactionsMenu(false);

    if (emoji === '🎉' || emoji === '🔥') {
      confetti({
        particleCount: 35,
        spread: 50,
        origin: { y: 0.85 },
      });
    }
  };

  return (
    <div
      id="meet-controls-bar"
      className="w-full h-20 min-h-[80px] px-2 sm:px-6 flex items-center justify-between select-none z-30 bg-[#202124] border-t border-[#3c4043]/70 shrink-0 shadow-xl"
    >
      {/* Left Section: Time | Room Code Info */}
      <div className="hidden md:flex items-center gap-3 text-sm text-[#e8eaed] shrink-0">
        <span className="font-normal text-[15px]">{currentTime}</span>
        <span className="text-[#9aa0a6]">|</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm tracking-wide text-[#e8eaed] truncate max-w-[130px]">{roomId}</span>
          <button
            id="btn-bottom-copy-room-link"
            onClick={handleCopyLink}
            title="Copiar código ou link da reunião"
            className="p-1.5 rounded-full hover:bg-[#3c4043] text-[#9aa0a6] hover:text-white transition-colors cursor-pointer"
          >
            {copiedLink ? <Check className="w-4 h-4 text-[#81c995]" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Center Section: Call Action Buttons Bar */}
      <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 mx-auto md:mx-0 shrink-0">
        {/* Audio Mute Button */}
        <button
          id="btn-toggle-audio"
          onClick={() => {
            sound.playToggleMute(!isAudioMuted);
            onToggleAudio();
          }}
          title={isAudioMuted ? 'Ativar microfone' : 'Desativar microfone'}
          className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer ${
            isAudioMuted
              ? 'bg-[#ea4335] text-white hover:bg-[#d93025]'
              : 'bg-[#3c4043] text-white hover:bg-[#474a4d]'
          }`}
        >
          {isAudioMuted ? <MicOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5" />}
        </button>

        {/* Video Mute Button */}
        <button
          id="btn-toggle-video"
          onClick={onToggleVideo}
          title={isVideoMuted ? 'Ligar câmera' : 'Desligar câmera'}
          className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer ${
            isVideoMuted
              ? 'bg-[#ea4335] text-white hover:bg-[#d93025]'
              : 'bg-[#3c4043] text-white hover:bg-[#474a4d]'
          }`}
        >
          {isVideoMuted ? <VideoOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Video className="w-4 h-4 sm:w-5 sm:h-5" />}
        </button>

        {/* Screen Share Button */}
        <button
          id="btn-toggle-screen-share"
          onClick={onToggleScreenShare}
          title={isScreenSharing ? 'Parar de apresentar' : 'Apresentar agora'}
          className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer ${
            isScreenSharing
              ? 'bg-[#a8c7fa] text-[#041e49] hover:bg-[#8ab4f8]'
              : 'bg-[#3c4043] text-white hover:bg-[#474a4d]'
          }`}
        >
          <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Reactions Picker */}
        <div className="relative shrink-0" ref={reactionsRef}>
          <button
            id="btn-open-reactions"
            onClick={() => setShowReactionsMenu(!showReactionsMenu)}
            title="Enviar uma reação"
            className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer ${
              showReactionsMenu
                ? 'bg-[#a8c7fa] text-[#041e49]'
                : 'bg-[#3c4043] text-white hover:bg-[#474a4d]'
            }`}
          >
            <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Emoji Popover */}
          {showReactionsMenu && (
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-[#28292c] border border-[#3c4043] p-1.5 rounded-full flex items-center gap-1 shadow-2xl z-50">
              {EMOJI_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleSelectReaction(emoji)}
                  className="w-9 h-9 flex items-center justify-center text-lg hover:scale-125 transition-transform rounded-full hover:bg-[#3c4043] cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Raise Hand Button */}
        <button
          id="btn-toggle-raise-hand"
          onClick={onToggleHandRaise}
          title={isHandRaised ? 'Abaixar a mão' : 'Levantar a mão'}
          className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer ${
            isHandRaised
              ? 'bg-[#a8c7fa] text-[#041e49] hover:bg-[#8ab4f8]'
              : 'bg-[#3c4043] text-white hover:bg-[#474a4d]'
          }`}
        >
          <Hand className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Switch Camera / More Options (3-dots button) */}
        <div className="relative shrink-0" ref={moreRef}>
          <button
            id="btn-more-options"
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            title="Mais opções"
            className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer ${
              showMoreMenu
                ? 'bg-[#a8c7fa] text-[#041e49]'
                : 'bg-[#3c4043] text-white hover:bg-[#474a4d]'
            }`}
          >
            <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {showMoreMenu && (
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 w-48 bg-[#28292c] border border-[#3c4043] py-2 rounded-lg shadow-2xl z-50 flex flex-col text-sm text-[#e8eaed]">
              {availableCameras.length > 1 && (
                <button
                  onClick={() => {
                    onSwitchCamera();
                    setShowMoreMenu(false);
                  }}
                  className="px-4 py-2.5 hover:bg-[#3c4043] flex items-center gap-3 text-left w-full cursor-pointer"
                >
                  <SwitchCamera className="w-4 h-4 text-[#9aa0a6]" />
                  <span>Alternar câmera</span>
                </button>
              )}
              <button
                id="btn-more-open-pip"
                onClick={() => {
                  onOpenPiP?.();
                  setShowMoreMenu(false);
                }}
                className="px-4 py-2.5 hover:bg-[#3c4043] flex items-center gap-3 text-left w-full cursor-pointer text-[#8ab4f8]"
              >
                <PictureInPicture2 className="w-4 h-4 text-[#8ab4f8]" />
                <span>Mini janela no PC</span>
              </button>
              <button
                onClick={() => {
                  handleCopyLink();
                  setShowMoreMenu(false);
                }}
                className="px-4 py-2.5 hover:bg-[#3c4043] flex items-center gap-3 text-left w-full cursor-pointer"
              >
                <Copy className="w-4 h-4 text-[#9aa0a6]" />
                <span>Copiar detalhes</span>
              </button>
            </div>
          )}
        </div>

        {/* End Call / Desligar Button with Admin Hover Popover */}
        <div
          className="relative shrink-0 ml-1"
          onMouseEnter={handleAdminHoverEnter}
          onMouseLeave={handleAdminHoverLeave}
        >
          {/* Admin Hangup Menu Popover (appears right above the button on hover) */}
          {isHost && showAdminHangupMenu && (
            <div
              id="admin-hangup-popover"
              className="absolute bottom-12 sm:bottom-14 left-1/2 -translate-x-1/2 w-64 bg-[#28292c] border border-[#3c4043] rounded-xl shadow-2xl p-2 z-50 flex flex-col gap-1 text-sm text-[#e8eaed] animate-fadeIn"
            >
              <div className="px-2.5 py-1 text-[11px] font-semibold tracking-wider text-[#9aa0a6] uppercase">
                Opções do organizador
              </div>

              {/* Option 1: Desligar para todos */}
              <button
                id="btn-admin-end-for-all"
                type="button"
                onClick={() => {
                  setShowAdminHangupMenu(false);
                  if (onEndCallForEveryone) {
                    onEndCallForEveryone();
                  } else {
                    onLeaveCall();
                  }
                }}
                className="w-full px-3 py-2 rounded-lg hover:bg-[#ea4335]/20 text-left flex items-start gap-2.5 transition-colors cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-full bg-[#ea4335]/20 text-[#ea4335] group-hover:bg-[#ea4335] group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                  <PhoneOff className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-xs sm:text-sm text-[#f28b82] group-hover:text-white">
                    Desligar para todos
                  </span>
                  <span className="text-[11px] text-[#9aa0a6] leading-tight">
                    Encerra a reunião para todos
                  </span>
                </div>
              </button>

              {/* Option 2: Só ele desligar */}
              <button
                id="btn-admin-leave-only-me"
                type="button"
                onClick={() => {
                  setShowAdminHangupMenu(false);
                  onLeaveCall();
                }}
                className="w-full px-3 py-2 rounded-lg hover:bg-[#3c4043] text-left flex items-start gap-2.5 transition-colors cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-full bg-[#3c4043] text-[#e8eaed] group-hover:bg-[#5f6368] flex items-center justify-center shrink-0 transition-colors">
                  <LogOut className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-xs sm:text-sm text-[#e8eaed]">
                    Só você desligar
                  </span>
                  <span className="text-[11px] text-[#9aa0a6] leading-tight">
                    Você sai e a reunião continua
                  </span>
                </div>
              </button>
            </div>
          )}

          {/* Main Hangup Button */}
          <button
            id="btn-leave-call"
            type="button"
            onClick={() => {
              if (isHost) {
                setShowAdminHangupMenu((prev) => !prev);
              } else {
                onLeaveCall();
              }
            }}
            title={isHost ? 'Opções de desligar (Admin)' : 'Desligar chamada'}
            className="h-9 sm:h-11 px-3 sm:px-5 rounded-full bg-[#ea4335] hover:bg-[#d93025] active:bg-[#c5221f] text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 transition-all shrink-0 cursor-pointer shadow-md"
          >
            <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            <span className="font-semibold">Desligar</span>
            {isHost && <ChevronUp className="w-3.5 h-3.5 opacity-80" />}
          </button>
        </div>
      </div>

      {/* Right Section: PiP, Info, Participants, Chat */}
      <div className="flex items-center gap-1 text-[#e8eaed] shrink-0">
        {/* Mini Window / PiP button */}
        {onOpenPiP && (
          <button
            id="btn-trigger-pip"
            onClick={onOpenPiP}
            title="Abrir mini janela no PC (PiP)"
            className="hidden sm:flex w-9 h-9 sm:w-10 sm:h-10 rounded-full items-center justify-center hover:bg-[#3c4043] text-[#e8eaed] hover:text-[#8ab4f8] transition-colors cursor-pointer"
          >
            <PictureInPicture2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        )}

        {/* Info button */}
        <button
          id="btn-meeting-details-info"
          onClick={handleCopyLink}
          title="Detalhes da reunião"
          className="hidden md:flex w-9 h-9 sm:w-10 sm:h-10 rounded-full items-center justify-center hover:bg-[#3c4043] text-[#e8eaed] transition-colors cursor-pointer"
        >
          <Info className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* People Button */}
        <button
          id="btn-toggle-participants"
          onClick={onToggleParticipants}
          title="Mostrar todos"
          className={`h-9 sm:h-10 px-2 sm:px-3 rounded-full flex items-center gap-1 sm:gap-1.5 text-sm transition-all cursor-pointer ${
            isParticipantsOpen
              ? 'bg-[#a8c7fa] text-[#041e49]'
              : 'hover:bg-[#3c4043] text-[#e8eaed]'
          }`}
        >
          <Users className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-xs font-medium">{participantsCount}</span>
        </button>

        {/* Chat Button */}
        <button
          id="btn-toggle-chat"
          onClick={onToggleChat}
          title="Conversar com todos"
          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center relative transition-all cursor-pointer ${
            isChatOpen
              ? 'bg-[#a8c7fa] text-[#041e49]'
              : 'hover:bg-[#3c4043] text-[#e8eaed]'
          }`}
        >
          <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
          {unreadChatCount > 0 && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-[#8ab4f8] ring-2 ring-[#202124]" />
          )}
        </button>
      </div>
    </div>
  );
};
