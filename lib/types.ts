export interface Participant {
  userId: string;
  displayName: string;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  joinedAt: number;
  lastSeen: number;
  role: 'host' | 'guest';
  avatarColor: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isOwn?: boolean;
}

export interface FloatingReaction {
  id: string;
  emoji: string;
  senderName: string;
  senderId: string;
  timestamp: number;
  xOffset?: number;
}

export interface SignalMessage {
  id?: string;
  from: string;
  to: string;
  type: 'offer' | 'answer' | 'candidate';
  payload: string; // JSON string of RTCSessionDescriptionInit or RTCIceCandidateInit
  timestamp: number;
}

export interface RoomData {
  id: string;
  title: string;
  createdAt: number;
  createdBy: string;
  hostId?: string;
  hostName: string;
  status: 'active' | 'ended';
  endedAt?: number | null;
  lastActive?: number;
  clearedAt?: number;
}

export type VideoQualityId = '4k' | '1080p' | '720p' | '480p' | '360p' | '240p' | '144p';

export type NetworkQualityStatus = 'good' | 'fair' | 'poor';

export interface NetworkStatsInfo {
  status: NetworkQualityStatus;
  rtt: number;
  packetLoss: number;
  message?: string;
  advice?: string;
}

export interface VideoQualityOption {
  id: VideoQualityId;
  label: string;
  resolution: string;
  width: number;
  height: number;
  frameRate: number;
  bitrate: number; // in bps
  scaleResolutionDownBy: number;
  description: string;
}

export const VIDEO_QUALITIES: VideoQualityOption[] = [
  {
    id: '4k',
    label: '4K',
    resolution: '3840 × 2160',
    width: 3840,
    height: 2160,
    frameRate: 30,
    bitrate: 4500000,
    scaleResolutionDownBy: 1,
    description: 'Ultra HD • Máxima nitidez (conexões muito rápidas)',
  },
  {
    id: '1080p',
    label: '1080p',
    resolution: '1920 × 1080',
    width: 1920,
    height: 1080,
    frameRate: 30,
    bitrate: 2200000,
    scaleResolutionDownBy: 1,
    description: 'Full HD • Alta definição otimizada',
  },
  {
    id: '720p',
    label: '720p',
    resolution: '1280 × 720',
    width: 1280,
    height: 720,
    frameRate: 30,
    bitrate: 1100000,
    scaleResolutionDownBy: 1,
    description: 'HD (Recomendado) • Alta qualidade e fluidez em conexões comuns',
  },
  {
    id: '480p',
    label: '480p',
    resolution: '854 × 480',
    width: 854,
    height: 480,
    frameRate: 30,
    bitrate: 600000,
    scaleResolutionDownBy: 1.2,
    description: 'Definição padrão limpa • Excelente estabilidade em internet instável',
  },
  {
    id: '360p',
    label: '360p',
    resolution: '640 × 360',
    width: 640,
    height: 360,
    frameRate: 25,
    bitrate: 350000,
    scaleResolutionDownBy: 1.8,
    description: 'Econômico • Baixo consumo mantendo boa visibilidade',
  },
  {
    id: '240p',
    label: '240p',
    resolution: '426 × 240',
    width: 426,
    height: 240,
    frameRate: 20,
    bitrate: 200000,
    scaleResolutionDownBy: 2.5,
    description: 'Baixa resolução manual • Para redes extremamente limitadas',
  },
  {
    id: '144p',
    label: '144p',
    resolution: '256 × 144',
    width: 256,
    height: 144,
    frameRate: 15,
    bitrate: 90000,
    scaleResolutionDownBy: 4,
    description: 'Mínimo consumo manual • Apenas áudio com vídeo de emergência',
  },
];

export type AppMode = 'meeting' | 'stream';
export type StreamRole = 'sender' | 'viewer';

export interface StreamSessionInfo {
  roomCode: string;
  role: StreamRole;
  isEmbed?: boolean;
}

export interface StreamControlsOptions {
  mode?: 'all' | 'none' | 'custom';
  showHeader?: boolean;
  showToolbar?: boolean;
  audio?: boolean;
  video?: boolean;
  screenShare?: boolean;
  switchCamera?: boolean;
  quality?: boolean;
  fullscreen?: boolean;
  pip?: boolean;
  leave?: boolean;
  copyCode?: boolean;
  copyLink?: boolean;
  docs?: boolean;
  statusBadge?: boolean;
}



