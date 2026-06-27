import { useState } from 'react';
import { IconUsers, IconUserPlus, IconUsersGroup, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import useTournamentStore from '../store/useTournamentStore';
import { SectionHeader, Badge, Avatar, EmptyState, Button, Input, Select, Alert, Modal, ModalHeader } from '../components/UI';
import styles from './Players.module.css';

const SKILL_VARIANT = { Pro: 'amber', Advanced: 'teal', Intermediate: 'green', Beginner: 'gray' };

function isDeadlinePassed(deadline) {
  if (!deadline) return false;
  const d = deadline.toDate ? deadline.toDate() : new Date(deadline);
  return d < new Date();
}

export default function Players() {
  const { activeTournament: t, getStats, registerForTournament, registerTeamForTournament } = useTournamentStore();
  const players = t?.players || [];
  const teams = t?.teams || [];
  const stats = getStats();
  const isTeam = t?.registrationType === 'team';

  const [showRegister, setShowRegister] = useState(false);
  // Individual registration state
  const [regName, setRegName]     = useState('');
  const [regTeam, setRegTeam]     = useState('');
  const [regSkill, setRegSkill]   = useState('Intermediate');
  const [regError, setRegError]   = useState('');
  const [regFlash, setRegFlash]   = useState('');
  // Team registration state
  const [teamName, setTeamName]       = useState('');
  const [captainName, setCaptainName] = useState('');
  const [teamSkill, setTeamSkill]     = useState('Intermediate');
  const [members, setMembers]         = useState([]);
  const [teamError, setTeamError]     = useState('');
  const [teamFlash, setTeamFlash]     = useState('');

  const canRegister = t && (t.status === 'upcoming' || t.status === 'ongoing') && !isDeadlinePassed(t.registrationDeadline);
  const participantCount = isTeam ? teams.length : players.length;
  const isFull = t && t.maxPlayers && participantCount >= t.maxPlayers;

  const initTeamMembers = () => {
    const size = t?.teamSize || 2;
    setMembers(Array(Math.max(size - 1, 1)).fill(''));
  };

  const handleOpenRegister = () => {
    if (isTeam) initTeamMembers();
    setShowRegister(true);
  };

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
      setTimeout(() => { setRegFlash(''); setShowRegister(false); }, 2000);
    } else {
      setRegError('A player with that name is already registered.');
    }
  };

  const handleTeamRegister = async () => {
    if (!teamName.trim()) { setTeamError('Please enter a team name'); return; }
    if (!captainName.trim()) { setTeamError('Please enter the captain\'s name'); return; }
    setTeamError('');

    const filledMembers = members.filter(m => m.trim());
    const allMembers = [captainName.trim(), ...filledMembers];

    const success = await registerTeamForTournament(t.id, {
      teamName: teamName.trim(),
      captainName: captainName.trim(),
      members: allMembers,
      skill: teamSkill,
    });
    if (success) {
      setTeamFlash('Team registered! 🎉');
      setTeamName(''); setCaptainName(''); setTeamSkill('Intermediate'); setMembers([]);
      setTimeout(() => { setTeamFlash(''); setShowRegister(false); }, 2000);
    } else {
      setTeamError('A team with that name is already registered.');
    }
  };

  const updateMember = (index, value) => {
    const updated = [...members];
    updated[index] = value;
    setMembers(updated);
  };

  return (
    <div>
      <SectionHeader
        title={isTeam ? 'Registered teams' : 'Registered players'}
        icon={isTeam ? IconUsersGroup : IconUsers}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Badge variant="green">
              {participantCount}{t?.maxPlayers ? `/${t.maxPlayers}` : ''} {isTeam ? 'teams' : 'players'}
            </Badge>
            {canRegister && !isFull && (
              <Button variant="primary" size="sm" onClick={handleOpenRegister}>
                {isTeam ? <><IconUsersGroup size={14} /> Register Team</> : <><IconUserPlus size={14} /> Register</>}
              </Button>
            )}
            {isFull && <Badge variant="red">Full</Badge>}
          </div>
        }
      />

      {/* Individual Players Display */}
      {!isTeam && (
        <>
          {players.length === 0 ? (
            <EmptyState icon={IconUsers} message="No players registered yet. Be the first to register!" />
          ) : (
            <div className={styles.grid}>
              {players.map(p => {
                const st = stats[p.id] || { wins: 0, losses: 0, pts: 0 };
                return (
                  <div key={p.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <Avatar name={p.name} size={42} />
                      <div className={styles.info}>
                        <div className={styles.name}>{p.name}</div>
                        <div className={styles.team}>{p.team || 'Solo'}</div>
                      </div>
                      <Badge variant={SKILL_VARIANT[p.skill]}>{p.skill}</Badge>
                    </div>
                    <div className={styles.stats}>
                      <div className={styles.stat}><div className={styles.statVal}>{st.wins}</div><div className={styles.statLbl}>Wins</div></div>
                      <div className={styles.statDiv} />
                      <div className={styles.stat}><div className={styles.statVal}>{st.losses}</div><div className={styles.statLbl}>Losses</div></div>
                      <div className={styles.statDiv} />
                      <div className={styles.stat}><div className={styles.statVal} style={{ color: 'var(--green-700)' }}>{st.pts}</div><div className={styles.statLbl}>Pts</div></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Team Display */}
      {isTeam && (
        <>
          {teams.length === 0 ? (
            <EmptyState icon={IconUsersGroup} message="No teams registered yet. Be the first to register your team!" />
          ) : (
            <div className={styles.teamGrid}>
              {teams.map(team => {
                const st = stats[team.id] || { wins: 0, losses: 0, pts: 0 };
                return <TeamCard key={team.id} team={team} stats={st} />;
              })}
            </div>
          )}
        </>
      )}

      {/* Registration Modal */}
      {showRegister && !isTeam && (
        <Modal onClose={() => setShowRegister(false)}>
          <ModalHeader title="Register for tournament" onClose={() => setShowRegister(false)} />
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
            <Button variant="ghost" onClick={() => setShowRegister(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleRegister}>Register</Button>
          </div>
        </Modal>
      )}

      {/* Team Registration Modal */}
      {showRegister && isTeam && (
        <Modal onClose={() => setShowRegister(false)}>
          <ModalHeader title={`Register team for ${t.name}`} onClose={() => setShowRegister(false)} />
          {teamFlash && <Alert variant="success">{teamFlash}</Alert>}
          {teamError && <Alert variant="error">{teamError}</Alert>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            <Input label="Team name" value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="e.g. Thunder Bolts" />
            <Input label="Captain name" value={captainName} onChange={e => setCaptainName(e.target.value)} placeholder="e.g. Shaurya" />
            <Select label="Team skill level" value={teamSkill} onChange={e => setTeamSkill(e.target.value)}>
              {['Beginner', 'Intermediate', 'Advanced', 'Pro'].map(s => <option key={s}>{s}</option>)}
            </Select>
            <div className={styles.teamMembersSection}>
              <div className={styles.teamMembersLabel}>
                Team Members ({members.filter(m => m.trim()).length + 1}/{t.teamSize || 2} filled)
              </div>
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
            <Button variant="ghost" onClick={() => setShowRegister(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleTeamRegister}>
              <IconUsersGroup size={15} /> Register Team
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Team Card ───────────────────────────────────────────────────────────────
function TeamCard({ team, stats: st }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={styles.teamCard}>
      <div className={styles.teamCardTop} onClick={() => setExpanded(!expanded)}>
        <div className={styles.teamCardLeft}>
          <div className={styles.teamAvatar}>
            {team.teamName.substring(0, 2).toUpperCase()}
          </div>
          <div className={styles.teamInfo}>
            <div className={styles.teamName}>{team.teamName}</div>
            <div className={styles.teamCaptain}>👑 {team.captainName} · {team.members?.length || 0} members</div>
          </div>
        </div>
        <div className={styles.teamCardRight}>
          <Badge variant={SKILL_VARIANT[team.skill]}>{team.skill}</Badge>
          {expanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
        </div>
      </div>

      <div className={styles.teamStats}>
        <div className={styles.stat}><div className={styles.statVal}>{st.wins}</div><div className={styles.statLbl}>Wins</div></div>
        <div className={styles.statDiv} />
        <div className={styles.stat}><div className={styles.statVal}>{st.losses}</div><div className={styles.statLbl}>Losses</div></div>
        <div className={styles.statDiv} />
        <div className={styles.stat}><div className={styles.statVal} style={{ color: 'var(--green-700)' }}>{st.pts}</div><div className={styles.statLbl}>Pts</div></div>
      </div>

      {expanded && team.members && team.members.length > 0 && (
        <div className={styles.teamMembers}>
          <div className={styles.teamMembersTitle}>Team Roster</div>
          {team.members.map((member, i) => (
            <div key={i} className={styles.teamMemberRow}>
              <Avatar name={member} size={28} />
              <span className={styles.teamMemberName}>{member}</span>
              {i === 0 && <Badge variant="amber">Captain</Badge>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
