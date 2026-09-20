import {
  collection,
  doc,
  getDocs,
  writeBatch,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { Participant } from './types';

/**
 * Clears only ephemeral subcollections (messages, reactions, signals, old participants)
 * WITHOUT touching or altering the room's status.
 * This is used when a new meeting starts or is reset, so it never prematurely ends a call.
 */
export async function clearEphemeralRoomData(roomId: string): Promise<void> {
  if (!roomId) return;

  try {
    const subcollections = ['messages', 'reactions', 'signals', 'participants'];

    for (const subcol of subcollections) {
      try {
        const colRef = collection(db, 'rooms', roomId, subcol);
        const snapshot = await getDocs(colRef);

        if (!snapshot.empty) {
          let batch = writeBatch(db);
          let count = 0;

          for (const docSnap of snapshot.docs) {
            batch.delete(docSnap.ref);
            count++;
            if (count % 450 === 0) {
              await batch.commit();
              batch = writeBatch(db);
            }
          }

          if (count % 450 !== 0) {
            await batch.commit();
          }
        }
      } catch (subErr) {
        console.warn(`[RoomCleanup] Error clearing subcollection ${subcol}:`, subErr);
      }
    }
  } catch (err) {
    console.error(`[RoomCleanup] Failed to clear ephemeral data for room ${roomId}:`, err);
  }
}

/**
 * Purges all transient data for a call room and marks room as ended:
 * - messages (chat)
 * - reactions (emojis)
 * - signals (WebRTC signaling)
 * - participants (lingering participant records)
 *
 * PRESERVES room metadata in `rooms/{roomId}`:
 * - title, hostId, createdBy, hostName, createdAt
 * - marks status as 'ended', endedAt, lastActive, and clearedAt
 */
export async function purgeRoomData(roomId: string): Promise<void> {
  if (!roomId) return;

  try {
    await clearEphemeralRoomData(roomId);

    // Preserve room document metadata while updating status to ended
    const roomRef = doc(db, 'rooms', roomId);
    await setDoc(
      roomRef,
      {
        status: 'ended',
        endedAt: Date.now(),
        lastActive: Date.now(),
        clearedAt: Date.now(),
      },
      { merge: true }
    );

    console.log(`[RoomCleanup] Successfully cleared all ephemeral data and ended room ${roomId}`);
  } catch (err) {
    console.error(`[RoomCleanup] Failed to purge room ${roomId}:`, err);
  }
}

/**
 * Checks if a room has any active participants remaining.
 * If 0 active participants remain, immediately purges all transient room data.
 */
export async function checkAndCleanIfRoomEmpty(
  roomId: string,
  leavingUserId?: string
): Promise<boolean> {
  if (!roomId) return false;

  try {
    // 1. If a specific user is leaving, delete their document first
    if (leavingUserId) {
      try {
        const myDocRef = doc(db, 'rooms', roomId, 'participants', leavingUserId);
        await deleteDoc(myDocRef);
      } catch {
        // ignore if already deleted
      }
    }

    // 2. Query remaining participants in the room
    const pCol = collection(db, 'rooms', roomId, 'participants');
    const pSnap = await getDocs(pCol);

    const now = Date.now();
    const activeParticipants: Participant[] = [];

    pSnap.forEach((d) => {
      const p = d.data() as Participant;
      // Skip the user that is leaving
      if (leavingUserId && p.userId === leavingUserId) return;
      // Check if participant is alive (heartbeat within 45s)
      const lastSeen = p.lastSeen || p.joinedAt || 0;
      if (now - lastSeen < 45000) {
        activeParticipants.push(p);
      }
    });

    // If no active participants remain in the room, purge all ephemeral data!
    if (activeParticipants.length === 0) {
      console.log(`[RoomCleanup] Room ${roomId} has no active participants left. Purging all chat & call data...`);
      await purgeRoomData(roomId);
      return true;
    }

    return false;
  } catch (err) {
    console.error(`[RoomCleanup] Error checking room emptiness for ${roomId}:`, err);
    return false;
  }
}
