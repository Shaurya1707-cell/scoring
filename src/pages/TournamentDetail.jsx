import { useEffect, useState } from 'react';
import { useParams, NavLink, Link } from 'react-router-dom';
import { IconArrowLeft, IconTrophy, IconTournament, IconClipboardList, IconUsers, IconUserPlus, IconUsersGroup } from '@tabler/icons-react';
import useTournamentStore from '../store/useTournamentStore';
import { Badge, LiveDot, Button, Modal, ModalHeader, Input, Select, Alert } from '../components/UI';
import Leaderboard from './Leaderboard';
import Bracket from './Bracket';
import Scores from './Scores';
import Players from './Players';
import styles from './TournamentDetail.module.css';

const TABS = [
  { key: 'standings', label: 'Standings', icon: IconTrophy },
  { key: 'bracket',   label: 'Bracket',   icon: IconTournament },
  { key: 'scores',    label: 'Scores',    icon: IconClipboardList },
  { key: 'players',   label: 'Players',   icon: IconUsers },
];

const STATUS_VARIANT = { ongoing: 'red', upcoming: 'amber', completed: 'green' };

function isDeadlinePassed(deadline) {
  if (!deadline) return false;
  const d = deadline.toDate ? deadline.toDate() : new Date(deadline);
  return d < new Date();
}

