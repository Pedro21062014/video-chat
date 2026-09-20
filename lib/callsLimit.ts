import { db } from './firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';

const MAX_CALLS_PER_SESSION = 3;
const STALE_TIMEOUT_MS = 45000; // 45 seconds without heartbeat = stale session

function getClientId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    let id = localStorage.getItem('videomeet_client_id');
    if (!id) {
      id = 'cli_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
      localStorage.setItem('videomeet_client_id', id);
    }
    return id;
  } catch {
    return 'anon_' + Date.now();
  }
}

function sanitizeDocId(clientId: string, userId: string): string {
  const cleanClient = clientId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanUser = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `cli_${cleanClient}_${cleanUser}`;
}

export async function checkCallLimit(isNewRoom: boolean): Promise<{
  allowed: boolean;
  activeCount: number;
  maxAllowed: number;
  message?: string;
}> {
  try {
    if (!isNewRoom) {
      return { allowed: true, activeCount: 0, maxAllowed: MAX_CALLS_PER_SESSION };
    }

    const clientId = getClientId();
    const colRef = collection(db, 'ip_active_calls');
    const q = query(colRef, where('clientId', '==', clientId));
    const snap = await getDocs(q);

    const now = Date.now();
    const activeUsers = new Set<string>();
    const deletePromises: Promise<void>[] = [];

    snap.forEach((d) => {
      const data = d.data();
      const lastSeen = data.lastSeen || data.joinedAt || 0;
      if (now - lastSeen > STALE_TIMEOUT_MS) {
        deletePromises.push(deleteDoc(d.ref));
      } else if (data.userId) {
        activeUsers.add(data.userId);
      }
    });

    if (deletePromises.length > 0) {
      Promise.all(deletePromises).catch(() => {});
    }

    const activeCount = activeUsers.size;
    if (activeCount >= MAX_CALLS_PER_SESSION) {
      return {
        allowed: false,
        activeCount,
        maxAllowed: MAX_CALLS_PER_SESSION,
        message:
          'O limite de chamadas simultâneas neste dispositivo foi atingido. Aguarde a finalização da reunião anterior.',
      };
    }

    return { allowed: true, activeCount, maxAllowed: MAX_CALLS_PER_SESSION };
  } catch (err) {
    console.warn('[callsLimit] check error:', err);
    return { allowed: true, activeCount: 0, maxAllowed: MAX_CALLS_PER_SESSION };
  }
}

export async function registerCallSession(
  roomId: string,
  userId: string,
  isNewRoom: boolean
): Promise<void> {
  try {
    const clientId = getClientId();
    const docId = sanitizeDocId(clientId, userId);
    const callDocRef = doc(db, 'ip_active_calls', docId);

    await setDoc(callDocRef, {
      clientId,
      userId,
      roomId,
      isNewRoom,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
    });
  } catch {
    // ignore
  }
}

export async function sendCallHeartbeat(roomId: string, userId: string): Promise<void> {
  try {
    const clientId = getClientId();
    const docId = sanitizeDocId(clientId, userId);
    const callDocRef = doc(db, 'ip_active_calls', docId);

    await setDoc(
      callDocRef,
      {
        clientId,
        userId,
        roomId,
        lastSeen: Date.now(),
      },
      { merge: true }
    );
  } catch {
    // ignore
  }
}

export async function leaveCallSession(roomId: string, userId: string): Promise<void> {
  try {
    const clientId = getClientId();
    const docId = sanitizeDocId(clientId, userId);
    const callDocRef = doc(db, 'ip_active_calls', docId);
    await deleteDoc(callDocRef);
  } catch {
    // ignore
  }
}
