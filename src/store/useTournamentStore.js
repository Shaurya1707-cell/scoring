import { create } from 'zustand';
import { db } from '../services/db';
import {
  collection, doc, onSnapshot, setDoc, updateDoc, addDoc,
  deleteDoc, getDocs, query, orderBy, serverTimestamp
} from 'firebase/firestore';

// ─── Sport presets ────────────────────────────────────────────────────────────
export const SPORTS = [
  { name: 'Pickleball (Singles)', emoji: '🏓', registrationType: 'individual', defaultTeamSize: 1 },
  { name: 'Pickleball (Doubles)', emoji: '🏓', registrationType: 'team', defaultTeamSize: 2 },
  { name: 'Badminton',           emoji: '🏸', registrationType: 'individual', defaultTeamSize: 1 },
  { name: 'Cricket',             emoji: '🏏', registrationType: 'team', defaultTeamSize: 11 },
  { name: 'Football',            emoji: '⚽', registrationType: 'team', defaultTeamSize: 11 },
  { name: 'Basketball',          emoji: '🏀', registrationType: 'team', defaultTeamSize: 5 },
  { name: 'Tennis',              emoji: '🎾', registrationType: 'individual', defaultTeamSize: 1 },
  { name: 'Table Tennis',        emoji: '🏓', registrationType: 'individual', defaultTeamSize: 1 },
  { name: 'Volleyball',          emoji: '🏐', registrationType: 'team', defaultTeamSize: 6 },
  { name: 'Custom',              emoji: '🏆', registrationType: 'individual', defaultTeamSize: 1 },
];

// ─── Collections refs ─────────────────────────────────────────────────────────
const tournamentsCol = collection(db, 'tournaments');

