'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Camera,
  Layers,
} from 'lucide-react';
import { StreamRole, VideoQualityId, VIDEO_QUALITIES, StreamControlsOptions } from '@/lib/types';

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
  controlsConfig?: StreamControlsOptions;
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
  controlsConfig,
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
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isSender = role === 'sender';
  const activeStream = isSender ? localStream : remoteStream;

  // Granular visibility rules
  const isCleanMode =
    controlsConfig?.mode === 'none' ||
    (controlsConfig?.showHeader === false && controlsConfig?.showToolbar === false);

  const showHeader = !isCleanMode && (controlsConfig?.showHeader ?? true);
  const showToolbar = !isCleanMode && (controlsConfig?.showToolbar ?? true);

  const showCopyCode = showHeader && (controlsConfig?.copyCode ?? true);
  const showCopyLink = showHeader && (controlsConfig?.copyLink ?? true);
  const showDocs = showHeader && (controlsConfig?.docs ?? true);

  const showAudio = showToolbar && (controlsConfig?.audio ?? true);
  const showVideo = showToolbar && (controlsConfig?.video ?? true);
  const showSwitchCamera = showToolbar && (controlsConfig?.switchCamera ?? true);
  const showScreenShare = showToolbar && (controlsConfig?.screenShare ?? true);
  const showQuality = showToolbar && (controlsConfig?.quality ?? true);
  const showLeave = showToolbar && (controlsConfig?.leave ?? true);
  const showPip = showToolbar && (controlsConfig?.pip ?? true);
  const showFullscreen = showToolbar && (controlsConfig?.fullscreen ?? true);
  const showStatusBadge = showToolbar && (controlsConfig?.statusBadge ?? true);

  const markVideoLoaded = useCallback(() => {
    setIsVideoLoaded(true);
  }, []);

  // Optimized media stream binding & instantaneous frame detection
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (!activeStream || (isSender && isVideoMuted && !isScreenSharing)) {
      videoEl.srcObject = null;
      const resetTimer = setTimeout(() => setIsVideoLoaded(false), 0);
      return () => clearTimeout(resetTimer);
    }

    // Bind stream immediately
    if (videoEl.srcObject !== activeStream) {
      videoEl.srcObject = activeStream;
    }

    const handleFrameReady = () => {
      setIsVideoLoaded(true);
    };

    videoEl.addEventListener('loadeddata', handleFrameReady);
    videoEl.addEventListener('playing', handleFrameReady);
    videoEl.addEventListener('canplay', handleFrameReady);

    if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
      const readyTimer = setTimeout(() => setIsVideoLoaded(true), 0);
      return () => {
        clearTimeout(readyTimer);
        videoEl.removeEventListener('loadeddata', handleFrameReady);
        videoEl.removeEventListener('playing', handleFrameReady);
        videoEl.removeEventListener('canplay', handleFrameReady);
      };
    }

    videoEl
      .play()
      .then(() => {
        setRequiresUserInteractionForAudio(false);
        if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
          setIsVideoLoaded(true);
        }
      })
      .catch(() => {
        // Autoplay with audio was blocked by browser; retry muted
        videoEl.muted = true;
        setViewerMuted(true);
        videoEl.play().catch(() => {});
        if (!isSender) {
          setRequiresUserInteractionForAudio(true);
        }
      });

    return () => {
      videoEl.removeEventListener('loadeddata', handleFrameReady);
      videoEl.removeEventListener('playing', handleFrameReady);
      videoEl.removeEventListener('canplay', handleFrameReady);
    };
  }, [activeStream, isSender, isVideoMuted, isScreenSharing]);

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

  const showSkeleton =
    !isVideoMuted &&
    !isScreenSharing &&
    (!isVideoLoaded || !activeStream) &&
    (isSender || (Boolean(remoteStream) && !isVideoLoaded));

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative w-full h-screen bg-[#0a0b0e] text-[#e8eaed] overflow-hidden flex flex-col items-center justify-between font-sans select-none"
    >
      {/* 1. Top Header Bar (Only if showHeader is true) */}
      {showHeader && (
        <header
          className={`absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 sm:px-6 py-3 bg-gradient-to-b from-[#000000]/80 via-[#000000]/40 to-transparent transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[#171920]/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#2c303c] text-xs sm:text-sm">
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

            {showCopyCode && (
              <button
                onClick={handleCopyCode}
                title="Copiar código de pareamento"
                className="p-1.5 rounded-full bg-[#1e2129]/90 hover:bg-[#2b2f3a] text-[#e8eaed] transition-colors border border-[#2d313d] flex items-center gap-1 text-xs px-2.5 cursor-pointer"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[#9aa0a6]" />}
                <span className="hidden sm:inline">{copiedCode ? 'Copiado!' : 'Copiar Código'}</span>
              </button>
            )}
          </div>

          {/* Top Right Actions */}
          <div className="flex items-center gap-2">
            {isSender && showCopyLink && (
              <button
                onClick={handleCopyViewerLink}
                className="flex items-center gap-1.5 bg-[#1a73e8] hover:bg-[#1558b0] text-white px-3 py-1.5 rounded-full text-xs font-medium transition-colors shadow-sm cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Tv className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link do Receptor'}</span>
              </button>
            )}

            {showDocs && (
              <button
                onClick={onOpenIntegrationDocs}
                title="Ver Documentação e Códigos de Integração (HTML, React, OBS, SDK)"
                className="flex items-center gap-1.5 bg-[#1e2129]/90 hover:bg-[#2b2f3a] text-[#e8eaed] px-3 py-1.5 rounded-full text-xs font-medium transition-colors border border-[#2d313d] cursor-pointer"
              >
                <Code2 className="w-3.5 h-3.5 text-[#8ab4f8]" />
                <span className="hidden sm:inline">Integração & API</span>
              </button>
            )}
          </div>
        </header>
      )}

      {/* 2. Main Video Stage */}
      <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
        {/* Active Live Video */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSender || viewerMuted}
          onLoadedData={markVideoLoaded}
          onPlaying={markVideoLoaded}
          onCanPlay={markVideoLoaded}
          className={`w-full h-full object-contain transition-opacity duration-300 ${
            isSender && !isScreenSharing ? '-scale-x-100' : ''
          } ${isVideoLoaded && activeStream ? 'opacity-100' : 'opacity-0'}`}
        />

        {/* CLEAN DIAGONAL SHIMMER EFFECT - ONLY IN CAMERA SPACE (NO FAKE TEXT/ROWS) */}
        {((!isVideoLoaded || !activeStream) && !(isSender && isVideoMuted && !isScreenSharing)) && (
          <div className="absolute inset-0 w-full h-full bg-[#0c0e14] pointer-events-none select-none z-10 overflow-hidden">
            {/* Diagonal Shimmer Light Sweep */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute w-[60%] h-[250%] -top-[75%] -left-[30%] bg-gradient-to-r from-transparent via-white/[0.09] to-transparent animate-shimmer-diagonal" />
            </div>
          </div>
        )}

        {/* Sender Waiting or Video Off */}
        {isSender && isVideoMuted && !isScreenSharing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#101217] text-center p-6 z-10">
            <div className="w-16 h-16 rounded-2xl bg-[#1e212b] border border-[#2d313d] flex items-center justify-center text-[#9aa0a6] mb-4">
              <VideoOff className="w-8 h-8 text-[#9aa0a6]" />
            </div>
            <p className="text-base font-medium text-white">Sua câmera está desativada</p>
            <p className="text-xs text-[#9aa0a6] mt-1 max-w-xs">
              Clique no botão de câmera abaixo para retomar a transmissão do vídeo.
            </p>
          </div>
        )}

        {/* Unmute Prompt Banner if browser autoplay restricted audio */}
        {requiresUserInteractionForAudio && !isSender && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-[#1e1f23]/95 backdrop-blur-md px-5 py-2.5 rounded-full border border-amber-500/40 shadow-2xl flex items-center gap-3 animate-bounce">
            <VolumeX className="w-4 h-4 text-amber-400" />
            <span className="text-xs sm:text-sm text-white font-medium">O áudio foi pausado pelo navegador.</span>
            <button
              onClick={handleUnmuteViewer}
              className="bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold px-3 py-1 rounded-full transition-colors cursor-pointer"
            >
              Ativar Som
            </button>
          </div>
        )}
      </div>

      {/* 3. Bottom Controls Toolbar (Only if showToolbar is true) */}
      {showToolbar && (
        <footer
          className={`absolute bottom-0 left-0 right-0 z-30 flex items-center justify-between px-4 sm:px-6 py-4 bg-gradient-to-t from-[#000000]/90 via-[#000000]/50 to-transparent transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Left Info / Quality Pill */}
          <div className="flex items-center gap-2">
            {showStatusBadge && (
              <>
                {isSender ? (
                  <div className="flex items-center gap-1.5 bg-[#171921]/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#2a2e3b] text-xs text-[#9aa0a6]">
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-white font-medium">{videoQuality.toUpperCase()}</span>
                    <span>• WebRTC P2P</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 bg-[#171921]/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#2a2e3b] text-xs text-[#9aa0a6]">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-white font-medium">Recepção Ativa</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Center Main Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {isSender ? (
              <>
                {/* Audio Toggle */}
                {showAudio && (
                  <button
                    onClick={onToggleAudio}
                    title={isAudioMuted ? 'Ativar Microfone' : 'Desativar Microfone'}
                    className={`p-3 sm:p-3.5 rounded-full transition-all shadow-md cursor-pointer ${
                      isAudioMuted
                        ? 'bg-[#ea4335] text-white hover:bg-[#d93025]'
                        : 'bg-[#282b36] text-white hover:bg-[#343946]'
                    }`}
                  >
                    {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                )}

                {/* Video Toggle */}
                {showVideo && (
                  <button
                    onClick={onToggleVideo}
                    title={isVideoMuted ? 'Ligar Câmera' : 'Desligar Câmera'}
                    className={`p-3 sm:p-3.5 rounded-full transition-all shadow-md cursor-pointer ${
                      isVideoMuted
                        ? 'bg-[#ea4335] text-white hover:bg-[#d93025]'
                        : 'bg-[#282b36] text-white hover:bg-[#343946]'
                    }`}
                  >
                    {isVideoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                  </button>
                )}

                {/* Switch Camera Button if multiple are available */}
                {showSwitchCamera && availableCameras.length > 1 && !isScreenSharing && (
                  <button
                    onClick={onSwitchCamera}
                    title="Trocar Câmera (Frontal / Traseira)"
                    className="p-3 sm:p-3.5 rounded-full bg-[#282b36] hover:bg-[#343946] text-white transition-all shadow-md cursor-pointer"
                  >
                    <SwitchCamera className="w-5 h-5" />
                  </button>
                )}

                {/* Screen Sharing Toggle */}
                {showScreenShare && (
                  <button
                    onClick={onToggleScreenShare}
                    title={isScreenSharing ? 'Parar Compartilhamento de Tela' : 'Compartilhar Tela'}
                    className={`p-3 sm:p-3.5 rounded-full transition-all shadow-md cursor-pointer ${
                      isScreenSharing
                        ? 'bg-[#1a73e8] text-white hover:bg-[#1558b0]'
                        : 'bg-[#282b36] text-white hover:bg-[#343946]'
                    }`}
                  >
                    {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <MonitorUp className="w-5 h-5" />}
                  </button>
                )}

                {/* Quality Preset Selector */}
                {showQuality && (
                  <div className="hidden md:flex items-center gap-1 bg-[#171921]/90 backdrop-blur-md p-1 rounded-full border border-[#2a2e3b]">
                    {VIDEO_QUALITIES.map((q) => (
                      <button
                        key={q.id}
                        onClick={() => onChangeQuality(q.id)}
                        className={`px-2.5 py-1 text-[11px] rounded-full font-mono transition-all cursor-pointer ${
                          videoQuality === q.id
                            ? 'bg-[#1a73e8] text-white font-semibold shadow-sm'
                            : 'text-[#9aa0a6] hover:text-white hover:bg-[#232733]'
                        }`}
                      >
                        {q.id.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Viewer Mute/Unmute */}
                {showAudio && (
                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        const next = !videoRef.current.muted;
                        videoRef.current.muted = next;
                        setViewerMuted(next);
                      }
                    }}
                    title={viewerMuted ? 'Ativar Som da Transmissão' : 'Silenciar'}
                    className={`p-3 sm:p-3.5 rounded-full transition-all shadow-md cursor-pointer ${
                      viewerMuted
                        ? 'bg-[#ea4335] text-white hover:bg-[#d93025]'
                        : 'bg-[#282b36] text-white hover:bg-[#343946]'
                    }`}
                  >
                    {viewerMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                )}
              </>
            )}

            {/* End Call / Leave */}
            {showLeave && (
              <button
                onClick={onLeave}
                title={isSender ? 'Encerrar Transmissão' : 'Sair da Transmissão'}
                className="p-3 sm:p-3.5 rounded-full bg-[#ea4335] hover:bg-[#d93025] text-white transition-all shadow-md cursor-pointer"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Right Aux Controls */}
          <div className="flex items-center gap-2">
            {showPip && (
              <button
                onClick={handleTogglePip}
                title="Picture-in-Picture"
                className="hidden sm:flex p-2.5 rounded-full bg-[#1e2129]/80 hover:bg-[#2b2f3a] text-white transition-colors border border-[#2d313d] cursor-pointer"
              >
                <Tv className="w-4 h-4" />
              </button>
            )}

            {showFullscreen && (
              <button
                onClick={handleToggleFullscreen}
                title={isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
                className="p-2.5 rounded-full bg-[#1e2129]/80 hover:bg-[#2b2f3a] text-white transition-colors border border-[#2d313d] cursor-pointer"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            )}
          </div>
        </footer>
      )}
    </div>
  );
};
