import { useState } from 'react';
import { IconGavel, IconX } from '@tabler/icons-react';
import useTournamentStore from '../store/useTournamentStore';
import { Modal, ModalHeader, Button, Input, Alert, Badge } from './UI';
import styles from './RefereePanel.module.css';

export default function RefereePanel({ onClose }) {
  const { refereeLogin, refereeLogout, currentReferee, activeTournament: t, updateMatch, playerName } = useTournamentStore();
  const matches  = t?.matches  || [];
  const referees = t?.referees || [];

  const [name, setName]   = useState('');
  const [pin, setPin]     = useState('');
  const [err, setErr]     = useState('');
  const [flash, setFlash] = useState('');

  const showFlash = (msg) => { setFlash(msg); setTimeout(() => setFlash(''), 2500); };

  const handleLogin = () => {
    if (!refereeLogin(name, pin)) setErr('Name or PIN is incorrect');
    else setErr('');
  };

  // ── Login screen ──────────────────────────────────────────────────────────
  if (!currentReferee) {
    return (
      <Modal onClose={onClose}>
        <ModalHeader title="Referee login" onClose={onClose} />
        <div className={styles.loginHero}>
          <IconGavel size={32} color="var(--blue-600)" />
          <p className={styles.loginSub}>Log in with your name and PIN to update match scores in real time.</p>
        </div>
        {err && <Alert variant="error">{err}</Alert>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          <Input label="Your name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. James Okoro" />
          <Input label="PIN" type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="••••"
            onKeyDown={e => e.key === 'Enter' && handleLogin()} />
        </div>
        {referees.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)', padding: '8px 10px', background: 'var(--gray-100)', borderRadius: 'var(--radius-sm)' }}>
            Registered referees: {referees.map(r => <strong key={r.id}>{r.name}</strong>).reduce((prev, curr) => [prev, ', ', curr])}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '1rem' }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleLogin}>Login</Button>
        </div>
      </Modal>
    );
  }

  // ── Referee dashboard ─────────────────────────────────────────────────────
  const assignedMatches = matches.filter(m => m.refereeId === currentReferee.id && m.p1 && m.p2);

  return (
    <Modal onClose={onClose}>
      <div>
        <div className={styles.refHeader}>
          <div className={styles.refIdentity}>
            <IconGavel size={18} color="var(--blue-600)" />
            <div>
              <div className={styles.refName}>{currentReferee.name}</div>
              <div className={styles.refRole}>Referee · {assignedMatches.length} match{assignedMatches.length !== 1 ? 'es' : ''} assigned</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="danger" size="sm" onClick={() => { refereeLogout(); onClose(); }}>Logout</Button>
            <Button variant="ghost" size="sm" onClick={onClose}><IconX size={14} /></Button>
          </div>
        </div>

        {flash && <Alert variant="success" style={{ marginBottom: 12 }}>{flash}</Alert>}

        {assignedMatches.length === 0 ? (
          <div className={styles.noMatches}>
            <IconGavel size={30} strokeWidth={1.2} style={{ opacity: 0.25 }} />
            <p>No matches assigned to you yet.</p>
            <p style={{ fontSize: 12, color: 'var(--subtle)' }}>Ask the admin to assign you to a match.</p>
          </div>
        ) : (
          <div className={styles.matchList}>
            {assignedMatches.map(m => (
              <RefereeMatchCard key={m.id} match={m} playerName={playerName} updateMatch={updateMatch} showFlash={showFlash} />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Score card for each assigned match ──────────────────────────────────────
function RefereeMatchCard({ match, playerName, updateMatch, showFlash }) {
  const [s1, setS1] = useState(match.score1);
  const [s2, setS2] = useState(match.score2);

  const save = (status) => {
    updateMatch(match.id, { score1: parseInt(s1)||0, score2: parseInt(s2)||0, status });
    showFlash(`Score updated — ${playerName(match.p1)} ${s1} · ${s2} ${playerName(match.p2)}`);
  };

  const statusVariant = { completed: 'green', live: 'red', upcoming: 'gray' };

  return (
    <div className={styles.matchCard}>
      <div className={styles.matchMeta}>
        <span className={styles.matchRound}>{match.round} · {match.court}</span>
        <Badge variant={statusVariant[match.status]}>{match.status}</Badge>
      </div>

      <div className={styles.scoreRow}>
        <div className={styles.scoreTeam}>
          <div className={styles.teamName}>{playerName(match.p1)}</div>
          <div className={styles.scoreControls}>
            <button className={styles.stepBtn} onClick={() => setS1(v => Math.max(0, parseInt(v)||0) - 1 < 0 ? 0 : (parseInt(v)||0) - 1)}>−</button>
            <input type="number" className={styles.scoreInput} value={s1}
              onChange={e => setS1(Math.max(0, parseInt(e.target.value)||0))} min={0} max={99} />
            <button className={styles.stepBtn} onClick={() => setS1(v => (parseInt(v)||0) + 1)}>+</button>
          </div>
        </div>

        <div className={styles.vs}>VS</div>

        <div className={styles.scoreTeam}>
          <div className={styles.teamName}>{playerName(match.p2)}</div>
          <div className={styles.scoreControls}>
            <button className={styles.stepBtn} onClick={() => setS2(v => Math.max(0, parseInt(v)||0) - 1 < 0 ? 0 : (parseInt(v)||0) - 1)}>−</button>
            <input type="number" className={styles.scoreInput} value={s2}
              onChange={e => setS2(Math.max(0, parseInt(e.target.value)||0))} min={0} max={99} />
            <button className={styles.stepBtn} onClick={() => setS2(v => (parseInt(v)||0) + 1)}>+</button>
          </div>
        </div>
      </div>

      <div className={styles.saveRow}>
        <Button variant="primary" size="sm" onClick={() => save('live')}>Save — Live</Button>
        <Button variant="ghost"   size="sm" onClick={() => save('completed')}>Mark complete</Button>
      </div>
    </div>
  );
}