function formatDate(val) {
  if (!val) return '—';
  if (val.toDate) return val.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return new Date(val).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function TournamentDetail() {
  const { id } = useParams();
  const { activeTournament: t, activeTournamentLoaded, subscribeTournament, unsubscribeTournament,
          registerForTournament, registerTeamForTournament } = useTournamentStore();
  const [activeTab, setActiveTab] = useState('standings');
  const [showRegModal, setShowRegModal] = useState(false);

  useEffect(() => {
    subscribeTournament(id);
    return () => unsubscribeTournament();
  }, [id]);

  if (!activeTournamentLoaded) {
    return <div className={styles.loading}>Loading tournament…</div>;
  }

  if (!t) {
    return (
      <div className={styles.notFound}>
        <h2>Tournament not found</h2>
        <Link to="/" className={styles.backLink}>← Back to tournaments</Link>
      </div>
    );
  }

  const isTeam = t.registrationType === 'team';
  const deadlinePassed = isDeadlinePassed(t.registrationDeadline);
  const canRegister = (t.status === 'upcoming' || t.status === 'ongoing') && !deadlinePassed;
  const participantCount = isTeam ? (t.teams || []).length : (t.players || []).length;
  const isFull = t.maxPlayers && participantCount >= t.maxPlayers;

  return (
    <div className={styles.wrap}>
      {/* Header */}
      <div className={styles.header}>
        <Link to="/" className={styles.backBtn}>
          <IconArrowLeft size={16} /> All tournaments
        </Link>

        {/* Tournament Banner */}
        {t.bannerUrl && (
          <div className={styles.bannerWrap}>
            <img src={t.bannerUrl} alt={`${t.name} banner`} className={styles.bannerImg} />
            <div className={styles.bannerOverlay} />
          </div>
        )}

        <div className={styles.titleRow}>
          <span className={styles.emoji}>{t.sportEmoji || '🏆'}</span>
          <div>
            <h1 className={styles.title}>{t.name}</h1>
            <div className={styles.meta}>
              <span className={styles.sport}>{t.sport}</span>
              <Badge variant={STATUS_VARIANT[t.status] || 'gray'}>
                {t.status === 'ongoing' && <LiveDot />}
                {t.status}
              </Badge>
              {isTeam && <Badge variant="blue">Team Event</Badge>}
            </div>
          </div>
        </div>
      </div>

      {/* Registration Banner */}
      <RegistrationBanner
        tournament={t}
        canRegister={canRegister}
        isFull={isFull}
        deadlinePassed={deadlinePassed}
        participantCount={participantCount}
        isTeam={isTeam}
        onRegisterClick={() => setShowRegModal(true)}
      />

      {/* Tabs */}
      <div className={styles.tabs}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={`${styles.tab} ${activeTab === key ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(key)}
          >
            <Icon size={15} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className={styles.content}>
        {activeTab === 'standings' && <Leaderboard />}
        {activeTab === 'bracket'  && <Bracket />}
        {activeTab === 'scores'   && <Scores />}
        {activeTab === 'players'  && <Players />}
      </div>

      {/* Registration Modal */}
      {showRegModal && (
        isTeam
          ? <TeamRegistrationModal tournament={t} onClose={() => setShowRegModal(false)} />
          : <IndividualRegistrationModal tournament={t} onClose={() => setShowRegModal(false)} />
      )}
    </div>
  );
}

// ─── Registration Banner ─────────────────────────────────────────────────────
function RegistrationBanner({ tournament: t, canRegister, isFull, deadlinePassed, participantCount, isTeam, onRegisterClick }) {
  const maxLabel = isTeam ? 'teams' : 'players';

  return (
    <div className={`${styles.regBanner} ${canRegister && !isFull ? styles.regBannerOpen : styles.regBannerClosed}`}>
      <div className={styles.regBannerLeft}>
        <div className={styles.regBannerIcon}>
          {isTeam ? <IconUsersGroup size={22} /> : <IconUserPlus size={22} />}
        </div>
        <div className={styles.regBannerInfo}>
          <div className={styles.regBannerTitle}>
            {canRegister && !isFull
              ? (isTeam ? 'Team Registration Open' : 'Registration Open')
              : isFull
                ? 'Registration Full'
                : deadlinePassed
                  ? 'Registration Closed'
                  : t.status === 'completed'
                    ? 'Tournament Completed'
                    : 'Registration Closed'
            }
          </div>
          <div className={styles.regBannerSub}>
            {participantCount}{t.maxPlayers ? `/${t.maxPlayers}` : ''} {maxLabel} registered
            {t.registrationDeadline && canRegister && (
              <> · Deadline: {formatDate(t.registrationDeadline)}</>
            )}
            {isTeam && t.teamSize > 1 && (
              <> · {t.teamSize} players per team</>
            )}
          </div>
        </div>
      </div>
      {canRegister && !isFull && (
        <Button variant="primary" onClick={onRegisterClick}>
          {isTeam ? <><IconUsersGroup size={15} /> Register Team</> : <><IconUserPlus size={15} /> Register Now</>}
        </Button>
      )}
    </div>
  );
}

// ─── Individual Registration Modal ───────────────────────────────────────────
function IndividualRegistrationModal({ tournament: t, onClose }) {
  const { registerForTournament } = useTournamentStore();
  const [regName, setRegName]     = useState('');
  const [regTeam, setRegTeam]     = useState('');
  const [regSkill, setRegSkill]   = useState('Intermediate');
  const [regError, setRegError]   = useState('');
  const [regFlash, setRegFlash]   = useState('');

  const handleRegister = async () => {
    if (!regName.trim()) { setRegError('Please enter your name'); return; }
    setRegError('');
    const success = await registerForTournament(t.id, {
      name: regName.trim(),
      team: regTeam.trim(),
      skill: regSkill,
    });
    if (success) {
      setRegFlash('You are registered! 🎉');
      setRegName(''); setRegTeam(''); setRegSkill('Intermediate');
      setTimeout(() => { setRegFlash(''); onClose(); }, 2000);
    } else {
      setRegError('A player with that name is already registered.');
    }
  };

  return (
    <Modal onClose={onClose}>
      <ModalHeader title="Register for tournament" onClose={onClose} />
      {regFlash && <Alert variant="success">{regFlash}</Alert>}
      {regError && <Alert variant="error">{regError}</Alert>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
        <Input label="Your name" value={regName} onChange={e => setRegName(e.target.value)} placeholder="e.g. Shaurya" />
        <Input label="Team / partner (optional)" value={regTeam} onChange={e => setRegTeam(e.target.value)} placeholder="e.g. Team Alpha" />
        <Select label="Skill level" value={regSkill} onChange={e => setRegSkill(e.target.value)}>
          {['Beginner', 'Intermediate', 'Advanced', 'Pro'].map(s => <option key={s}>{s}</option>)}
        </Select>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '1rem' }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleRegister}>Register</Button>
      </div>
    </Modal>
  );
}

// ─── Team Registration Modal ─────────────────────────────────────────────────
function TeamRegistrationModal({ tournament: t, onClose }) {
  const { registerTeamForTournament } = useTournamentStore();
  const teamSize = t.teamSize || 2;
  const [teamName, setTeamName]     = useState('');
  const [captainName, setCaptainName] = useState('');
  const [skill, setSkill]           = useState('Intermediate');
  const [members, setMembers]       = useState(Array(Math.max(teamSize - 1, 1)).fill(''));
  const [error, setError]           = useState('');
  const [flash, setFlash]           = useState('');

  const updateMember = (index, value) => {
    const updated = [...members];
    updated[index] = value;
    setMembers(updated);
  };

  const handleRegister = async () => {
    if (!teamName.trim()) { setError('Please enter a team name'); return; }
    if (!captainName.trim()) { setError('Please enter the captain\'s name'); return; }

    const filledMembers = members.filter(m => m.trim());
    const allMembers = [captainName.trim(), ...filledMembers];

    setError('');
    const success = await registerTeamForTournament(t.id, {
      teamName: teamName.trim(),
      captainName: captainName.trim(),
      members: allMembers,
      skill,
    });
    if (success) {
      setFlash('Team registered! 🎉');
      setTimeout(() => { setFlash(''); onClose(); }, 2000);
    } else {
      setError('A team with that name is already registered.');
    }
  };

  return (
    <Modal onClose={onClose}>
      <ModalHeader title={`Register team for ${t.name}`} onClose={onClose} />
      {flash && <Alert variant="success">{flash}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <div className={styles.teamRegForm}>
        <Input label="Team name" value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="e.g. Thunder Bolts" />
        <Input label="Captain name" value={captainName} onChange={e => setCaptainName(e.target.value)} placeholder="e.g. Shaurya" />
        <Select label="Team skill level" value={skill} onChange={e => setSkill(e.target.value)}>
          {['Beginner', 'Intermediate', 'Advanced', 'Pro'].map(s => <option key={s}>{s}</option>)}
        </Select>

        <div className={styles.teamMembersSection}>
          <label className={styles.teamMembersLabel}>
            Team Members ({members.length} more needed, {teamSize} total including captain)
          </label>
          {members.map((m, i) => (
            <Input
              key={i}
              label={`Member ${i + 2}`}
              value={m}
              onChange={e => updateMember(i, e.target.value)}
              placeholder={`Player ${i + 2} name`}
            />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '1rem' }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleRegister}>
          <IconUsersGroup size={15} /> Register Team
        </Button>
      </div>
    </Modal>
  );
}
