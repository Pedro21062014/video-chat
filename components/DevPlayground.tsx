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
  Square,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Code2,
  Tv,
  Layers,
  Settings,
  Radio,
  Sliders,
  Terminal,
  Activity,
  Maximize2,
  Minimize2,
  Sparkles,
  ShieldCheck,
  Download,
  Share2,
  Monitor,
  Volume2,
  HelpCircle,
  FileText,
  Smartphone,
  Eye,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { AppMode, StreamRole, VIDEO_QUALITIES, VideoQualityId } from '@/lib/types';
import { sound } from '@/lib/sound';

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
  const [activeSubTab, setActiveSubTab] = useState<'broadcast' | 'playground' | 'snippets' | 'sdk'>('broadcast');

  // Broadcast Creator State
  const [roomCode, setRoomCode] = useState(() => initialRoomCode || 'dev-stream-01');
  const [sourceType, setSourceType] = useState<'camera' | 'screen'>('camera');
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<VideoQualityId>('720p');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
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
  const [snippetLanguage, setSnippetLanguage] = useState<'iframe' | 'react' | 'js_sdk' | 'obs' | 'nextjs'>('iframe');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Live Signaling Logs for Dev console
  const [eventLogs, setEventLogs] = useState<Array<{ time: string; text: string; type: 'info' | 'success' | 'warn' }>>([
    { time: '12:00:00', text: 'Dev Playground inicializado com sucesso.', type: 'info' },
    { time: '12:00:01', text: 'Protocolo WebRTC P2P pronto.', type: 'success' },
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
  const meetingUrl = `${baseUrl}/?room=${cleanRoomCode}&embed=true`;

  const addLog = (text: string, type: 'info' | 'success' | 'warn' = 'info') => {
    const now = new Date().toLocaleTimeString();
    setEventLogs((prev) => [{ time: now, text, type }, ...prev.slice(0, 19)]);
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
    navigator.mediaDevices?.enumerateDevices().then((devices) => {
      if (!active) return;
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      setAvailableCameras(videoInputs);
      if (videoInputs.length > 0 && !selectedCameraId) {
        setSelectedCameraId(videoInputs[0].deviceId);
      }
    }).catch(() => {});

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
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
          // Handle screen share end by user
          stream.getVideoTracks()[0].onended = () => {
            setSourceType('camera');
            addLog('Compartilhamento de tela finalizado pelo usuário.', 'info');
          };
          addLog(`Captura de tela iniciada (${targetOpt.label}).`, 'success');
        } else {
          const videoConstraints: MediaTrackConstraints = selectedCameraId
            ? { deviceId: { exact: selectedCameraId }, width: { ideal: targetOpt.width }, height: { ideal: targetOpt.height } }
            : { facingMode: 'user', width: { ideal: targetOpt.width }, height: { ideal: targetOpt.height } };

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
      el.srcObject = previewStream;
      el.play().catch(() => {});
    } else {
      el.srcObject = null;
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
    const targetViewerUrl = `${baseUrl}/?mode=stream&role=viewer&room=${targetRoom}&embed=true`;
    const targetSenderUrl = `${baseUrl}/?mode=stream&role=sender&room=${targetRoom}&embed=true&quality=${selectedQuality}`;
    const targetMeetingUrl = `${baseUrl}/?room=${targetRoom}&embed=true`;

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
  const viewerUrl = \`${baseUrl}/?mode=stream&role=viewer&room=\${encodeURIComponent(roomCode)}&embed=true\`;

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
  const streamUrl = \`${baseUrl}/?mode=stream&role=viewer&room=\${room}&quality=\${quality}&embed=true\`;

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
  // Inicialização em 1 linha
  const player = VideoMeet.createViewer({
    container: '#meu-player-video',
    roomCode: '${targetRoom}',
    baseUrl: '${baseUrl}',
    borderRadius: '16px'
  });

  console.log('Player inicializado na sala:', player.roomCode);
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
  )}`;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6 text-[#e8eaed] font-sans antialiased">
      {/* Top Banner: Dev & Playground Title with Quick Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#2d3139]">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#1a73e8] to-[#8ab4f8] flex items-center justify-center text-white shadow-lg">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
                Dev Hub & Camera Sharing Playground
              </h1>
              <span className="text-[11px] bg-[#1a73e8]/20 text-[#8ab4f8] px-2.5 py-0.5 rounded-full font-medium border border-[#1a73e8]/30">
                P2P WebRTC Engine
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#9aa0a6] mt-0.5">
              Crie transmissões de câmera, teste em tempo real no sandbox e gere código para Iframe, React e OBS.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenDocs}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#282b33] hover:bg-[#323640] text-[#8ab4f8] hover:text-white text-xs font-medium border border-[#373c47] transition-all shadow-sm cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Documentação Completa</span>
          </button>

          <a
            href="/videomeet-sdk.js"
            download="videomeet-sdk.js"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1a73e8] hover:bg-[#1558b0] text-white text-xs font-medium shadow-md transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Baixar SDK JS</span>
          </a>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-[#1c1e24] rounded-xl border border-[#2d3139] overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('broadcast')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'broadcast'
              ? 'bg-[#282b33] text-white shadow-sm border border-[#3b404d]'
              : 'text-[#9aa0a6] hover:text-white'
          }`}
        >
          <Radio className="w-4 h-4 text-[#8ab4f8]" />
          <span>1. Criar Transmissão de Câmera</span>
        </button>

        <button
          onClick={() => setActiveSubTab('playground')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'playground'
              ? 'bg-[#282b33] text-white shadow-sm border border-[#3b404d]'
              : 'text-[#9aa0a6] hover:text-white'
          }`}
        >
          <Sliders className="w-4 h-4 text-emerald-400" />
          <span>2. Playground & Sandbox Interativo</span>
        </button>

        <button
          onClick={() => setActiveSubTab('snippets')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'snippets'
              ? 'bg-[#282b33] text-white shadow-sm border border-[#3b404d]'
              : 'text-[#9aa0a6] hover:text-white'
          }`}
        >
          <Code2 className="w-4 h-4 text-purple-400" />
          <span>3. Gerador de Código & Snippets</span>
        </button>

        <button
          onClick={() => setActiveSubTab('sdk')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'sdk'
              ? 'bg-[#282b33] text-white shadow-sm border border-[#3b404d]'
              : 'text-[#9aa0a6] hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>4. SDK JS & Recursos</span>
        </button>
      </div>

      {/* TAB 1: CRIAR TRANSMISSÃO DE CÂMERA */}
      {activeSubTab === 'broadcast' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Configuration & Controls */}
          <div className="lg:col-span-5 flex flex-col gap-4 bg-[#181a1f] p-5 sm:p-6 rounded-2xl border border-[#2d3139] shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#2d3139]">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#8ab4f8]" />
                <h2 className="text-sm font-semibold text-white">Configurar Transmissão</h2>
              </div>
              <button
                onClick={generateNewRoomCode}
                className="text-[11px] text-[#8ab4f8] hover:text-[#aecbfa] flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Novo Código</span>
              </button>
            </div>

            {/* Room / Channel Code Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#9aa0a6] font-medium flex items-center justify-between">
                <span>Código do Canal / Pareamento (ID)</span>
                <span className="text-[10px] text-[#8ab4f8]">P2P Token</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  placeholder="ex: camera-estudio-01"
                  className="flex-1 bg-[#101215] border border-[#3b404d] focus:border-[#8ab4f8] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white font-mono focus:outline-none transition-colors"
                />
                <button
                  onClick={() => copyText(roomCode, 'code')}
                  className="p-2.5 bg-[#252830] hover:bg-[#30343f] text-[#9aa0a6] hover:text-white rounded-xl border border-[#3b404d] transition-colors cursor-pointer"
                  title="Copiar código"
                >
                  {copiedKey === 'code' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Video Source Selector (Camera vs Screen) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#9aa0a6] font-medium">Origem do Vídeo</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSourceType('camera')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                    sourceType === 'camera'
                      ? 'bg-[#1a73e8]/20 border-[#1a73e8] text-white'
                      : 'bg-[#101215] border-[#2d3139] text-[#9aa0a6] hover:text-white'
                  }`}
                >
                  <Video className="w-4 h-4 text-[#8ab4f8]" />
                  <span>Câmera / Webcam</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType('screen')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                    sourceType === 'screen'
                      ? 'bg-[#1a73e8]/20 border-[#1a73e8] text-white'
                      : 'bg-[#101215] border-[#2d3139] text-[#9aa0a6] hover:text-white'
                  }`}
                >
                  <Monitor className="w-4 h-4 text-purple-400" />
                  <span>Tela / Janela (OBS)</span>
                </button>
              </div>
            </div>

            {/* Camera Device Dropdown (if camera selected) */}
            {sourceType === 'camera' && availableCameras.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[#9aa0a6] font-medium">Dispositivo de Câmera</label>
                <select
                  value={selectedCameraId}
                  onChange={(e) => setSelectedCameraId(e.target.value)}
                  className="bg-[#101215] border border-[#3b404d] focus:border-[#8ab4f8] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  {availableCameras.map((cam, idx) => (
                    <option key={cam.deviceId || idx} value={cam.deviceId}>
                      {cam.label || `Câmera ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Quality & Resolution Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#9aa0a6] font-medium flex items-center justify-between">
                <span>Qualidade de Transmissão</span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  {VIDEO_QUALITIES.find((q) => q.id === selectedQuality)?.resolution}
                </span>
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {VIDEO_QUALITIES.slice(0, 4).map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setSelectedQuality(q.id)}
                    className={`py-2 px-1 text-center rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      selectedQuality === q.id
                        ? 'bg-[#1a73e8] text-white shadow-sm font-semibold'
                        : 'bg-[#101215] text-[#9aa0a6] hover:text-white border border-[#2d3139]'
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Audio & Video Toggles */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAudioMuted(!isAudioMuted)}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                  isAudioMuted
                    ? 'bg-[#ea4335]/15 border-[#ea4335]/40 text-[#f28b82]'
                    : 'bg-[#101215] border-[#2d3139] text-[#81c995]'
                }`}
              >
                {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>{isAudioMuted ? 'Microfone Mudo' : 'Áudio Ativo'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsVideoMuted(!isVideoMuted)}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                  isVideoMuted
                    ? 'bg-[#ea4335]/15 border-[#ea4335]/40 text-[#f28b82]'
                    : 'bg-[#101215] border-[#2d3139] text-[#8ab4f8]'
                }`}
              >
                {isVideoMuted ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                <span>{isVideoMuted ? 'Vídeo Desligado' : 'Vídeo Ativo'}</span>
              </button>
            </div>

            {/* Primary Action: Launch Transmission Button */}
            <button
              type="button"
              onClick={handleLaunchBroadcast}
              className="w-full mt-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#1a73e8] to-[#1558b0] hover:brightness-110 active:scale-[0.99] text-white font-semibold text-sm shadow-xl flex items-center justify-center gap-2.5 transition-all cursor-pointer"
            >
              <Radio className="w-5 h-5 text-white animate-pulse" />
              <span>Iniciar Transmissão de Câmera Agora</span>
            </button>

            {/* Shareable Links Bar */}
            <div className="flex flex-col gap-2 pt-2 border-t border-[#2d3139]">
              <span className="text-[11px] text-[#9aa0a6] font-medium">Links Rápidos para Compartilhar:</span>
              <div className="flex items-center justify-between p-2.5 bg-[#101215] rounded-xl border border-[#2d3139] text-xs">
                <span className="text-[#8ab4f8] font-mono truncate max-w-[220px]">
                  {viewerDirectUrl}
                </span>
                <button
                  onClick={() => copyText(viewerDirectUrl, 'viewer_link')}
                  className="text-[11px] text-[#8ab4f8] hover:text-white flex items-center gap-1 bg-[#1f222a] px-2 py-1 rounded-lg border border-[#3b404d] transition-colors cursor-pointer"
                >
                  {copiedKey === 'viewer_link' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'viewer_link' ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Live Camera Preview & Real-Time Stats */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {/* Live Video Preview Box */}
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-[#2d3139] shadow-2xl flex items-center justify-center group">
              <video
                ref={videoPreviewRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${
                  sourceType === 'camera' ? 'scale-x-[-1]' : ''
                } transition-opacity duration-200 ${
                  !isVideoMuted && previewStream ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
                }`}
              />

              {/* Offline / Inactive State */}
              {(isVideoMuted || !previewStream) && (
                <div className="flex flex-col items-center justify-center gap-3 p-6 text-center select-none">
                  <div className="w-16 h-16 rounded-full bg-[#1a73e8]/20 border border-[#1a73e8]/40 flex items-center justify-center text-[#8ab4f8]">
                    <VideoOff className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-white">Visualização Pausada</span>
                    <p className="text-xs text-[#9aa0a6] mt-1">Ative o vídeo para visualizar sua câmera ao vivo.</p>
                  </div>
                </div>
              )}

              {/* Camera Live Indicator Tag */}
              {!isVideoMuted && previewStream && (
                <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2 text-xs text-white">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-medium">Preview Local Ativo</span>
                  <span className="text-[#9aa0a6]">•</span>
                  <span className="text-[#8ab4f8] font-mono">{selectedQuality}</span>
                </div>
              )}

              {/* Audio Level Indicator */}
              {!isAudioMuted && previewStream && (
                <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 flex items-center gap-1.5 text-xs text-emerald-400">
                  <Volume2 className="w-3.5 h-3.5" />
                  <div className="flex items-end gap-0.5 h-3">
                    <span
                      className="w-1 bg-emerald-400 rounded-full transition-all duration-75"
                      style={{ height: `${Math.max(3, (audioLevel * 12) / 100)}px` }}
                    />
                    <span
                      className="w-1 bg-emerald-400 rounded-full transition-all duration-75"
                      style={{ height: `${Math.max(3, (audioLevel * 15) / 100)}px` }}
                    />
                    <span
                      className="w-1 bg-emerald-400 rounded-full transition-all duration-75"
                      style={{ height: `${Math.max(3, (audioLevel * 8) / 100)}px` }}
                    />
                  </div>
                </div>
              )}

              {/* Quick Switch Camera Button on Video Overlay */}
              {availableCameras.length > 1 && sourceType === 'camera' && (
                <button
                  type="button"
                  onClick={handleSwitchCamera}
                  className="absolute bottom-3 right-3 bg-black/70 hover:bg-black text-white p-2.5 rounded-full border border-white/15 transition-all shadow-lg cursor-pointer"
                  title="Alternar Câmera"
                >
                  <SwitchCamera className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* WebRTC Live Telemetry & Event Log Box */}
            <div className="bg-[#181a1f] p-4 sm:p-5 rounded-2xl border border-[#2d3139] flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-white">Telemetria & Console de Eventos WebRTC</span>
                </div>
                <span className="text-[11px] text-[#9aa0a6] font-mono">Signaling: Firestore P2P</span>
              </div>

              {/* Event Logs List */}
              <div className="bg-[#101215] p-3 rounded-xl border border-[#2d3139] font-mono text-[11px] flex flex-col gap-1.5 max-h-36 overflow-y-auto">
                {eventLogs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-[#9aa0a6] shrink-0">[{log.time}]</span>
                    <span
                      className={
                        log.type === 'success'
                          ? 'text-emerald-400'
                          : log.type === 'warn'
                          ? 'text-[#ea4335]'
                          : 'text-[#8ab4f8]'
                      }
                    >
                      {log.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PLAYGROUND & SANDBOX INTERATIVO */}
      {activeSubTab === 'playground' && (
        <div className="flex flex-col gap-5">
          {/* Playground Top Controls Bar */}
          <div className="bg-[#181a1f] p-4 rounded-2xl border border-[#2d3139] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[#9aa0a6] font-medium">Modo:</span>
                <select
                  value={sandboxMode}
                  onChange={(e) => setSandboxMode(e.target.value as 'stream' | 'meeting')}
                  className="bg-[#101215] border border-[#3b404d] rounded-lg px-2.5 py-1.5 text-white focus:outline-none"
                >
                  <option value="stream">Transmissão P2P (Stream)</option>
                  <option value="meeting">Reunião Completa (Meeting)</option>
                </select>
              </div>

              {sandboxMode === 'stream' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[#9aa0a6] font-medium">Papel:</span>
                  <select
                    value={sandboxRole}
                    onChange={(e) => setSandboxRole(e.target.value as StreamRole)}
                    className="bg-[#101215] border border-[#3b404d] rounded-lg px-2.5 py-1.5 text-white focus:outline-none"
                  >
                    <option value="viewer">Receptor (Viewer / Assistir)</option>
                    <option value="sender">Transmissor (Sender / Câmera)</option>
                  </select>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <span className="text-[#9aa0a6] font-medium">Qualidade:</span>
                <select
                  value={sandboxQuality}
                  onChange={(e) => setSandboxQuality(e.target.value as VideoQualityId)}
                  className="bg-[#101215] border border-[#3b404d] rounded-lg px-2.5 py-1.5 text-white focus:outline-none"
                >
                  <option value="1080p">1080p (Full HD)</option>
                  <option value="720p">720p (HD Padrão)</option>
                  <option value="480p">480p (Econômico)</option>
                  <option value="360p">360p (Baixo Consumo)</option>
                </select>
              </div>

              <label className="flex items-center gap-1.5 text-[#9aa0a6] cursor-pointer">
                <input
                  type="checkbox"
                  checked={sandboxEmbed}
                  onChange={(e) => setSandboxEmbed(e.target.checked)}
                  className="rounded border-[#3b404d] text-[#1a73e8]"
                />
                <span>Embed Limpo</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSplitViewMode(!splitViewMode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                  splitViewMode
                    ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                    : 'bg-[#252830] border-[#3b404d] text-[#9aa0a6] hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{splitViewMode ? 'Visão Dupla (Sender + Viewer)' : 'Visão Única'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIframeReloadKey((k) => k + 1)}
                className="flex items-center gap-1.5 bg-[#252830] hover:bg-[#30343f] text-white px-3 py-1.5 rounded-lg border border-[#3b404d] transition-colors cursor-pointer"
                title="Recarregar Sandbox"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Recarregar</span>
              </button>
            </div>
          </div>

          {/* Sandbox Live Viewport */}
          {splitViewMode ? (
            /* Split View: Sender on Left, Viewer on Right */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left: Sender Iframe */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs px-1 text-[#9aa0a6]">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-[#8ab4f8]" />
                    Transmissor (Câmera Local)
                  </span>
                  <span className="font-mono text-[11px] text-[#8ab4f8]">role=sender</span>
                </div>
                <div className="relative w-full h-[460px] rounded-2xl overflow-hidden bg-[#0c0d10] border border-[#2d3139] shadow-2xl">
                  <iframe
                    key={`sender-${iframeReloadKey}`}
                    src={`${baseUrl}/?mode=stream&role=sender&room=${cleanRoomCode}&embed=true&quality=${sandboxQuality}`}
                    className="w-full h-full border-0"
                    allow="camera; microphone; display-capture; autoplay; fullscreen"
                    allowFullScreen
                  />
                </div>
              </div>

              {/* Right: Viewer Iframe */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs px-1 text-[#9aa0a6]">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Tv className="w-3.5 h-3.5 text-emerald-400" />
                    Receptor (Visualização Remota)
                  </span>
                  <span className="font-mono text-[11px] text-emerald-400">role=viewer</span>
                </div>
                <div className="relative w-full h-[460px] rounded-2xl overflow-hidden bg-[#0c0d10] border border-[#2d3139] shadow-2xl">
                  <iframe
                    key={`viewer-${iframeReloadKey}`}
                    src={`${baseUrl}/?mode=stream&role=viewer&room=${cleanRoomCode}&embed=true`}
                    className="w-full h-full border-0"
                    allow="camera; microphone; display-capture; autoplay; fullscreen"
                    allowFullScreen
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Single Sandbox Iframe */
            <div className="relative w-full h-[540px] rounded-2xl overflow-hidden bg-[#0c0d10] border border-[#2d3139] shadow-2xl">
              <iframe
                key={`sandbox-${iframeReloadKey}`}
                src={sandboxGeneratedUrl}
                className="w-full h-full border-0"
                allow="camera; microphone; display-capture; autoplay; fullscreen"
                allowFullScreen
              />
            </div>
          )}

          {/* Sandbox URL Output Bar */}
          <div className="bg-[#181a1f] p-3.5 rounded-xl border border-[#2d3139] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 overflow-hidden w-full">
              <span className="text-[#9aa0a6] font-medium shrink-0">URL Sandbox:</span>
              <span className="text-emerald-400 font-mono truncate">{sandboxGeneratedUrl}</span>
            </div>
            <button
              onClick={() => copyText(sandboxGeneratedUrl, 'sandbox_url')}
              className="flex items-center gap-1.5 bg-[#252830] hover:bg-[#30343f] text-white px-3 py-1.5 rounded-lg border border-[#3b404d] transition-colors cursor-pointer shrink-0"
            >
              {copiedKey === 'sandbox_url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'sandbox_url' ? 'Copiado!' : 'Copiar URL'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: GERADOR DE CÓDIGO & SNIPPETS */}
      {activeSubTab === 'snippets' && (
        <div className="flex flex-col gap-4">
          {/* Framework Language Selector */}
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
              OBS Studio / Browser Source
            </button>
          </div>

          {/* Snippet Code Box */}
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

      {/* TAB 4: SDK JS & RECURSOS */}
      {activeSubTab === 'sdk' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="bg-[#181a1f] p-5 rounded-2xl border border-[#2d3139] flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Code2 className="w-4 h-4 text-[#8ab4f8]" />
                API do SDK JavaScript (`videomeet-sdk.js`)
              </h3>
              <p className="text-xs text-[#9aa0a6] leading-relaxed">
                O arquivo <code className="text-[#8ab4f8] bg-[#101215] px-1.5 py-0.5 rounded">videomeet-sdk.js</code> expõe o objeto global <code className="text-[#8ab4f8]">VideoMeet</code> para integração direta sem necessidade de instalar pacotes npm complexos.
              </p>

              <div className="space-y-3 pt-2 text-xs">
                <div className="p-3 bg-[#101215] rounded-xl border border-[#2d3139]">
                  <span className="font-mono text-[#8ab4f8] font-semibold">VideoMeet.createViewer(options)</span>
                  <p className="text-[#9aa0a6] mt-1 text-[11px]">
                    Cria e anexa o iframe receptor para exibir a transmissão de uma câmera remota pareada pelo código.
                  </p>
                </div>

                <div className="p-3 bg-[#101215] rounded-xl border border-[#2d3139]">
                  <span className="font-mono text-[#8ab4f8] font-semibold">VideoMeet.createSender(options)</span>
                  <p className="text-[#9aa0a6] mt-1 text-[11px]">
                    Cria o emissor para que o usuário compartilhe sua câmera ou tela no código especificado.
                  </p>
                </div>

                <div className="p-3 bg-[#101215] rounded-xl border border-[#2d3139]">
                  <span className="font-mono text-[#8ab4f8] font-semibold">VideoMeet.createCall(options)</span>
                  <p className="text-[#9aa0a6] mt-1 text-[11px]">
                    Inicia uma videoconferência completa com múltiplos participantes, chat e áudio/vídeo bidirecional.
                  </p>
                </div>

                <div className="p-3 bg-[#101215] rounded-xl border border-[#2d3139]">
                  <span className="font-mono text-[#8ab4f8] font-semibold">VideoMeet.generateCode()</span>
                  <p className="text-[#9aa0a6] mt-1 text-[11px]">
                    Gera um código aleatório no padrão <code className="text-white">abc-defg-hij</code>.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="bg-[#181a1f] p-5 rounded-2xl border border-[#2d3139] flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Download className="w-4 h-4 text-emerald-400" />
                Recursos para Download
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
                  href="/llms.txt"
                  target="_blank"
                  className="flex items-center justify-between p-3 rounded-xl bg-[#101215] hover:bg-[#1a1d24] border border-[#2d3139] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-400" />
                    <span className="text-white font-medium">llms.txt (Prompt para IAs)</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-[#9aa0a6]" />
                </a>

                <a
                  href="/docs.txt"
                  target="_blank"
                  className="flex items-center justify-between p-3 rounded-xl bg-[#101215] hover:bg-[#1a1d24] border border-[#2d3139] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#8ab4f8]" />
                    <span className="text-white font-medium">docs.txt (Doc Completa em TXT)</span>
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