// ─── Store ────────────────────────────────────────────────────────────────────
const useTournamentStore = create((set, get) => ({
  // ── Global state
  tournaments: [],
  tournamentsLoaded: false,

  // ── Active tournament (when viewing a specific tournament)
  activeTournament: null,
  activeTournamentLoaded: false,

  // ── Auth state (local only)
  adminLoggedIn: false,
  currentReferee: null,

  // ── Unsubscribe functions
  _unsubTournaments: null,
  _unsubActive: null,

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH
  // ═══════════════════════════════════════════════════════════════════════════
  adminLogin: (password) => {
    if (password === 'admin123') { set({ adminLoggedIn: true }); return true; }
    return false;
  },
  adminLogout: () => set({ adminLoggedIn: false }),

  refereeLogin: (name, pin) => {
    const t = get().activeTournament;
    if (!t) return false;
    const ref = (t.referees || []).find(
      r => r.name.toLowerCase() === name.toLowerCase() && r.pin === pin
    );
    if (ref) { set({ currentReferee: ref }); return true; }
    return false;
  },
  refereeLogout: () => set({ currentReferee: null }),

  // ═══════════════════════════════════════════════════════════════════════════
  // TOURNAMENT LIST (Home page)
  // ═══════════════════════════════════════════════════════════════════════════
  subscribeTournaments: () => {
    const prev = get()._unsubTournaments;
    if (prev) prev();

    const q = query(tournamentsCol, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const tournaments = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      }));
      set({ tournaments, tournamentsLoaded: true });
    });
    set({ _unsubTournaments: unsub });
    return unsub;
  },

  unsubscribeTournaments: () => {
    const unsub = get()._unsubTournaments;
    if (unsub) unsub();
    set({ _unsubTournaments: null });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SINGLE TOURNAMENT (Detail page)
  // ═══════════════════════════════════════════════════════════════════════════
  subscribeTournament: (tournamentId) => {
    const prev = get()._unsubActive;
    if (prev) prev();

    set({ activeTournament: null, activeTournamentLoaded: false, currentReferee: null });

    const docRef = doc(db, 'tournaments', tournamentId);
    const unsub = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        set({
          activeTournament: { id: snapshot.id, ...snapshot.data() },
          activeTournamentLoaded: true,
        });
      } else {
        set({ activeTournament: null, activeTournamentLoaded: true });
      }
    });
    set({ _unsubActive: unsub });
    return unsub;
  },

  unsubscribeTournament: () => {
    const unsub = get()._unsubActive;
    if (unsub) unsub();
    set({ _unsubActive: null, activeTournament: null, activeTournamentLoaded: false, currentReferee: null });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TOURNAMENT CRUD (Admin)
  // ═══════════════════════════════════════════════════════════════════════════
  createTournament: async (data) => {
    const newTournament = {
      name: data.name,
      sport: data.sport,
      sportEmoji: data.sportEmoji || '🏆',
      status: 'upcoming',
      registrationDeadline: data.registrationDeadline || null,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      maxPlayers: data.maxPlayers || 32,
      registrationType: data.registrationType || 'individual',
      teamSize: data.teamSize || 1,
      bannerUrl: data.bannerUrl || null,
      players: [],
      teams: [],
      matches: [],
      referees: [],
      nextId: 100,
      createdAt: serverTimestamp(),
    };
    const docRef = await addDoc(tournamentsCol, newTournament);
    return docRef.id;
  },

  updateTournamentMeta: async (tournamentId, updates) => {
    const docRef = doc(db, 'tournaments', tournamentId);
    await updateDoc(docRef, updates);
  },

  deleteTournament: async (tournamentId) => {
    const docRef = doc(db, 'tournaments', tournamentId);
    await deleteDoc(docRef);
  },

  // ── Banner upload (resizes + stores as Base64 in Firestore) ────────────
  uploadBanner: async (tournamentId, file) => {
    const dataUrl = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const MAX_W = 1200;
        const MAX_H = 400;
        let w = img.width, h = img.height;
        // Scale down if needed, keeping aspect ratio
        if (w > MAX_W) { h = Math.round(h * MAX_W / w); w = MAX_W; }
        if (h > MAX_H) { w = Math.round(w * MAX_H / h); h = MAX_H; }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        // Compress to JPEG at 0.75 quality — keeps it well under Firestore's 1 MB doc limit
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
    const docRef = doc(db, 'tournaments', tournamentId);
    await updateDoc(docRef, { bannerUrl: dataUrl });
    return dataUrl;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PLAYER REGISTRATION (Individual)
  // ═══════════════════════════════════════════════════════════════════════════
  registerForTournament: async (tournamentId, playerInfo) => {
    const docRef = doc(db, 'tournaments', tournamentId);
    // We need to get the current data first to avoid race conditions
    const t = get().activeTournament;
    if (!t) return false;

    const existing = (t.players || []).find(
      p => p.name.toLowerCase() === playerInfo.name.toLowerCase()
    );
    if (existing) return false; // Already registered

    const nextId = (t.nextId || 100);
    const newPlayers = [...(t.players || []), { ...playerInfo, id: nextId }];
    await updateDoc(docRef, { players: newPlayers, nextId: nextId + 1 });
    return true;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TEAM REGISTRATION (Team sports)
  // ═══════════════════════════════════════════════════════════════════════════
  registerTeamForTournament: async (tournamentId, teamInfo) => {
    const docRef = doc(db, 'tournaments', tournamentId);
    const t = get().activeTournament;
    if (!t) return false;

    const existingTeams = t.teams || [];
    const duplicate = existingTeams.find(
      team => team.teamName.toLowerCase() === teamInfo.teamName.toLowerCase()
    );
    if (duplicate) return false; // Team name already taken

    const nextId = (t.nextId || 100);
    const newTeam = {
      id: nextId,
      teamName: teamInfo.teamName,
      captainName: teamInfo.captainName,
      members: teamInfo.members || [],
      skill: teamInfo.skill || 'Intermediate',
    };
    const newTeams = [...existingTeams, newTeam];

    // Also add team as a "player" entry for match compatibility
    const newPlayers = [
      ...(t.players || []),
      { id: nextId, name: teamInfo.teamName, team: teamInfo.teamName, skill: teamInfo.skill || 'Intermediate', isTeam: true }
    ];

    await updateDoc(docRef, { teams: newTeams, players: newPlayers, nextId: nextId + 1 });
    return true;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SCOPED ACTIONS (operate on active tournament)
  // ═══════════════════════════════════════════════════════════════════════════

  // Helper to get the active tournament doc ref
  _activeRef: () => {
    const t = get().activeTournament;
    if (!t) return null;
    return doc(db, 'tournaments', t.id);
  },

  // ── Players ──────────────────────────────────────────────────────────────
  addPlayer: async (player) => {
    const t = get().activeTournament;
    if (!t) return;
    const ref = doc(db, 'tournaments', t.id);
    const nextId = t.nextId || 100;
    const newPlayers = [...(t.players || []), { ...player, id: nextId }];
    await updateDoc(ref, { players: newPlayers, nextId: nextId + 1 });
  },

  removePlayer: async (id) => {
    const t = get().activeTournament;
    if (!t) return;
    const ref = doc(db, 'tournaments', t.id);
    const newPlayers = (t.players || []).filter(p => p.id !== id);
    // Also remove from teams if it's a team entry
    const newTeams = (t.teams || []).filter(team => team.id !== id);
    await updateDoc(ref, { players: newPlayers, teams: newTeams });
  },

  // ── Matches ──────────────────────────────────────────────────────────────
  addMatch: async (match) => {
    const t = get().activeTournament;
    if (!t) return;
    const ref = doc(db, 'tournaments', t.id);
    const nextId = t.nextId || 100;
    const newMatches = [...(t.matches || []), { ...match, id: nextId, refereeId: null }];
    await updateDoc(ref, { matches: newMatches, nextId: nextId + 1 });
  },

  removeMatch: async (id) => {
    const t = get().activeTournament;
    if (!t) return;
    const ref = doc(db, 'tournaments', t.id);
    const newMatches = (t.matches || []).filter(m => m.id !== id);
    await updateDoc(ref, { matches: newMatches });
  },

  updateMatch: async (id, updates) => {
    const t = get().activeTournament;
    if (!t) return;
    const ref = doc(db, 'tournaments', t.id);
    const newMatches = (t.matches || []).map(m => m.id === id ? { ...m, ...updates } : m);
    await updateDoc(ref, { matches: newMatches });
  },

  assignReferee: async (matchId, refereeId) => {
    const t = get().activeTournament;
    if (!t) return;
    const ref = doc(db, 'tournaments', t.id);
    const newMatches = (t.matches || []).map(m => m.id === matchId ? { ...m, refereeId } : m);
    await updateDoc(ref, { matches: newMatches });
  },

  // ── Referees ─────────────────────────────────────────────────────────────
  addReferee: async (referee) => {
    const t = get().activeTournament;
    if (!t) return;
    const ref = doc(db, 'tournaments', t.id);
    const nextId = t.nextId || 100;
    const newReferees = [...(t.referees || []), { ...referee, id: `ref_${nextId}`, assignedMatchIds: [] }];
    await updateDoc(ref, { referees: newReferees, nextId: nextId + 1 });
  },

  removeReferee: async (id) => {
    const t = get().activeTournament;
    if (!t) return;
    const ref = doc(db, 'tournaments', t.id);
    const newReferees = (t.referees || []).filter(r => r.id !== id);
    await updateDoc(ref, { referees: newReferees });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DERIVED HELPERS
  // ═══════════════════════════════════════════════════════════════════════════
  getPlayer: (id) => {
    const t = get().activeTournament;
    if (!t) return null;
    return (t.players || []).find(p => p.id === id);
  },

  playerName: (id) => {
    const t = get().activeTournament;
    if (!t) return 'TBD';
    const p = (t.players || []).find(x => x.id === id);
    return p ? p.name : 'TBD';
  },

  getTeamById: (id) => {
    const t = get().activeTournament;
    if (!t) return null;
    return (t.teams || []).find(team => team.id === id);
  },

  getStats: () => {
    const t = get().activeTournament;
    if (!t) return {};
    const players = t.players || [];
    const matches = t.matches || [];
    const stats = {};
    players.forEach(p => { stats[p.id] = { wins: 0, losses: 0, pts: 0, played: 0 }; });
    matches.forEach(m => {
      if (m.status === 'upcoming' || !m.p1 || !m.p2) return;
      if (!stats[m.p1]) stats[m.p1] = { wins: 0, losses: 0, pts: 0, played: 0 };
      if (!stats[m.p2]) stats[m.p2] = { wins: 0, losses: 0, pts: 0, played: 0 };
      stats[m.p1].played++; stats[m.p2].played++;
      if (m.score1 > m.score2) { stats[m.p1].wins++; stats[m.p2].losses++; stats[m.p1].pts += 3; }
      else if (m.score2 > m.score1) { stats[m.p2].wins++; stats[m.p1].losses++; stats[m.p2].pts += 3; }
      else { stats[m.p1].pts++; stats[m.p2].pts++; }
    });
    return stats;
  },
}));

export default useTournamentStore;
