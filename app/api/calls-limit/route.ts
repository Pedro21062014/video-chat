import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';

const MAX_CALLS_PER_IP = 3;
const STALE_TIMEOUT_MS = 45000; // 45 seconds without heartbeat = stale session

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp && realIp.trim()) return realIp.trim();
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp && cfIp.trim()) return cfIp.trim();
  return '127.0.0.1';
}

function sanitizeDocId(ip: string, userId: string): string {
  const cleanIp = ip.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanUser = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `ip_${cleanIp}_${cleanUser}`;
}

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const action = req.nextUrl.searchParams.get('action') || 'new_room';
    const isNewRoom = action === 'new_room';

    const colRef = collection(db, 'ip_active_calls');
    const q = query(colRef, where('ip', '==', ip));
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

    // The limit only applies when starting a new meeting (nova reunião)
    // Participants joining an existing meeting are not blocked!
    if (isNewRoom && activeCount >= MAX_CALLS_PER_IP) {
      return NextResponse.json(
        {
          allowed: false,
          activeCount,
          maxAllowed: MAX_CALLS_PER_IP,
          message:
            'O servidor está sobrecarregado. Por favor, aguarde um pouco antes de iniciar a próxima ligação.',
        },
        { status: 429 }
      );
    }

    return NextResponse.json({
      allowed: true,
      activeCount,
      maxAllowed: MAX_CALLS_PER_IP,
    });
  } catch (err) {
    console.error('[calls-limit] GET error:', err);
    // Allow entry on unexpected error to prevent hard lock
    return NextResponse.json({ allowed: true, activeCount: 0, maxAllowed: MAX_CALLS_PER_IP });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    let body: { action?: string; roomId?: string; userId?: string; isNewRoom?: boolean } = {};

    try {
      const text = await req.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // ignore
    }

    const action = body.action || 'heartbeat';
    const userId = body.userId || 'anon';
    const roomId = body.roomId || 'default';
    const isNewRoom = Boolean(body.isNewRoom);
    const docId = sanitizeDocId(ip, userId);
    const callDocRef = doc(db, 'ip_active_calls', docId);

    if (action === 'leave') {
      try {
        await deleteDoc(callDocRef);
      } catch {
        // ignore
      }
      return NextResponse.json({ ok: true, action: 'leave' });
    }

    if (action === 'heartbeat') {
      try {
        await setDoc(
          callDocRef,
          {
            ip,
            userId,
            roomId,
            lastSeen: Date.now(),
          },
          { merge: true }
        );
      } catch {
        // ignore
      }
      return NextResponse.json({ ok: true, action: 'heartbeat' });
    }

    if (action === 'join') {
      // Check existing active calls for this IP
      const colRef = collection(db, 'ip_active_calls');
      const q = query(colRef, where('ip', '==', ip));
      const snap = await getDocs(q);

      const now = Date.now();
      const activeUsers = new Set<string>();
      let alreadyRegistered = false;
      const deletePromises: Promise<void>[] = [];

      snap.forEach((d) => {
        const data = d.data();
        if (data.userId === userId) {
          alreadyRegistered = true;
          activeUsers.add(userId);
          return;
        }
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

      // ONLY block if starting a new meeting (nova reunião) and limit reached.
      // Participants joining an existing meeting are NEVER blocked!
      if (isNewRoom && !alreadyRegistered && activeUsers.size >= MAX_CALLS_PER_IP) {
        return NextResponse.json(
          {
            allowed: false,
            activeCount: activeUsers.size,
            maxAllowed: MAX_CALLS_PER_IP,
            message:
              'O servidor está sobrecarregado. Por favor, aguarde um pouco antes de iniciar a próxima ligação.',
          },
          { status: 429 }
        );
      }

      await setDoc(callDocRef, {
        ip,
        userId,
        roomId,
        isNewRoom,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
      });

      return NextResponse.json({
        allowed: true,
        activeCount: alreadyRegistered ? activeUsers.size : activeUsers.size + 1,
        maxAllowed: MAX_CALLS_PER_IP,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[calls-limit] POST error:', err);
    return NextResponse.json({ ok: true });
  }
}
