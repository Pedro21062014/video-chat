import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
  doc,
  deleteDoc,
  collection,
  getDocs,
  writeBatch,
  setDoc,
} from 'firebase/firestore';

export async function POST(req: NextRequest) {
  try {
    let body: { roomId?: string; userId?: string; clientId?: string } = {};

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json') || contentType.includes('text/plain')) {
      try {
        const text = await req.text();
        if (text) {
          body = JSON.parse(text);
        }
      } catch {
        // ignore parse error
      }
    }

    const { roomId, userId, clientId } = body;
    if (!roomId || !userId) {
      return NextResponse.json({ error: 'Missing roomId or userId' }, { status: 400 });
    }

    // 1. Immediately delete the leaving participant's document
    const participantRef = doc(db, 'rooms', roomId, 'participants', userId);
    await deleteDoc(participantRef).catch(() => {});

    // 2. Also delete active signals sent to or from this user
    try {
      const signalsCol = collection(db, 'rooms', roomId, 'signals');
      const sigSnap = await getDocs(signalsCol);
      if (!sigSnap.empty) {
        let batch = writeBatch(db);
        let count = 0;
        sigSnap.forEach((d) => {
          const sig = d.data();
          if (sig.from === userId || sig.to === userId) {
            batch.delete(d.ref);
            count++;
          }
        });
        if (count > 0) {
          await batch.commit().catch(() => {});
        }
      }
    } catch {
      // ignore
    }

    // 3. Remove client call limit session if clientId provided
    if (clientId) {
      try {
        const cleanClient = clientId.replace(/[^a-zA-Z0-9_-]/g, '_');
        const cleanUser = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
        const docId = `cli_${cleanClient}_${cleanUser}`;
        const callDocRef = doc(db, 'ip_active_calls', docId);
        await deleteDoc(callDocRef).catch(() => {});
      } catch {
        // ignore
      }
    }

    // 4. Check remaining participants in the room
    const pCol = collection(db, 'rooms', roomId, 'participants');
    const pSnap = await getDocs(pCol);

    const now = Date.now();
    let hasOtherActive = false;

    pSnap.forEach((d) => {
      if (d.id === userId) return;
      const data = d.data();
      const lastSeen = data.lastSeen || data.joinedAt || 0;
      // Stale if no heartbeat within 10 seconds
      if (now - lastSeen < 10000) {
        hasOtherActive = true;
      }
    });

    // If nobody else is left active in the room, mark room as ended and clean ephemeral collections
    if (!hasOtherActive) {
      try {
        const roomRef = doc(db, 'rooms', roomId);
        await setDoc(
          roomRef,
          {
            status: 'ended',
            endedAt: now,
            lastActive: now,
            clearedAt: now,
          },
          { merge: true }
        ).catch(() => {});

        // Clear subcollections
        for (const subcol of ['messages', 'reactions', 'signals', 'participants']) {
          const colRef = collection(db, 'rooms', roomId, subcol);
          const subSnap = await getDocs(colRef);
          if (!subSnap.empty) {
            let b = writeBatch(db);
            let bCount = 0;
            subSnap.forEach((sDoc) => {
              b.delete(sDoc.ref);
              bCount++;
              if (bCount % 450 === 0) {
                b.commit();
                b = writeBatch(db);
              }
            });
            if (bCount > 0) {
              await b.commit().catch(() => {});
            }
          }
        }
      } catch {
        // ignore
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
