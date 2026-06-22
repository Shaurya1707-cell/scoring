import Dexie, { type Table } from "dexie";

export interface PendingAction {
  id?: number;
  matchId: string;
  gameId: string;
  actionType: "point" | "undo";
  scoringTeamId?: string; // only if actionType === "point"
  timestamp: number;
}

class RefereeOfflineDatabase extends Dexie {
  pendingActions!: Table<PendingAction>;

  constructor() {
    super("PickleballRefereeDB");
    this.version(1).stores({
      pendingActions: "++id, matchId, gameId, timestamp",
    });
  }
}

export const offlineDB = new RefereeOfflineDatabase();

/**
 * Queue a point event locally when offline.
 */
export async function queuePointAction(matchId: string, gameId: string, scoringTeamId: string) {
  await offlineDB.pendingActions.add({
    matchId,
    gameId,
    actionType: "point",
    scoringTeamId,
    timestamp: Date.now(),
  });
  console.log(`[Offline Queue] Queued point for team ${scoringTeamId} locally.`);
}

/**
 * Queue an undo action locally when offline.
 */
export async function queueUndoAction(matchId: string, gameId: string) {
  await offlineDB.pendingActions.add({
    matchId,
    gameId,
    actionType: "undo",
    timestamp: Date.now(),
  });
  console.log("[Offline Queue] Queued undo action locally.");
}

/**
 * Sync the queued actions with the server.
 * Replays them in chronological order.
 */
export async function syncOfflineQueue(onSyncSuccess?: () => void) {
  const actions = await offlineDB.pendingActions.orderBy("timestamp").toArray();
  if (actions.length === 0) return;

  console.log(`[Offline Sync] Syncing ${actions.length} pending actions with server...`);

  for (const action of actions) {
    try {
      const endpoint = action.actionType === "point" ? "/api/referee/score" : "/api/referee/undo";
      const body = action.actionType === "point" 
        ? { matchId: action.matchId, gameId: action.gameId, scoringTeamId: action.scoringTeamId }
        : { matchId: action.matchId, gameId: action.gameId };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text();
        // If it's a conflict or match locked error, we might want to delete it or show a warning.
        // For simplicity, if the server rejects, we print the error. If it's a validation error, we delete it to avoid blocking the queue.
        console.error(`[Offline Sync] Failed to sync action ID ${action.id}: ${errorText}`);
        if (res.status === 400 || res.status === 403) {
          await offlineDB.pendingActions.delete(action.id!);
        }
        break; // Stop replaying queue on connection/network error to keep sequence intact
      }

      // Success! Remove from local queue
      await offlineDB.pendingActions.delete(action.id!);
      console.log(`[Offline Sync] Successfully synced action ID ${action.id}`);
    } catch (err) {
      console.error("[Offline Sync] Network error during sync:", err);
      break; // Stop and retry later on network failure
    }
  }

  if (onSyncSuccess) {
    onSyncSuccess();
  }
}
