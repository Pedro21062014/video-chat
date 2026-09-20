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

const MAX_CALLS_PER_IP = 5;
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
    const colRef = collection(db, 'ip_active_calls');
    const q = query(colRef, where('ip', '==', ip));
    const snap = await getDocs(q);

    const now = Date.now();
    let activeCount = 0;
    const deletePromises: Promise<void>[] = [];

    snap.forEach((d) => {
      const data = d.data();
      const lastSeen = data.lastSeen || data.joinedAt || 0;
      if (now - lastSeen > STALE_TIMEOUT_MS) {
        deletePromises.push(deleteDoc(d.ref));
      } else {
        activeCount++;
      }
    });

    if (deletePromises.length > 0) {
      Promise.all(deletePromises).catch(() => {});
    }

    if (activeCount >= MAX_CALLS_PER_IP) {
      return NextResponse.json(
        {
          allowed: false,
          activeCount,
          maxAllowed: MAX_CALLS_PER_IP,
          message:
            'O servidor está sobrecarregado. Limite de 5 chamadas ativas por IP atingido. Por favor, aguarde alguns instantes e tente novamente.',
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
    let body: { action?: string; roomId?: string; userId?: string } = {};

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
      let activeCount = 0;
      let alreadyRegistered = false;
      const deletePromises: Promise<void>[] = [];

      snap.forEach((d) => {
        const data = d.data();
        if (data.userId === userId) {
          alreadyRegistered = true;
          activeCount++;
          return;
        }
        const lastSeen = data.lastSeen || data.joinedAt || 0;
        if (now - lastSeen > STALE_TIMEOUT_MS) {
          deletePromises.push(deleteDoc(d.ref));
        } else {
          activeCount++;
        }
      });

      if (deletePromises.length > 0) {
        Promise.all(deletePromises).catch(() => {});
      }

      if (!alreadyRegistered && activeCount >= MAX_CALLS_PER_IP) {
        return NextResponse.json(
          {
            allowed: false,
            activeCount,
            maxAllowed: MAX_CALLS_PER_IP,
            message:
              'O servidor está sobrecarregado. Limite de 5 chamadas ativas por IP atingido. Por favor, aguarde alguns instantes e tente novamente.',
          },
          { status: 429 }
        );
      }

      await setDoc(callDocRef, {
        ip,
        userId,
        roomId,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
      });

      return NextResponse.json({
        allowed: true,
        activeCount: alreadyRegistered ? activeCount : activeCount + 1,
        maxAllowed: MAX_CALLS_PER_IP,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[calls-limit] POST error:', err);
    return NextResponse.json({ ok: true });
  }
}
