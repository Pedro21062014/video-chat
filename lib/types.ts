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
  endedAt?: number;
  lastActive?: number;
  clearedAt?: number;
}
