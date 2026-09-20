'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  SwitchCamera,
  Keyboard,
  Shield,
  Volume2,
  AlertCircle,
} from 'lucide-react';
import { sound } from '@/lib/sound';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { checkCallLimit } from '@/lib/callsLimit';

const DEFAULT_PARTICIPANT_NAME = 'Participante';

interface LobbyProps {
  initialRoomId?: string;
  onJoinRoom: (
    roomId: string,
    displayName: string,
    initialAudioMuted: boolean,
    initialVideoMuted: boolean,
    selectedDeviceId?: string,
    isNewRoom?: boolean,
    existingStream?: MediaStream | null
  ) => void;
  notificationMessage?: string | null;
}

export const Lobby: React.FC<LobbyProps> = ({ initialRoomId, onJoinRoom, notificationMessage }) => {
  const [displayName, setDisplayName] = useState('');
  const [targetRoomId, setTargetRoomId] = useState(initialRoomId || '');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraRetryCount, setCameraRetryCount] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [currentClock, setCurrentClock] = useState('');
  const [currentDateStr, setCurrentDateStr] = useState('');
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const [isJoiningMeeting, setIsJoiningMeeting] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const isTransitioningToRoomRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Sync targetRoomId if initialRoomId is supplied or changes (e.g. from URL search params)
  useEffect(() => {
    if (initialRoomId) {
      const timer = setTimeout(() => {
        setTargetRoomId(initialRoomId);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [initialRoomId]);

  // Time & Date format Google Meet style (ex: 20:01 • sáb., 19 de set.)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentClock(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setCurrentDateStr(
        now.toLocaleDateString('pt-BR', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Generate random room code like avk-kuma-bwm
  const generateRoomCode = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    const segment = (len: number) =>
      Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${segment(3)}-${segment(4)}-${segment(3)}`;
  };

  // Enumerate cameras
  useEffect(() => {
    let active = true;
    navigator.mediaDevices?.enumerateDevices().then((devices) => {
      if (!active) return;
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      setVideoDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedCameraId) {
        setSelectedCameraId(videoInputs[0].deviceId);
      }
    }).catch(() => {});

    return () => {
      active = false;
    };
  }, [selectedCameraId]);

  // Audio visualizer on unmuted preview
  useEffect(() => {
    let audioStream: MediaStream | null = null;
    let isCancelled = false;

    if (isAudioMuted) {
      return;
    }

    navigator.mediaDevices?.getUserMedia({ audio: true }).then((stream) => {
      if (isCancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      audioStream = stream;
      try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioContextClass();
        audioContextRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyserRef.current = analyser;

        const source = ctx.createMediaStreamSource(stream);
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
        // ignore
      }
    }).catch(() => {});

    return () => {
      isCancelled = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
      if (audioStream) audioStream.getTracks().forEach((t) => t.stop());
    };
  }, [isAudioMuted]);

  // Bind previewStream to videoRef and play
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    if (previewStream && !isVideoMuted) {
      if (videoEl.srcObject !== previewStream) {
        videoEl.srcObject = previewStream;
      }
      videoEl.play().catch(() => {});
    } else {
      videoEl.srcObject = null;
    }
  }, [previewStream, isVideoMuted]);

  // Start local camera preview
  useEffect(() => {
    let active = true;

    async function startCamera() {
      if (isVideoMuted) {
        if (previewStreamRef.current) {
          previewStreamRef.current.getTracks().forEach((t) => t.stop());
          previewStreamRef.current = null;
        }
        setPreviewStream(null);
        return;
      }

      try {
        let stream: MediaStream;
        const videoConstraint = selectedCameraId
          ? { deviceId: { ideal: selectedCameraId } }
          : { facingMode: 'user' };

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: videoConstraint,
          });
        } catch {
          // Fallback: try basic video if ideal constraint fails
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true,
          });
        }

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        if (previewStreamRef.current) {
          previewStreamRef.current.getTracks().forEach((t) => t.stop());
        }
        previewStreamRef.current = stream;
        setPreviewStream(stream);
        setCameraError(null);

        // Update camera devices list now that permission is granted
        navigator.mediaDevices?.enumerateDevices().then((devices) => {
          if (!active) return;
          const videoInputs = devices.filter((d) => d.kind === 'videoinput' && d.deviceId);
          if (videoInputs.length > 0) {
            setVideoDevices(videoInputs);
          }
        }).catch(() => {});
      } catch (err) {
        console.warn('Lobby camera preview error:', err);
        setCameraError('Permissão de câmera não concedida ou câmera ocupada.');
      }
    }

    startCamera();

    return () => {
      active = false;
      // Do NOT destroy preview camera track if we are handing it off to the room
      if (!isTransitioningToRoomRef.current && previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach((t) => t.stop());
        previewStreamRef.current = null;
      }
    };
  }, [isVideoMuted, selectedCameraId, cameraRetryCount]);

  // Switch camera between front and back
  const handleSwitchCamera = () => {
    if (videoDevices.length <= 1) return;
    const currentIndex = videoDevices.findIndex((d) => d.deviceId === selectedCameraId);
    const nextIndex = (currentIndex + 1) % videoDevices.length;
    setSelectedCameraId(videoDevices[nextIndex].deviceId);
  };

  const handleStartInstantMeeting = async () => {
    if (isCreatingMeeting || isJoiningMeeting) return;
    setIsCreatingMeeting(true);
    setRoomError(null);

    // 1. Verify active calls limit (max 3 devices) - only applies to starting a new meeting
    try {
      const checkData = await checkCallLimit(true);
      if (!checkData.allowed) {
        setRoomError(
          checkData.message ||
            'O servidor está sobrecarregado. Por favor, aguarde um pouco antes de iniciar a próxima ligação.'
        );
        sound.playHangup();
        setIsCreatingMeeting(false);
        return;
      }
    } catch {
      // Proceed if check fails to not block users on network glitch
    }

    const code = generateRoomCode();
    const finalName = displayName.trim() || DEFAULT_PARTICIPANT_NAME;
    isTransitioningToRoomRef.current = true;
    sound.playJoin();
    onJoinRoom(code, finalName, isAudioMuted, isVideoMuted, selectedCameraId, true, previewStream);
  };

  const handleJoinExistingRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRoomId.trim() || isCreatingMeeting || isJoiningMeeting) return;
    setRoomError(null);
    setIsJoiningMeeting(true);

    try {
      // Participants joining an existing meeting are NOT blocked by the IP limit (only applies to new meetings)

      // 1. Extract clean room code from text or URL
      let cleanCode = targetRoomId.trim();
      if (cleanCode.includes('room=')) {
        try {
          const url = new URL(cleanCode.startsWith('http') ? cleanCode : `https://${cleanCode}`);
          cleanCode = url.searchParams.get('room') || cleanCode;
        } catch {
          const match = cleanCode.match(/room=([a-zA-Z0-9_-]+)/);
          if (match) cleanCode = match[1];
        }
      }
      cleanCode = cleanCode.toLowerCase().replace(/[^a-z0-9_-]/g, '');

      if (!cleanCode) {
        setRoomError('Informe um código de reunião ou link válido.');
        setIsJoiningMeeting(false);
        return;
      }

      // 2. Query Firestore to verify room existence
      const roomRef = doc(db, 'rooms', cleanCode);
      const snap = await getDoc(roomRef);

      if (!snap.exists()) {
        setRoomError('Esta reunião não existe ou não foi encontrada. Verifique o código e tente novamente.');
        sound.playHangup();
        setIsJoiningMeeting(false);
        return;
      }

      const roomData = snap.data();
      if (roomData?.status === 'ended') {
        setRoomError('Esta reunião já foi encerrada pelo organizador.');
        sound.playHangup();
        setIsJoiningMeeting(false);
        return;
      }

      // 3. Valid room exists - proceed to join
      const finalName = displayName.trim() || DEFAULT_PARTICIPANT_NAME;
      isTransitioningToRoomRef.current = true;
      sound.playJoin();
      onJoinRoom(cleanCode, finalName, isAudioMuted, isVideoMuted, selectedCameraId, false, previewStream);
    } catch (err) {
      console.error('Erro ao verificar sala:', err);
      setRoomError('Não foi possível verificar a sala no momento. Tente novamente.');
    } finally {
      setIsJoiningMeeting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-[#202124] text-[#e8eaed] font-sans antialiased">
      {/* Header with User's Logo and VideoMeet Branding */}
      <header className="w-full flex items-center justify-between px-6 py-4 border-b border-[#3c4043]/40">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3">
            {/* Custom Logo */}
            <div className="relative w-10 h-10 rounded-xl overflow-hidden shadow-sm flex items-center justify-center bg-[#28292c] border border-[#3c4043]/50">
              <Image
                src="/logo_video_bonito.png"
                alt="VideoMeet Logo"
                fill
                className="object-contain p-1"
                referrerPolicy="no-referrer"
                priority
              />
            </div>
            <div className="flex flex-col">
              <span className="text-[20px] font-semibold tracking-tight text-[#e8eaed] flex items-center gap-1">
                Video<span className="text-[#8ab4f8]">Meet</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[#9aa0a6] text-sm">
          {currentClock && (
            <div className="flex items-center gap-2">
              <span className="font-normal text-[#e8eaed]">{currentClock}</span>
              <span>•</span>
              <span className="capitalize">{currentDateStr}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Container: VideoMeet Homepage Layout */}
      <main className="w-full max-w-7xl mx-auto px-6 py-8 my-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
        {/* Left: VideoMeet Action & Typography */}
        <div className="lg:col-span-6 flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-normal leading-[1.15] text-[#e8eaed] tracking-tight">
              Videochamadas premium. Agora gratuitas para todos.
            </h1>
            <p className="text-base sm:text-lg text-[#9aa0a6] font-normal leading-relaxed max-w-xl">
              Criamos o VideoMeet para que todos possam se conectar, colaborar e comemorar com segurança e estabilidade de qualquer lugar.
            </p>
          </div>

          {/* Notification banner (e.g. call ended by host) */}
          {notificationMessage && (
            <div className="bg-[#ea4335]/15 border border-[#ea4335]/40 text-[#f28b82] px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 max-w-md animate-fadeIn">
              <Shield className="w-4 h-4 text-[#ea4335] shrink-0" />
              <span>{notificationMessage}</span>
            </div>
          )}

          {/* Room Not Found / Error Banner */}
          {roomError && (
            <div
              id="alert-room-not-found"
              className="bg-[#ea4335]/15 border border-[#ea4335]/40 text-[#f28b82] px-4 py-3 rounded-lg text-sm flex items-start gap-2.5 max-w-md animate-fadeIn"
            >
              <AlertCircle className="w-4 h-4 text-[#ea4335] shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <span className="font-medium text-white text-xs">Aviso</span>
                <span className="text-xs text-[#f28b82]">{roomError}</span>
              </div>
            </div>
          )}

          {/* User Name Input */}
          <div className="flex flex-col gap-1.5 max-w-md">
            <label htmlFor="input-display-name" className="text-xs text-[#9aa0a6] font-medium">
              Seu nome na reunião
            </label>
            <input
              id="input-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Digite seu nome (opcional • padrão: Participante)"
              suppressHydrationWarning
              className="w-full bg-[#202124] border border-[#5f6368] focus:border-[#8ab4f8] rounded-md px-3.5 py-2.5 text-sm text-[#e8eaed] placeholder-[#80868b] focus:outline-none transition-colors"
            />
          </div>

          {/* Action Row: White Instant Meeting Button + Code Input */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            {/* "Nova reunião" Button with Skeleton Loader */}
            {isCreatingMeeting ? (
              <div
                id="btn-create-meeting-skeleton"
                aria-label="Iniciando reunião..."
                className="h-12 w-44 rounded-full bg-[#3c4043] animate-pulse flex items-center justify-center gap-2.5 px-6 shrink-0 border border-white/10 select-none shadow-sm"
              >
                <div className="w-4 h-4 rounded-full bg-[#80868b] animate-pulse" />
                <div className="h-4 w-20 rounded bg-[#80868b] animate-pulse" />
              </div>
            ) : (
              <button
                id="btn-create-instant-meeting"
                type="button"
                onClick={handleStartInstantMeeting}
                disabled={isJoiningMeeting}
                className="h-12 px-6 rounded-full bg-white hover:bg-[#f1f3f4] active:bg-[#e8eaed] text-[#202124] font-medium text-sm flex items-center justify-center gap-2.5 shadow-sm transition-all shrink-0 cursor-pointer disabled:opacity-50"
              >
                <Video className="w-4 h-4 text-[#202124]" />
                <span>Nova reunião</span>
              </button>
            )}

            {/* Input Room Code / Join Form */}
            <form onSubmit={handleJoinExistingRoom} className="flex-1 flex items-center gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9aa0a6]">
                  <Keyboard className="w-4 h-4" />
                </div>
                <input
                  id="input-room-code"
                  type="text"
                  value={targetRoomId}
                  onChange={(e) => {
                    setTargetRoomId(e.target.value);
                    if (roomError) setRoomError(null);
                  }}
                  placeholder="Digite um código ou link"
                  disabled={isCreatingMeeting || isJoiningMeeting}
                  className="w-full h-12 pl-10 pr-3.5 bg-transparent border border-[#5f6368] focus:border-[#8ab4f8] rounded-md text-sm text-[#e8eaed] placeholder-[#80868b] focus:outline-none transition-colors disabled:opacity-50"
                />
              </div>

              {targetRoomId.trim() && (
                <button
                  id="btn-join-existing-room"
                  type="submit"
                  disabled={isCreatingMeeting || isJoiningMeeting}
                  className="h-12 px-5 rounded-md text-[#8ab4f8] hover:bg-[#8ab4f8]/10 text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isJoiningMeeting ? (
                    <div className="w-4 h-4 rounded-full border-2 border-[#8ab4f8] border-t-transparent animate-spin" />
                  ) : null}
                  <span>Participar</span>
                </button>
              )}
            </form>
          </div>

          <div className="h-px bg-[#3c4043] w-full max-w-md my-1" />

          <div className="flex items-center gap-2 text-xs text-[#9aa0a6]">
            <Shield className="w-4 h-4 text-[#8ab4f8]" />
            <span>Suas reuniões são criptografadas e seguras ponto a ponto (WebRTC).</span>
          </div>
        </div>

        {/* Right: Camera Preview Container exactly like Meet Green Room */}
        <div className="lg:col-span-6 flex flex-col items-center justify-center w-full">
          <div className="relative w-full max-w-lg aspect-video rounded-lg overflow-hidden bg-[#000000] border border-[#3c4043] shadow-2xl flex items-center justify-center">
            {/* Live Video Preview */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-200 ${
                !isVideoMuted && previewStream ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
              }`}
            />

            {/* Inactive Video State / Clean Meet Avatar */}
            {(isVideoMuted || !previewStream) && (
              <div className="flex flex-col items-center justify-center gap-3 select-none">
                <div className="w-20 h-20 rounded-full bg-[#1a73e8] flex items-center justify-center text-white text-3xl font-medium shadow-md">
                  {displayName.trim() ? displayName.charAt(0).toUpperCase() : 'P'}
                </div>
                <span className="text-xs text-[#9aa0a6]">Câmera desativada</span>
              </div>
            )}

            {/* Camera error indicator */}
            {cameraError && !isVideoMuted && (
              <div className="absolute inset-0 bg-[#202124]/90 flex flex-col items-center justify-center p-6 text-center z-10">
                <p className="text-xs text-[#f28b82] max-w-xs">{cameraError}</p>
                <div className="flex items-center gap-3 mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCameraError(null);
                      setCameraRetryCount((c) => c + 1);
                    }}
                    className="text-xs text-[#8ab4f8] hover:underline font-medium cursor-pointer"
                  >
                    Tentar novamente
                  </button>
                  <span className="text-[#5f6368]">•</span>
                  <button
                    type="button"
                    onClick={() => setIsVideoMuted(true)}
                    className="text-xs text-[#9aa0a6] hover:underline cursor-pointer"
                  >
                    Continuar sem câmera
                  </button>
                </div>
              </div>
            )}

            {/* Audio Indicator Badge in Preview */}
            {!isAudioMuted && (
              <div className="absolute top-3 left-3 bg-[#202124]/80 backdrop-blur-sm px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-[#3c4043]">
                <Volume2 className="w-3.5 h-3.5 text-[#81c995]" />
                <div className="flex items-end gap-0.5 h-3">
                  <span
                    className="w-0.5 bg-[#81c995] rounded-full transition-all duration-75"
                    style={{ height: `${Math.max(3, (audioLevel * 12) / 100)}px` }}
                  />
                  <span
                    className="w-0.5 bg-[#81c995] rounded-full transition-all duration-75"
                    style={{ height: `${Math.max(3, (audioLevel * 15) / 100)}px` }}
                  />
                  <span
                    className="w-0.5 bg-[#81c995] rounded-full transition-all duration-75"
                    style={{ height: `${Math.max(3, (audioLevel * 9) / 100)}px` }}
                  />
                </div>
              </div>
            )}

            {/* Preview Controls Bar: Round Meet Dark Buttons */}
            <div className="absolute bottom-4 flex items-center gap-3">
              <button
                id="btn-preview-toggle-audio"
                type="button"
                onClick={() => {
                  sound.playToggleMute(!isAudioMuted);
                  setIsAudioMuted(!isAudioMuted);
                }}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  isAudioMuted
                    ? 'bg-[#ea4335] text-white hover:bg-[#d93025]'
                    : 'bg-[#3c4043] text-white hover:bg-[#474a4d]'
                }`}
                title={isAudioMuted ? 'Ativar microfone' : 'Desativar microfone'}
              >
                {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <button
                id="btn-preview-toggle-video"
                type="button"
                onClick={() => setIsVideoMuted(!isVideoMuted)}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  isVideoMuted
                    ? 'bg-[#ea4335] text-white hover:bg-[#d93025]'
                    : 'bg-[#3c4043] text-white hover:bg-[#474a4d]'
                }`}
                title={isVideoMuted ? 'Ligar câmera' : 'Desligar câmera'}
              >
                {isVideoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </button>

              {videoDevices.length > 1 && (
                <button
                  id="btn-preview-switch-camera"
                  type="button"
                  onClick={handleSwitchCamera}
                  className="w-11 h-11 rounded-full flex items-center justify-center bg-[#3c4043] hover:bg-[#474a4d] text-white transition-all cursor-pointer"
                  title="Alternar câmera"
                >
                  <SwitchCamera className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
          <span className="text-xs text-[#9aa0a6] mt-3">Verifique seu áudio e vídeo antes de entrar</span>
        </div>
      </main>

      {/* VideoMeet Minimal Footer */}
      <footer className="w-full px-6 py-4 flex items-center justify-between text-xs text-[#9aa0a6] border-t border-[#3c4043]/30">
        <div className="flex items-center gap-2">
          <div className="relative w-4 h-4 rounded overflow-hidden">
            <Image
              src="/logo_video_bonito.png"
              alt="VideoMeet"
              fill
              className="object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <span>VideoMeet • Videochamadas instantâneas sem login</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Privacidade</span>
          <span>Termos</span>
        </div>
      </footer>
    </div>
  );
};
