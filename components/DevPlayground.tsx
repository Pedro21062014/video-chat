'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  SwitchCamera,
  Play,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Code2,
  Tv,
  Layers,
  Radio,
  Sliders,
  Terminal,
  Activity,
  Sparkles,
  ShieldCheck,
  Download,
  Monitor,
  Volume2,
  FileText,
  CheckCircle2,
  ArrowRight,
  Wifi,
  Trash2,
} from 'lucide-react';
import { StreamRole, VIDEO_QUALITIES, VideoQualityId } from '@/lib/types';
import { sound } from '@/lib/sound';

export const DOCS_RAW_URL =
  'https://raw.githubusercontent.com/Pedro21062014/video-chat/refs/heads/main/public/docs.txt';
export const LLMS_RAW_URL =
  'https://github.com/Pedro21062014/video-chat/raw/refs/heads/main/public/llms.txt';

interface DevPlaygroundProps {
  onStartBroadcast?: (
    roomCode: string,
    role: StreamRole,
    audioMuted: boolean,
    videoMuted: boolean,
    quality: VideoQualityId,
    stream: MediaStream | null,
    sourceType: 'camera' | 'screen'
  ) => void;
  onOpenDocs?: () => void;
  initialRoomCode?: string;
}

export const DevPlayground: React.FC<DevPlaygroundProps> = ({
  onStartBroadcast,
  onOpenDocs,
  initialRoomCode,
}) => {
  // Navigation inside Dev Playground
  const [activeSubTab, setActiveSubTab] = useState<'broadcast' | 'console' | 'playground' | 'snippets' | 'sdk'>('broadcast');

  // Broadcast Creator State
  const [roomCode, setRoomCode] = useState(() => initialRoomCode || 'dev-stream-01');
  const [sourceType, setSourceType] = useState<'camera' | 'screen'>('camera');
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<VideoQualityId>('720p');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [isPreviewLoaded, setIsPreviewLoaded] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Playground Sandbox State
  const [sandboxMode, setSandboxMode] = useState<'stream' | 'meeting'>('stream');
  const [sandboxRole, setSandboxRole] = useState<StreamRole>('viewer');
  const [sandboxEmbed, setSandboxEmbed] = useState(true);
  const [sandboxAudio, setSandboxAudio] = useState(true);
  const [sandboxVideo, setSandboxVideo] = useState(true);
  const [sandboxQuality, setSandboxQuality] = useState<VideoQualityId>('720p');
  const [sandboxUserName, setSandboxUserName] = useState('DevTester');
  const [splitViewMode, setSplitViewMode] = useState(false);
  const [iframeReloadKey, setIframeReloadKey] = useState(0);

  // Snippets & Code State
  const [snippetLanguage, setSnippetLanguage] = useState<'iframe' | 'react' | 'nextjs' | 'js_sdk' | 'obs'>('iframe');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Granular Controls Configurator for Camera SDK
  const [controlsMode, setControlsMode] = useState<'all' | 'none' | 'custom'>('all');
  const [selectedButtons, setSelectedButtons] = useState<{ [key: string]: boolean }>({
    audio: true,
    video: true,
    switchcamera: true,
    screenshare: true,
    quality: true,
    fullscreen: true,
    pip: true,
    leave: true,
    header: true,
  });

  const toggleButtonOption = (key: string) => {
    setSelectedButtons((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getControlsQuery = () => {
    if (controlsMode === 'none') {
      return '&controls=none';
    }
    if (controlsMode === 'custom') {
      const activeBtns = Object.entries(selectedButtons)
        .filter(([k, v]) => v && k !== 'header')
        .map(([k]) => k);
      let q = `&buttons=${activeBtns.join(',')}`;
      if (!selectedButtons.header) {
        q += '&header=false';
      }
      return q;
    }
    return '';
  };

  // Live Signaling Logs for Dev console
  const [eventLogs, setEventLogs] = useState<Array<{ time: string; text: string; type: 'info' | 'success' | 'warn' }>>([
    { time: '12:00:00', text: 'Dev Console inicializado com sucesso.', type: 'info' },
    { time: '12:00:01', text: 'Protocolo WebRTC P2P pronto para negociação.', type: 'success' },
    { time: '12:00:02', text: 'Servidores STUN públicos ativos (Google STUN).', type: 'info' },
  ]);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://videomeet.app';
  const cleanRoomCode = (roomCode || 'demo-stream').toLowerCase().trim();

  // URLs
  const senderUrl = `${baseUrl}/?mode=stream&role=sender&room=${cleanRoomCode}&embed=true&quality=${selectedQuality}`;
  const viewerUrl = `${baseUrl}/?mode=stream&role=viewer&room=${cleanRoomCode}&embed=true`;
  const viewerDirectUrl = `${baseUrl}/?mode=stream&role=viewer&room=${cleanRoomCode}`;

  const addLog = (text: string, type: 'info' | 'success' | 'warn' = 'info') => {
    const now = new Date().toLocaleTimeString();
    setEventLogs((prev) => [{ time: now, text, type }, ...prev.slice(0, 29)]);
  };

  const clearLogs = () => {
    setEventLogs([
      { time: new Date().toLocaleTimeString(), text: 'Console de telemetria limpo.', type: 'info' },
    ]);
  };

  const copyText = (text: string, key: string) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      addLog(`Copiado para área de transferência: ${key}`, 'success');
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const generateNewRoomCode = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    const seg = (len: number) =>
      Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const newCode = `dev-${seg(3)}-${seg(4)}`;
    setRoomCode(newCode);
    addLog(`Novo código de transmissão gerado: ${newCode}`, 'info');
  };

  // Enumerate cameras
  useEffect(() => {
    let active = true;
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((devices) => {
        if (!active) return;
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setAvailableCameras(videoInputs);
        if (videoInputs.length > 0 && !selectedCameraId) {
          setSelectedCameraId(videoInputs[0].deviceId);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [selectedCameraId]);

  // Audio level visualizer for preview
  useEffect(() => {
    if (isAudioMuted || !previewStream) {
      const resetTimer = setTimeout(() => {
        setAudioLevel(0);
      }, 0);
      return () => clearTimeout(resetTimer);
    }

    const audioTrack = previewStream.getAudioTracks()[0];
    if (!audioTrack) return;

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(previewStream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateMeter = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          setAudioLevel(Math.min(100, Math.round((average / 128) * 100)));
        }
        animFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();
    } catch {
      // AudioContext error fallback
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    };
  }, [previewStream, isAudioMuted]);

  // Camera preview stream management
  useEffect(() => {
    let active = true;

    async function initPreview() {
      if (isVideoMuted) {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        setPreviewStream(null);
        return;
      }

      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }

        const targetOpt = VIDEO_QUALITIES.find((q) => q.id === selectedQuality) || VIDEO_QUALITIES[2];
        let stream: MediaStream;

        if (sourceType === 'screen') {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              width: { ideal: targetOpt.width },
              height: { ideal: targetOpt.height },
              frameRate: { ideal: targetOpt.frameRate },
            },
            audio: !isAudioMuted,
          });
          stream.getVideoTracks()[0].onended = () => {
            setSourceType('camera');
            addLog('Compartilhamento de tela finalizado pelo usuário.', 'info');
          };
          addLog(`Captura de tela iniciada (${targetOpt.label}).`, 'success');
        } else {
          const videoConstraints: MediaTrackConstraints = selectedCameraId
            ? {
                deviceId: { exact: selectedCameraId },
                width: { ideal: targetOpt.width },
                height: { ideal: targetOpt.height },
              }
            : {
                facingMode: 'user',
                width: { ideal: targetOpt.width },
                height: { ideal: targetOpt.height },
              };

          stream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
            audio: !isAudioMuted ? { echoCancellation: true, noiseSuppression: true } : false,
          });
          addLog(`Câmera iniciada com sucesso (${targetOpt.label}).`, 'success');
        }

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        setPreviewStream(stream);
        setCameraError(null);
      } catch (err) {
        console.warn('Dev camera preview error:', err);
        setCameraError('Não foi possível acessar o dispositivo de mídia.');
        addLog('Erro ao obter permissão de câmera/tela.', 'warn');
      }
    }

    initPreview();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [sourceType, selectedCameraId, selectedQuality, isVideoMuted, isAudioMuted]);

  // Bind stream to video element
  useEffect(() => {
    const el = videoPreviewRef.current;
    if (!el) return;
    if (previewStream && !isVideoMuted) {
      if (el.srcObject !== previewStream) {
        el.srcObject = previewStream;
      }
      const handleReady = () => setIsPreviewLoaded(true);
      el.addEventListener('loadeddata', handleReady);
      el.addEventListener('playing', handleReady);
      el.addEventListener('canplay', handleReady);

      if (el.readyState >= 2 && el.videoWidth > 0) {
        const timer = setTimeout(() => setIsPreviewLoaded(true), 0);
        return () => {
          clearTimeout(timer);
          el.removeEventListener('loadeddata', handleReady);
          el.removeEventListener('playing', handleReady);
          el.removeEventListener('canplay', handleReady);
        };
      }

      el.play().catch(() => {});
      return () => {
        el.removeEventListener('loadeddata', handleReady);
        el.removeEventListener('playing', handleReady);
        el.removeEventListener('canplay', handleReady);
      };
    } else {
      el.srcObject = null;
      const timer = setTimeout(() => setIsPreviewLoaded(false), 0);
      return () => clearTimeout(timer);
    }
  }, [previewStream, isVideoMuted]);

  // Switch between cameras
  const handleSwitchCamera = () => {
    if (availableCameras.length <= 1) return;
    const currentIndex = availableCameras.findIndex((c) => c.deviceId === selectedCameraId);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    const nextId = availableCameras[nextIndex].deviceId;
    setSelectedCameraId(nextId);
    addLog(`Câmera alterada para: ${availableCameras[nextIndex].label || nextId}`, 'info');
  };

  // Launch broadcast
  const handleLaunchBroadcast = () => {
    sound.playJoin();
    addLog(`Iniciando transmissão P2P na sala [${cleanRoomCode}]...`, 'success');
    if (onStartBroadcast) {
      onStartBroadcast(
        cleanRoomCode,
        'sender',
        isAudioMuted,
        isVideoMuted,
        selectedQuality,
        previewStream,
        sourceType
      );
    }
  };

  // Dynamic code generation for active tab
  const getDynamicCodeSnippet = () => {
    const targetRoom = cleanRoomCode || 'meu-canal';
    const controlsQuery = getControlsQuery();
    const targetViewerUrl = `${baseUrl}/?mode=stream&role=viewer&room=${targetRoom}&embed=true${controlsQuery}`;
    const targetSenderUrl = `${baseUrl}/?mode=stream&role=sender&room=${targetRoom}&embed=true&quality=${selectedQuality}${controlsQuery}`;

    // SDK options string
    let sdkOptionsStr = '';
    if (controlsMode === 'none') {
      sdkOptionsStr = `\n    controls: 'none',`;
    } else if (controlsMode === 'custom') {
      const activeBtns = Object.entries(selectedButtons)
        .filter(([k, v]) => v && k !== 'header')
        .map(([k]) => `'${k}'`);
      sdkOptionsStr = `\n    buttons: [${activeBtns.join(', ')}],`;
      if (!selectedButtons.header) {
        sdkOptionsStr += `\n    header: false,`;
      }
    }

    switch (snippetLanguage) {
      case 'iframe':
        return `<!-- 1. Receptor de Câmera / Transmissão em Iframe -->
<iframe
  src="${targetViewerUrl}"
  width="100%"
  height="500"
  allow="camera; microphone; display-capture; autoplay; clipboard-write; fullscreen"
  allowfullscreen
  style="border: 0; border-radius: 12px; background: #0b0c0e; overflow: hidden;">
</iframe>

<!-- 2. Transmissor de Câmera (Para emitir vídeo em outro site ou app) -->
<iframe
  src="${targetSenderUrl}"
  width="100%"
  height="500"
  allow="camera; microphone; display-capture; autoplay"
  allowfullscreen
  style="border: 0; border-radius: 12px; background: #0b0c0e;">
</iframe>`;

      case 'react':
        return `import React from 'react';

// Componente React para Receptor ou Transmissor P2P
export function VideoMeetViewer({ roomCode = '${targetRoom}' }: { roomCode?: string }) {
  const viewerUrl = \`${baseUrl}/?mode=stream&role=viewer&room=\${encodeURIComponent(roomCode)}&embed=true${controlsQuery}\`;

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-800 shadow-2xl">
      <iframe
        src={viewerUrl}
        className="w-full h-full border-0"
        allow="camera; microphone; display-capture; autoplay; fullscreen"
        allowFullScreen
      />
    </div>
  );
}`;

      case 'nextjs':
        return `'use client';

import React from 'react';

// Widget Next.js App Router compatível com SSR
export default function CameraStreamPlayer({ 
  room = '${targetRoom}', 
  quality = '${selectedQuality}' 
}: { 
  room?: string;
  quality?: string;
}) {
  const streamUrl = \`${baseUrl}/?mode=stream&role=viewer&room=\${room}&quality=\${quality}&embed=true${controlsQuery}\`;

  return (
    <section className="w-full max-w-4xl mx-auto my-6 p-4 bg-[#14161a] rounded-2xl border border-[#242831]">
      <div className="flex items-center justify-between mb-3 text-xs text-neutral-400">
        <span className="font-semibold text-white">Transmissão Ao Vivo: {room}</span>
        <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-mono">WebRTC P2P</span>
      </div>
      <iframe
        src={streamUrl}
        className="w-full h-[480px] rounded-xl border-0 bg-black"
        allow="camera; microphone; display-capture; autoplay; fullscreen"
        allowFullScreen
      />
    </section>
  );
}`;

      case 'js_sdk':
        return `<!-- 1. Importe o SDK VideoMeet -->
<script src="${baseUrl}/videomeet-sdk.js"></script>

<!-- 2. Container onde o vídeo será injetado -->
<div id="meu-player-video" style="width: 100%; height: 500px;"></div>

<script>
  // Inicialização do Receptor via SDK (1 linha)
  const viewer = VideoMeet.createViewer({
    container: '#meu-player-video',
    roomCode: '${targetRoom}',
    baseUrl: '${baseUrl}',${sdkOptionsStr}
    borderRadius: '16px'
  });

  // Ou para criar um Transmissor de Câmera isolado:
  // const transmitter = VideoMeet.createSender({
  //   container: '#meu-player-video',
  //   roomCode: '${targetRoom}',${sdkOptionsStr}
  // });
</script>`;

      case 'obs':
        return `URL para OBS Studio / Streamlabs (Fonte de Navegador / Browser Source):

${targetViewerUrl}

Instruções para OBS Studio:
1. Abra o OBS Studio
2. Em "Fontes" (+), escolha "Navegador" (Browser)
3. Cole a URL acima
4. Defina a Largura: 1920 e Altura: 1080
5. Marque "Controlar áudio via OBS" e clique em OK!`;
    }
  };

  const sandboxGeneratedUrl = `${baseUrl}/?room=${cleanRoomCode}&mode=${sandboxMode}${
    sandboxMode === 'stream' ? `&role=${sandboxRole}` : ''
  }&embed=${sandboxEmbed}&audio=${sandboxAudio}&video=${sandboxVideo}&quality=${sandboxQuality}&name=${encodeURIComponent(
    sandboxUserName
  )}${getControlsQuery()}`;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6 text-[#e8eaed] font-sans antialiased">
      {/* Top Header Bar: Modern Minimalist Dev Console */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#2d3139]">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#1e2028] border border-[#303542] flex items-center justify-center text-[#8ab4f8] shadow-sm">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
                Dev Console & Camera Lab
              </h1>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-md font-mono border border-emerald-500/20">
                P2P Engine Online
              </span>
            </div>
            <p className="text-xs text-[#9aa0a6] mt-0.5">
              Crie transmissões diretas de câmera, monitore eventos de sinalização e integre via SDK ou Iframe.
            </p>
          </div>
        </div>

        {/* Telemetry Status Bar */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-[#171920] px-3 py-1.5 rounded-lg border border-[#2c303c] text-[#9aa0a6]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-white">STUN: Google</span>
          </div>

          <div className="flex items-center gap-1.5 bg-[#171920] px-3 py-1.5 rounded-lg border border-[#2c303c] text-[#9aa0a6]">
            <Activity className="w-3.5 h-3.5 text-[#8ab4f8]" />
            <span className="font-mono text-white">Latência &lt;120ms</span>
          </div>

          {onOpenDocs && (
            <button
              onClick={onOpenDocs}
              className="flex items-center gap-1.5 bg-[#1a73e8]/20 hover:bg-[#1a73e8]/30 text-[#8ab4f8] hover:text-white px-3 py-1.5 rounded-lg border border-[#1a73e8]/30 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Ver Docs</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#2d3139] pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('broadcast')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            activeSubTab === 'broadcast'
              ? 'bg-[#1a73e8] text-white shadow-sm'
              : 'text-[#9aa0a6] hover:text-white hover:bg-[#1f222b]'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Criador de Câmera</span>
        </button>

        <button
          onClick={() => setActiveSubTab('console')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            activeSubTab === 'console'
              ? 'bg-[#1a73e8] text-white shadow-sm'
              : 'text-[#9aa0a6] hover:text-white hover:bg-[#1f222b]'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Console & Logs</span>
        </button>

        <button
          onClick={() => setActiveSubTab('playground')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            activeSubTab === 'playground'
              ? 'bg-[#1a73e8] text-white shadow-sm'
              : 'text-[#9aa0a6] hover:text-white hover:bg-[#1f222b]'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Sandbox & Split View</span>
        </button>

        <button
          onClick={() => setActiveSubTab('snippets')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            activeSubTab === 'snippets'
              ? 'bg-[#1a73e8] text-white shadow-sm'
              : 'text-[#9aa0a6] hover:text-white hover:bg-[#1f222b]'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>Snippets de Integração</span>
        </button>

        <button
          onClick={() => setActiveSubTab('sdk')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            activeSubTab === 'sdk'
              ? 'bg-[#1a73e8] text-white shadow-sm'
              : 'text-[#9aa0a6] hover:text-white hover:bg-[#1f222b]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>Recursos & IAs</span>
        </button>
      </div>

      {/* TAB 1: CRIADOR DE COMPARTILHAMENTO DE CÂMERA */}
      {activeSubTab === 'broadcast' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Camera Preview Box */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-[#0c0d10] border border-[#2d3139] shadow-2xl flex items-center justify-center">
              {previewStream && !isVideoMuted ? (
                <>
                  <video
                    ref={videoPreviewRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover transition-opacity duration-300 ${
                      sourceType === 'camera' ? '-scale-x-100' : ''
                    } ${isPreviewLoaded ? 'opacity-100' : 'opacity-0'}`}
                  />
                  {!isPreviewLoaded && (
                    <div className="absolute inset-0 flex flex-col justify-between p-4 sm:p-6 bg-[#0b0c10] overflow-hidden z-10 select-none pointer-events-none">
                      {/* Top Skeleton Header */}
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-lg bg-white/[0.08] animate-pulse" />
                          <div className="w-24 h-3 bg-white/[0.08] rounded-md animate-pulse" />
                        </div>
                        <div className="w-12 h-4 rounded-full bg-white/[0.06] animate-pulse" />
                      </div>

                      {/* Center Table / Card Skeleton Rows */}
                      <div className="w-full max-w-md mx-auto flex flex-col gap-2.5 my-auto">
                        <div className="w-full bg-[#14161d]/80 rounded-xl border border-white/[0.06] p-4 backdrop-blur-md shadow-xl flex flex-col gap-3 animate-pulse">
                          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
                            <div className="w-28 h-3 rounded-md bg-white/[0.12]" />
                            <div className="w-12 h-2.5 rounded-md bg-white/[0.08]" />
                          </div>
                          <div className="flex flex-col gap-2.5 py-0.5">
                            <div className="flex items-center justify-between gap-3">
                              <div className="w-3/5 h-2.5 rounded-md bg-white/[0.08]" />
                              <div className="w-10 h-2.5 rounded-md bg-white/[0.08]" />
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <div className="w-4/5 h-2.5 rounded-md bg-white/[0.08]" />
                              <div className="w-14 h-2.5 rounded-md bg-white/[0.08]" />
                            </div>
                          </div>
                          <div className="w-full h-1 bg-white/[0.04] rounded-full overflow-hidden relative">
                            <div className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent animate-[shimmer_1.5s_infinite] -translate-x-full" />
                          </div>
                        </div>
                      </div>

                      {/* Bottom Skeleton Footer */}
                      <div className="flex items-center justify-between w-full">
                        <div className="w-16 h-2 rounded-md bg-white/[0.04] animate-pulse" />
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-white/[0.06] animate-pulse" />
                          <div className="w-5 h-5 rounded-full bg-white/[0.06] animate-pulse" />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <div className="w-14 h-14 rounded-full bg-[#181a1f] flex items-center justify-center text-[#9aa0a6]">
                    <VideoOff className="w-7 h-7" />
                  </div>
                  <span className="text-sm font-medium text-[#e8eaed]">Vídeo desativado ou sem sinal</span>
                  <span className="text-xs text-[#9aa0a6]">
                    {cameraError || 'Ative a câmera ou selecione uma fonte de captura.'}
                  </span>
                </div>
              )}

              {/* Status Pill on Top */}
              <div className="absolute top-3 left-3 flex items-center gap-2 bg-[#000000]/70 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-mono border border-white/10 text-white">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>DEV PREVIEW</span>
                <span className="text-[#9aa0a6]">|</span>
                <span className="text-[#8ab4f8]">{selectedQuality.toUpperCase()}</span>
              </div>

              {/* Live Audio Level Meter */}
              {!isAudioMuted && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-[#000000]/70 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] border border-white/10 text-white">
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  <div className="w-12 h-1.5 bg-[#2d3139] rounded-full overflow-hidden flex items-center">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-75"
                      style={{ width: `${audioLevel}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Bottom Preview Controls Overlay */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between bg-[#000000]/80 backdrop-blur-md p-2 rounded-xl border border-white/10">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setIsAudioMuted(!isAudioMuted);
                      addLog(`Microfone ${!isAudioMuted ? 'desativado' : 'ativado'}`, 'info');
                    }}
                    className={`p-2 rounded-lg transition-colors cursor-pointer ${
                      isAudioMuted
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-[#1e2129] text-white hover:bg-[#2b2f3a]'
                    }`}
                    title={isAudioMuted ? 'Ativar Áudio' : 'Mutar Áudio'}
                  >
                    {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => {
                      setIsVideoMuted(!isVideoMuted);
                      addLog(`Câmera ${!isVideoMuted ? 'desativada' : 'ativada'}`, 'info');
                    }}
                    className={`p-2 rounded-lg transition-colors cursor-pointer ${
                      isVideoMuted
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-[#1e2129] text-white hover:bg-[#2b2f3a]'
                    }`}
                    title={isVideoMuted ? 'Ligar Vídeo' : 'Desligar Vídeo'}
                  >
                    {isVideoMuted ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                  </button>

                  {sourceType === 'camera' && availableCameras.length > 1 && (
                    <button
                      onClick={handleSwitchCamera}
                      className="p-2 rounded-lg bg-[#1e2129] text-white hover:bg-[#2b2f3a] transition-colors cursor-pointer"
                      title="Trocar Câmera"
                    >
                      <SwitchCamera className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="text-[11px] font-mono text-[#9aa0a6] truncate px-2">
                  {sourceType === 'screen' ? 'Compartilhando Tela' : availableCameras.find((c) => c.deviceId === selectedCameraId)?.label || 'Câmera Padrão'}
                </div>
              </div>
            </div>

            {/* Quick Live URLs */}
            <div className="bg-[#171920] p-4 rounded-xl border border-[#282c37] flex flex-col gap-3">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5 text-[#8ab4f8]" />
                Links Diretos do Canal Gerado
              </span>

              <div className="flex flex-col gap-2 text-xs font-mono">
                {/* Viewer URL */}
                <div className="flex items-center justify-between gap-2 p-2 bg-[#0e1014] rounded-lg border border-[#252833]">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-emerald-400 font-bold shrink-0">RECEPTOR:</span>
                    <span className="text-[#9aa0a6] truncate">{viewerDirectUrl}</span>
                  </div>
                  <button
                    onClick={() => copyText(viewerDirectUrl, 'viewer_url')}
                    className="p-1.5 rounded hover:bg-[#1e2129] text-[#8ab4f8] shrink-0 cursor-pointer"
                    title="Copiar link do receptor"
                  >
                    {copiedKey === 'viewer_url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Sender URL */}
                <div className="flex items-center justify-between gap-2 p-2 bg-[#0e1014] rounded-lg border border-[#252833]">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-[#8ab4f8] font-bold shrink-0">EMISSOR:</span>
                    <span className="text-[#9aa0a6] truncate">{senderUrl}</span>
                  </div>
                  <button
                    onClick={() => copyText(senderUrl, 'sender_url')}
                    className="p-1.5 rounded hover:bg-[#1e2129] text-[#8ab4f8] shrink-0 cursor-pointer"
                    title="Copiar link do transmissor"
                  >
                    {copiedKey === 'sender_url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Parameters & Launch Button */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="bg-[#171920] p-5 rounded-2xl border border-[#282c37] flex flex-col gap-4">
              <h2 className="text-sm font-semibold text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#8ab4f8]" />
                  Configurações da Transmissão
                </span>
                <span className="text-[10px] text-[#9aa0a6] font-normal">P2P Firestore</span>
              </h2>

              {/* Room Code */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#9aa0a6]">Código do Canal (Room ID)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                    placeholder="ex: camera-sala-01"
                    className="flex-1 bg-[#0e1014] border border-[#2a2e3b] focus:border-[#1a73e8] rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
                  />
                  <button
                    onClick={generateNewRoomCode}
                    className="p-2 bg-[#1e2129] hover:bg-[#2b2f3a] text-[#8ab4f8] rounded-xl border border-[#2a2e3b] text-xs transition-colors cursor-pointer"
                    title="Gerar código aleatório"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Capture Source Type */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#9aa0a6]">Fonte de Mídia</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setSourceType('camera');
                      addLog('Fonte selecionada: Câmera', 'info');
                    }}
                    className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                      sourceType === 'camera'
                        ? 'bg-[#1a73e8] text-white border-[#1a73e8]'
                        : 'bg-[#0e1014] text-[#9aa0a6] border-[#2a2e3b] hover:text-white'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Câmera Web/Celular</span>
                  </button>

                  <button
                    onClick={() => {
                      setSourceType('screen');
                      addLog('Fonte selecionada: Compartilhamento de Tela', 'info');
                    }}
                    className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                      sourceType === 'screen'
                        ? 'bg-[#1a73e8] text-white border-[#1a73e8]'
                        : 'bg-[#0e1014] text-[#9aa0a6] border-[#2a2e3b] hover:text-white'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Tela / Janela</span>
                  </button>
                </div>
              </div>

              {/* Camera Selection dropdown */}
              {sourceType === 'camera' && availableCameras.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[#9aa0a6]">Dispositivo de Câmera</label>
                  <select
                    value={selectedCameraId}
                    onChange={(e) => {
                      setSelectedCameraId(e.target.value);
                      addLog(`Dispositivo alterado para: ${e.target.value}`, 'info');
                    }}
                    className="w-full bg-[#0e1014] border border-[#2a2e3b] rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
                  >
                    {availableCameras.map((cam, idx) => (
                      <option key={cam.deviceId || idx} value={cam.deviceId} className="bg-[#171920]">
                        {cam.label || `Câmera ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quality Preset */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#9aa0a6]">Qualidade e Resolução</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {VIDEO_QUALITIES.map((q) => (
                    <button
                      key={q.id}
                      onClick={() => {
                        setSelectedQuality(q.id);
                        addLog(`Qualidade definida para: ${q.label}`, 'info');
                      }}
                      className={`py-1.5 text-xs rounded-lg font-mono font-medium border transition-all cursor-pointer ${
                        selectedQuality === q.id
                          ? 'bg-[#1a73e8] text-white border-[#1a73e8] shadow-sm'
                          : 'bg-[#0e1014] text-[#9aa0a6] border-[#2a2e3b] hover:text-white'
                      }`}
                    >
                      {q.id.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Big Action: Launch Broadcast */}
              <button
                onClick={handleLaunchBroadcast}
                className="w-full mt-2 py-3 bg-[#1a73e8] hover:bg-[#1558b0] text-white font-medium text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Iniciar Transmissão de Câmera Agora</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONSOLE & LOGS WEBRTC */}
      {activeSubTab === 'console' && (
        <div className="flex flex-col gap-4">
          <div className="bg-[#101217] rounded-2xl border border-[#2d3139] overflow-hidden shadow-2xl flex flex-col">
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#171920] border-b border-[#2d3139] text-xs">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                </div>
                <span className="font-mono text-white font-semibold ml-2">webrtc-signaling.log</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={clearLogs}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#222530] hover:bg-[#2c303c] text-[#9aa0a6] hover:text-white transition-colors cursor-pointer text-[11px]"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Limpar</span>
                </button>
              </div>
            </div>

            {/* Terminal Body */}
            <div className="p-4 font-mono text-xs text-[#dcdfe4] space-y-1.5 max-h-[480px] overflow-y-auto">
              {eventLogs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-2.5 leading-relaxed">
                  <span className="text-[#6b7280] select-none text-[11px] shrink-0">[{log.time}]</span>
                  <span
                    className={
                      log.type === 'success'
                        ? 'text-emerald-400 font-semibold'
                        : log.type === 'warn'
                        ? 'text-amber-400'
                        : 'text-[#9aa0a6]'
                    }
                  >
                    {log.type === 'success' && '✔ '}
                    {log.type === 'warn' && '⚠ '}
                    {log.type === 'info' && 'ℹ '}
                    {log.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SANDBOX & SPLIT VIEW */}
      {activeSubTab === 'playground' && (
        <div className="flex flex-col gap-5">
          {/* Controls Bar */}
          <div className="bg-[#171920] p-4 rounded-xl border border-[#282c37] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[#9aa0a6] font-medium">Modo de Exibição:</span>
              <button
                onClick={() => setSplitViewMode(!splitViewMode)}
                className={`px-3 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer ${
                  splitViewMode
                    ? 'bg-[#1a73e8] border-[#1a73e8] text-white'
                    : 'bg-[#222530] border-[#2d3139] text-[#9aa0a6] hover:text-white'
                }`}
              >
                {splitViewMode ? 'Visão Dupla Split Ativa' : 'Visão Simples'}
              </button>
            </div>

            <button
              onClick={() => setIframeReloadKey((k) => k + 1)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#222530] hover:bg-[#2c303c] text-white border border-[#2d3139] transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Recarregar Iframe(s)</span>
            </button>
          </div>

          {/* Sandbox Iframes Stage */}
          {splitViewMode ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left: Sender */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5 px-1">
                  <Radio className="w-3.5 h-3.5 text-[#8ab4f8]" />
                  Transmissor (role=sender)
                </span>
                <div className="relative w-full h-[460px] rounded-2xl overflow-hidden bg-[#0c0d10] border border-[#2d3139] shadow-2xl">
                  <iframe
                    key={`sender-${iframeReloadKey}-${controlsMode}`}
                    src={`${baseUrl}/?mode=stream&role=sender&room=${cleanRoomCode}&embed=true&quality=${sandboxQuality}${getControlsQuery()}`}
                    className="w-full h-full border-0"
                    allow="camera; microphone; display-capture; autoplay; fullscreen"
                    allowFullScreen
                  />
                </div>
              </div>

              {/* Right: Viewer */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5 px-1">
                  <Tv className="w-3.5 h-3.5 text-emerald-400" />
                  Receptor Remoto (role=viewer)
                </span>
                <div className="relative w-full h-[460px] rounded-2xl overflow-hidden bg-[#0c0d10] border border-[#2d3139] shadow-2xl">
                  <iframe
                    key={`viewer-${iframeReloadKey}-${controlsMode}`}
                    src={`${baseUrl}/?mode=stream&role=viewer&room=${cleanRoomCode}&embed=true${getControlsQuery()}`}
                    className="w-full h-full border-0"
                    allow="camera; microphone; display-capture; autoplay; fullscreen"
                    allowFullScreen
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="relative w-full h-[520px] rounded-2xl overflow-hidden bg-[#0c0d10] border border-[#2d3139] shadow-2xl">
              <iframe
                key={`sandbox-${iframeReloadKey}`}
                src={sandboxGeneratedUrl}
                className="w-full h-full border-0"
                allow="camera; microphone; display-capture; autoplay; fullscreen"
                allowFullScreen
              />
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SNIPPETS DE INTEGRAÇÃO */}
      {activeSubTab === 'snippets' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-[#2d3139] pb-3 overflow-x-auto">
            <button
              onClick={() => setSnippetLanguage('iframe')}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                snippetLanguage === 'iframe'
                  ? 'bg-[#1a73e8] text-white font-semibold'
                  : 'bg-[#181a1f] text-[#9aa0a6] hover:text-white border border-[#2d3139]'
              }`}
            >
              HTML Iframe
            </button>

            <button
              onClick={() => setSnippetLanguage('react')}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                snippetLanguage === 'react'
                  ? 'bg-[#1a73e8] text-white font-semibold'
                  : 'bg-[#181a1f] text-[#9aa0a6] hover:text-white border border-[#2d3139]'
              }`}
            >
              React.js
            </button>

            <button
              onClick={() => setSnippetLanguage('nextjs')}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                snippetLanguage === 'nextjs'
                  ? 'bg-[#1a73e8] text-white font-semibold'
                  : 'bg-[#181a1f] text-[#9aa0a6] hover:text-white border border-[#2d3139]'
              }`}
            >
              Next.js (App Router)
            </button>

            <button
              onClick={() => setSnippetLanguage('js_sdk')}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                snippetLanguage === 'js_sdk'
                  ? 'bg-[#1a73e8] text-white font-semibold'
                  : 'bg-[#181a1f] text-[#9aa0a6] hover:text-white border border-[#2d3139]'
              }`}
            >
              JavaScript SDK
            </button>

            <button
              onClick={() => setSnippetLanguage('obs')}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                snippetLanguage === 'obs'
                  ? 'bg-[#1a73e8] text-white font-semibold'
                  : 'bg-[#181a1f] text-[#9aa0a6] hover:text-white border border-[#2d3139]'
              }`}
            >
              OBS Studio
            </button>
          </div>

          {/* Controls & Button Customization Card */}
          <div className="bg-[#171920] p-4 rounded-xl border border-[#282c37] flex flex-col gap-3 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#8ab4f8]" />
                <span className="font-semibold text-white">Configuração dos Botões e Interface da Câmera:</span>
              </div>
              <div className="flex items-center gap-1.5 bg-[#0e1014] p-1 rounded-lg border border-[#2a2e3b]">
                <button
                  onClick={() => setControlsMode('all')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                    controlsMode === 'all'
                      ? 'bg-[#1a73e8] text-white shadow-sm'
                      : 'text-[#9aa0a6] hover:text-white'
                  }`}
                >
                  Padrão (Todos)
                </button>
                <button
                  onClick={() => setControlsMode('none')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                    controlsMode === 'none'
                      ? 'bg-[#1a73e8] text-white shadow-sm'
                      : 'text-[#9aa0a6] hover:text-white'
                  }`}
                >
                  Modo Limpo (Sem Nada)
                </button>
                <button
                  onClick={() => setControlsMode('custom')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                    controlsMode === 'custom'
                      ? 'bg-[#1a73e8] text-white shadow-sm'
                      : 'text-[#9aa0a6] hover:text-white'
                  }`}
                >
                  Personalizar Botões
                </button>
              </div>
            </div>

            {controlsMode === 'custom' && (
              <div className="pt-2 border-t border-[#2a2e3b] flex flex-wrap items-center gap-2">
                {[
                  { key: 'audio', label: 'Microfone' },
                  { key: 'video', label: 'Câmera' },
                  { key: 'switchcamera', label: 'Trocar Câmera' },
                  { key: 'screenshare', label: 'Compartilhar Tela' },
                  { key: 'quality', label: 'Qualidade' },
                  { key: 'fullscreen', label: 'Tela Cheia' },
                  { key: 'pip', label: 'Picture-in-Picture' },
                  { key: 'leave', label: 'Botão Sair' },
                  { key: 'header', label: 'Cabeçalho Superior' },
                ].map((item) => {
                  const isChecked = selectedButtons[item.key] ?? false;
                  return (
                    <button
                      key={item.key}
                      onClick={() => toggleButtonOption(item.key)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] flex items-center gap-1.5 transition-all cursor-pointer ${
                        isChecked
                          ? 'bg-[#1a73e8]/20 border-[#1a73e8] text-[#8ab4f8]'
                          : 'bg-[#101216] border-[#2c303c] text-[#6b7280] line-through'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isChecked ? 'bg-[#8ab4f8]' : 'bg-[#6b7280]'
                        }`}
                      />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Snippet Output Box */}
          <div className="relative rounded-2xl overflow-hidden bg-[#0e1013] border border-[#2d3139] shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 bg-[#16181d] border-b border-[#2d3139] text-xs">
              <span className="font-semibold text-white flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-[#8ab4f8]" />
                Snippet para {snippetLanguage.toUpperCase()}
              </span>
              <button
                onClick={() => copyText(getDynamicCodeSnippet(), 'snippet_main')}
                className="flex items-center gap-1.5 bg-[#252830] hover:bg-[#30343f] text-white px-3 py-1.5 rounded-lg border border-[#3b404d] transition-colors cursor-pointer"
              >
                {copiedKey === 'snippet_main' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'snippet_main' ? 'Copiado!' : 'Copiar Código'}</span>
              </button>
            </div>

            <pre className="p-5 text-xs font-mono text-[#e8eaed] overflow-x-auto leading-relaxed whitespace-pre-wrap">
              {getDynamicCodeSnippet()}
            </pre>
          </div>
        </div>
      )}

      {/* TAB 5: RECURSOS & IAS (COM LINKS GITHUB REQUISITADOS) */}
      {activeSubTab === 'sdk' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="bg-[#171920] p-5 rounded-2xl border border-[#282c37] flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Prompt para Assistentes de IA (ChatGPT, Claude, Cursor, Gemini)
              </h3>
              <p className="text-xs text-[#9aa0a6] leading-relaxed">
                Utilize a documentação em texto puro para que a IA gere código de integração perfeitamente tipado e com todas as opções WebRTC.
              </p>

              <div className="p-3 bg-[#101215] rounded-xl border border-[#2d3139] text-xs font-mono flex items-center justify-between gap-3">
                <div className="truncate text-purple-300">
                  {LLMS_RAW_URL}
                </div>
                <a
                  href={LLMS_RAW_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1 rounded-lg shrink-0 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Abrir llms.txt</span>
                </a>
              </div>

              <div className="p-3 bg-[#101215] rounded-xl border border-[#2d3139] text-xs font-mono flex items-center justify-between gap-3">
                <div className="truncate text-[#8ab4f8]">
                  {DOCS_RAW_URL}
                </div>
                <a
                  href={DOCS_RAW_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] bg-[#1a73e8] hover:bg-[#1558b0] text-white px-2.5 py-1 rounded-lg shrink-0 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Abrir docs.txt</span>
                </a>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="bg-[#171920] p-5 rounded-2xl border border-[#282c37] flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Download className="w-4 h-4 text-emerald-400" />
                Arquivos do SDK
              </h3>

              <div className="flex flex-col gap-2 text-xs">
                <a
                  href="/videomeet-sdk.js"
                  download="videomeet-sdk.js"
                  className="flex items-center justify-between p-3 rounded-xl bg-[#101215] hover:bg-[#1a1d24] border border-[#2d3139] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-[#8ab4f8]" />
                    <span className="text-white font-medium">videomeet-sdk.js</span>
                  </div>
                  <Download className="w-3.5 h-3.5 text-[#9aa0a6]" />
                </a>

                <a
                  href={LLMS_RAW_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl bg-[#101215] hover:bg-[#1a1d24] border border-[#2d3139] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-400" />
                    <span className="text-white font-medium">llms.txt (GitHub Raw)</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-[#9aa0a6]" />
                </a>

                <a
                  href={DOCS_RAW_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl bg-[#101215] hover:bg-[#1a1d24] border border-[#2d3139] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#8ab4f8]" />
                    <span className="text-white font-medium">docs.txt (GitHub Raw)</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-[#9aa0a6]" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
