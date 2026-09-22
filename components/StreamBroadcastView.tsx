'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  SwitchCamera,
  MonitorUp,
  MonitorOff,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Radio,
  ExternalLink,
  Code2,
  PhoneOff,
  Activity,
  Sparkles,
  RefreshCw,
  Tv,
} from 'lucide-react';
import { StreamRole, VideoQualityId, VIDEO_QUALITIES } from '@/lib/types';

interface StreamBroadcastViewProps {
  roomCode: string;
  role: StreamRole;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  availableCameras: MediaDeviceInfo[];
  activeCameraId: string;
  videoQuality: VideoQualityId;
  isEmbed?: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onSwitchCamera: () => void;
  onChangeQuality: (quality: VideoQualityId) => void;
  onLeave: () => void;
  onOpenIntegrationDocs: () => void;
}

export const StreamBroadcastView: React.FC<StreamBroadcastViewProps> = ({
  roomCode,
  role,
  localStream,
  remoteStream,
  isAudioMuted,
  isVideoMuted,
  isScreenSharing,
  availableCameras,
  videoQuality,
  isEmbed = false,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onSwitchCamera,
  onChangeQuality,
  onLeave,
  onOpenIntegrationDocs,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewerMuted, setViewerMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [requiresUserInteractionForAudio, setRequiresUserInteractionForAudio] = useState(false);
  const [isPipActive, setIsPipActive] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isSender = role === 'sender';
  const activeStream = isSender ? localStream : remoteStream;

  // Bind media stream to HTML5 video element
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (activeStream) {
      if (videoEl.srcObject !== activeStream) {
        videoEl.srcObject = activeStream;
      }
      videoEl
        .play()
        .then(() => {
          setRequiresUserInteractionForAudio(false);
        })
        .catch(() => {
          // Autoplay with audio was blocked by browser; retry muted and alert user
          videoEl.muted = true;
          setViewerMuted(true);
          videoEl.play().catch(() => {});
          if (!isSender) {
            setRequiresUserInteractionForAudio(true);
          }
        });
    } else {
      videoEl.srcObject = null;
    }
  }, [activeStream, isSender]);

  // Auto-hide viewer controls after 3 seconds of mouse inactivity
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3500);
  };

  const handleCopyCode = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCopyViewerLink = () => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/?mode=stream&role=viewer&room=${roomCode}`;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleTogglePip = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPipActive(false);
      } else {
        await videoRef.current.requestPictureInPicture();
        setIsPipActive(true);
      }
    } catch {
      // ignore
    }
  };

  const handleUnmuteViewer = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      setViewerMuted(false);
      setRequiresUserInteractionForAudio(false);
      videoRef.current.play().catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative w-full h-screen bg-[#101114] text-[#e8eaed] overflow-hidden flex flex-col items-center justify-between font-sans select-none"
    >
      {/* 1. Top Header Bar */}
      <header
        className={`absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 sm:px-6 py-3 bg-gradient-to-b from-[#000000]/80 via-[#000000]/40 to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#1e1f23]/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#3c4043]/60 text-xs sm:text-sm">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
            <span className="font-medium text-white tracking-wide uppercase text-[11px]">
              {isSender ? 'Transmissor' : 'Receptor'}
            </span>
            <span className="text-[#9aa0a6]">•</span>
            <span className="font-mono font-bold text-[#8ab4f8]">{roomCode}</span>
          </div>

          <button
            onClick={handleCopyCode}
            title="Copiar código de pareamento"
            className="p-1.5 rounded-full bg-[#28292c]/80 hover:bg-[#3c4043] text-[#e8eaed] transition-colors border border-[#3c4043]/40 flex items-center gap-1 text-xs px-2.5"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[#9aa0a6]" />}
            <span className="hidden sm:inline">{copiedCode ? 'Copiado!' : 'Copiar Código'}</span>
          </button>
        </div>

        {/* Top Right Actions */}
        <div className="flex items-center gap-2">
          {isSender && (
            <button
              onClick={handleCopyViewerLink}
              className="flex items-center gap-1.5 bg-[#1a73e8] hover:bg-[#1b66c9] text-white px-3 py-1.5 rounded-full text-xs font-medium transition-colors shadow-sm"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Tv className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link do Receptor'}</span>
            </button>
          )}

          <button
            onClick={onOpenIntegrationDocs}
            title="Ver Documentação e Códigos de Integração (HTML, React, OBS, SDK)"
            className="flex items-center gap-1.5 bg-[#28292c]/90 hover:bg-[#3c4043] text-[#e8eaed] px-3 py-1.5 rounded-full text-xs font-medium transition-colors border border-[#3c4043]/50"
          >
            <Code2 className="w-3.5 h-3.5 text-[#8ab4f8]" />
            <span className="hidden sm:inline">Integração & API</span>
          </button>
        </div>
      </header>

      {/* 2. Main Video Stage */}
      <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
        {/* Active Live Video */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSender || viewerMuted}
          className={`w-full h-full object-contain ${
            isSender && !isScreenSharing ? '-scale-x-100' : ''
          } ${activeStream ? 'opacity-100' : 'opacity-0'}`}
        />

        {/* Sender Waiting or Video Off */}
        {isSender && isVideoMuted && !isScreenSharing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#18191c] text-center p-6">
            <div className="w-16 h-16 rounded-full bg-[#2d2f34] flex items-center justify-center text-[#9aa0a6] mb-4">
              <VideoOff className="w-8 h-8" />
            </div>
            <p className="text-lg font-medium text-white">Sua câmera está desativada</p>
            <p className="text-sm text-[#9aa0a6] mt-1 max-w-sm">
              Clique no botão de câmera abaixo para retomar a transmissão do vídeo.
            </p>
          </div>
        )}

        {/* Viewer Waiting for Sender to Broadcast */}
        {!isSender && !remoteStream && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#131417] text-center p-6 z-10">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-2xl bg-[#1e2025] border border-[#3c4043]/60 flex items-center justify-center text-[#8ab4f8] shadow-2xl">
                <Radio className="w-10 h-10 animate-pulse text-[#8ab4f8]" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8ab4f8] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-[#1a73e8]"></span>
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
              Aguardando início da transmissão...
            </h2>
            <p className="text-sm text-[#9aa0a6] mt-2 max-w-md">
              Pareado no canal <span className="font-mono font-bold text-[#8ab4f8]">{roomCode}</span>. Assim que o transmissor iniciar a câmera, o vídeo aparecerá aqui instantaneamente.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => {
                  const url = `${window.location.origin}/?mode=stream&role=sender&room=${roomCode}`;
                  window.open(url, '_blank');
                }}
                className="flex items-center gap-2 bg-[#1a73e8] hover:bg-[#1b66c9] text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-md"
              >
                <Video className="w-4 h-4" />
                <span>Abrir Transmissor em Nova Aba (Teste)</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </button>

              <button
                onClick={onOpenIntegrationDocs}
                className="flex items-center gap-2 bg-[#28292c] hover:bg-[#3c4043] text-[#e8eaed] px-4 py-2 rounded-xl text-sm font-medium transition-colors border border-[#3c4043]/50"
              >
                <Code2 className="w-4 h-4 text-[#8ab4f8]" />
                <span>Ver Código de Integração</span>
              </button>
            </div>
          </div>
        )}

        {/* Unmute Prompt Banner if browser autoplay restricted audio */}
        {requiresUserInteractionForAudio && !isSender && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-[#1e1f23]/95 backdrop-blur-md px-5 py-2.5 rounded-full border border-amber-500/40 shadow-2xl flex items-center gap-3 animate-bounce">
            <VolumeX className="w-4 h-4 text-amber-400" />
            <span className="text-xs sm:text-sm text-white font-medium">O áudio foi pausado pelo navegador.</span>
            <button
              onClick={handleUnmuteViewer}
              className="bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold px-3 py-1 rounded-full transition-colors"
            >
              Ativar Som
            </button>
          </div>
        )}
      </div>

      {/* 3. Bottom Controls Toolbar */}
      <footer
        className={`absolute bottom-0 left-0 right-0 z-30 flex items-center justify-between px-4 sm:px-6 py-4 bg-gradient-to-t from-[#000000]/90 via-[#000000]/50 to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Left Info / Quality Pill */}
        <div className="flex items-center gap-2">
          {isSender ? (
            <div className="flex items-center gap-1.5 bg-[#1e1f23]/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#3c4043]/40 text-xs text-[#9aa0a6]">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-white font-medium">{videoQuality.toUpperCase()}</span>
              <span>• WebRTC P2P</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-[#1e1f23]/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#3c4043]/40 text-xs text-[#9aa0a6]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-white font-medium">Recepção Ativa</span>
            </div>
          )}
        </div>

        {/* Center Main Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {isSender ? (
            <>
              {/* Audio Toggle */}
              <button
                onClick={onToggleAudio}
                title={isAudioMuted ? 'Ativar Microfone' : 'Desativar Microfone'}
                className={`p-3 sm:p-3.5 rounded-full transition-all shadow-md ${
                  isAudioMuted
                    ? 'bg-[#ea4335] text-white hover:bg-[#d93025]'
                    : 'bg-[#3c4043] text-white hover:bg-[#4a4e52]'
                }`}
              >
                {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              {/* Video Toggle */}
              <button
                onClick={onToggleVideo}
                title={isVideoMuted ? 'Ativar Câmera' : 'Desativar Câmera'}
                className={`p-3 sm:p-3.5 rounded-full transition-all shadow-md ${
                  isVideoMuted
                    ? 'bg-[#ea4335] text-white hover:bg-[#d93025]'
                    : 'bg-[#3c4043] text-white hover:bg-[#4a4e52]'
                }`}
              >
                {isVideoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </button>

              {/* Switch Camera on Mobile / Multi-cam */}
              {availableCameras.length > 1 && (
                <button
                  onClick={onSwitchCamera}
                  title="Alternar Câmera (Frontal / Traseira)"
                  className="p-3 sm:p-3.5 rounded-full bg-[#3c4043] text-white hover:bg-[#4a4e52] transition-colors"
                >
                  <SwitchCamera className="w-5 h-5" />
                </button>
              )}

              {/* Screen Share Toggle */}
              <button
                onClick={onToggleScreenShare}
                title={isScreenSharing ? 'Parar Compartilhamento de Tela' : 'Transmitir Tela'}
                className={`p-3 sm:p-3.5 rounded-full transition-all ${
                  isScreenSharing
                    ? 'bg-[#8ab4f8] text-[#202124] hover:bg-[#aecbfa]'
                    : 'bg-[#3c4043] text-white hover:bg-[#4a4e52]'
                }`}
              >
                {isScreenSharing ? (
                  <MonitorOff className="w-5 h-5" />
                ) : (
                  <MonitorUp className="w-5 h-5" />
                )}
              </button>

              {/* End Stream */}
              <button
                onClick={onLeave}
                title="Encerrar Transmissão"
                className="p-3 sm:p-3.5 px-5 rounded-full bg-[#ea4335] hover:bg-[#d93025] text-white font-medium flex items-center gap-2 transition-all shadow-lg ml-1"
              >
                <PhoneOff className="w-5 h-5" />
                <span className="hidden sm:inline text-sm">Encerrar</span>
              </button>
            </>
          ) : (
            <>
              {/* Viewer Volume / Mute Toggle */}
              <button
                onClick={() => {
                  if (videoRef.current) {
                    const nextMuted = !videoRef.current.muted;
                    videoRef.current.muted = nextMuted;
                    setViewerMuted(nextMuted);
                  }
                }}
                title={viewerMuted ? 'Ativar Som' : 'Silenciar'}
                className="p-3 sm:p-3.5 rounded-full bg-[#3c4043] text-white hover:bg-[#4a4e52] transition-colors"
              >
                {viewerMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>

              {/* Picture-in-Picture */}
              <button
                onClick={handleTogglePip}
                title="Picture-in-Picture"
                className="p-3 sm:p-3.5 rounded-full bg-[#3c4043] text-white hover:bg-[#4a4e52] transition-colors"
              >
                <Tv className="w-5 h-5" />
              </button>

              {/* Fullscreen Toggle */}
              <button
                onClick={handleToggleFullscreen}
                title={isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
                className="p-3 sm:p-3.5 rounded-full bg-[#3c4043] text-white hover:bg-[#4a4e52] transition-colors"
              >
                {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>

              {!isEmbed && (
                <button
                  onClick={onLeave}
                  title="Sair do Visualizador"
                  className="p-3 sm:p-3.5 px-4 rounded-full bg-[#3c4043] hover:bg-[#ea4335] text-white text-xs font-medium transition-colors"
                >
                  Sair
                </button>
              )}
            </>
          )}
        </div>

        {/* Right Quality Selector */}
        <div className="flex items-center gap-2">
          {isSender && (
            <select
              value={videoQuality}
              onChange={(e) => onChangeQuality(e.target.value as VideoQualityId)}
              className="bg-[#1e1f23] text-xs text-[#e8eaed] rounded-lg px-2.5 py-1.5 border border-[#3c4043] focus:outline-none focus:border-[#8ab4f8] cursor-pointer"
            >
              {VIDEO_QUALITIES.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.label} ({q.resolution.split(' ')[0]}p)
                </option>
              ))}
            </select>
          )}
        </div>
      </footer>
    </div>
  );
};
