import { useState, useRef } from 'react';
import { IconShieldCheck, IconPlus, IconTrash, IconGavel, IconX, IconTrophy, IconUsers as IconUsersAdmin, IconPhoto, IconUpload } from '@tabler/icons-react';
import useTournamentStore, { SPORTS } from '../store/useTournamentStore';
import { Modal, ModalHeader, Button, Input, Select, Alert, Badge } from './UI';
import styles from './AdminPanel.module.css';

export default function AdminPanel({ onClose }) {
  const { adminLoggedIn, adminLogin, adminLogout, activeTournament,
          players: _p, matches: _m, referees: _r,
          addPlayer, removePlayer, addMatch, removeMatch, updateMatch, addReferee,
          removeReferee, assignReferee, playerName, getStats,
          createTournament, updateTournamentMeta, deleteTournament, uploadBanner, tournaments } = useTournamentStore();

  const t = activeTournament;
  const players  = t?.players  || [];
  const matches  = t?.matches  || [];
  const referees = t?.referees || [];

  const [password, setPassword]   = useState('');
  const [loginErr, setLoginErr]   = useState('');
  const [activeTab, setActiveTab] = useState(t ? 'Players' : 'Tournaments');
  const [flash, setFlash]         = useState('');

  const showFlash = (msg) => { setFlash(msg); setTimeout(() => setFlash(''), 2500); };

  const TABS = t
    ? ['Tournaments', 'Players', 'Matches', 'Referees', 'Scores', 'Settings']
    : ['Tournaments'];

  // ── Login screen ──────────────────────────────────────────────────────────
  if (!adminLoggedIn) {
    return (
      <Modal onClose={onClose}>
        <ModalHeader title="Admin login" onClose={onClose} />
        {loginErr && <Alert variant="error">{loginErr}</Alert>}
        <div style={{ marginTop: 12 }}>
          <Input label="Password" type="password" value={password} placeholder="Enter admin password"
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { if (!adminLogin(password)) setLoginErr('Incorrect password'); }}} />
        </div>
        <div style={{ marginTop: '1rem', fontSize: 12, color: 'var(--muted)', marginBottom: '1rem' }}>
          Demo password: <code>admin123</code>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => { if (!adminLogin(password)) setLoginErr('Incorrect password'); }}>
            Login
          </Button>
        </div>
      </Modal>
    );
  }

  // ── Admin panel ───────────────────────────────────────────────────────────
  return (
    <Modal onClose={onClose}>
      <div style={{ minWidth: 0 }}>
        <div className={styles.panelHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconShieldCheck size={18} color="var(--green-700)" />
            <span style={{ fontWeight: 600, fontSize: 16 }}>Admin panel</span>
            {t && <Badge variant="teal">{t.name}</Badge>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="danger" size="sm" onClick={() => { adminLogout(); onClose(); }}>Logout</Button>
            <Button variant="ghost" size="sm" onClick={onClose}><IconX size={14} /></Button>
          </div>
        </div>

        {flash && <Alert variant="success" style={{ marginBottom: 12 }}>{flash}</Alert>}

        <div className={styles.tabs}>
          {TABS.map(tab => (
            <button key={tab} className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab)}>{tab}</button>
          ))}
        </div>

        {activeTab === 'Tournaments' && <TournamentsTab showFlash={showFlash} />}
        {activeTab === 'Players'     && t && <PlayersTab players={players} addPlayer={addPlayer} removePlayer={removePlayer} showFlash={showFlash} tournament={t} />}
        {activeTab === 'Matches'     && t && <MatchesTab players={players} matches={matches} addMatch={addMatch} removeMatch={removeMatch} playerName={playerName} showFlash={showFlash} />}
        {activeTab === 'Referees'    && t && <RefereesTab referees={referees} matches={matches} addReferee={addReferee} removeReferee={removeReferee} assignReferee={assignReferee} playerName={playerName} showFlash={showFlash} />}
        {activeTab === 'Scores'      && t && <ScoresTab matches={matches} updateMatch={updateMatch} playerName={playerName} showFlash={showFlash} />}
        {activeTab === 'Settings'    && t && <SettingsTab tournament={t} updateTournamentMeta={updateTournamentMeta} deleteTournament={deleteTournament} showFlash={showFlash} onClose={onClose} />}
      </div>
    </Modal>
  );
}

// ─── Tournaments tab ─────────────────────────────────────────────────────────
function TournamentsTab({ showFlash }) {
  const { tournaments, createTournament, updateTournamentMeta, deleteTournament, uploadBanner } = useTournamentStore();
  const [name, setName]     = useState('');
  const [sport, setSport]   = useState('Pickleball (Singles)');
  const [maxP, setMaxP]     = useState('16');
  const [startDate, setStartDate]       = useState('');
  const [endDate, setEndDate]           = useState('');
  const [regDeadline, setRegDeadline]   = useState('');
  const [regType, setRegType]           = useState('individual');
  const [teamSize, setTeamSize]         = useState('1');
  const [bannerFile, setBannerFile]     = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);
  const [uploading, setUploading]       = useState(false);
  const bannerInputRef = useRef(null);

  const selectedSport = SPORTS.find(s => s.name === sport) || SPORTS[0];

  // Auto-update registration type and team size when sport changes
  const handleSportChange = (sportName) => {
    setSport(sportName);
    const s = SPORTS.find(x => x.name === sportName);
    if (s) {
      setRegType(s.registrationType);
      setTeamSize(String(s.defaultTeamSize));
    }
  };

  const handleBannerSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showFlash('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showFlash('Image must be under 5 MB');
      return;
    }
    setBannerFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setBannerPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setUploading(true);
    try {
      const tid = await createTournament({
        name: name.trim(),
        sport: selectedSport.name,
        sportEmoji: selectedSport.emoji,
        maxPlayers: parseInt(maxP) || 32,
        startDate: startDate || null,
        endDate: endDate || null,
        registrationDeadline: regDeadline || null,
        registrationType: regType,
        teamSize: parseInt(teamSize) || 1,
      });
      // Upload banner if selected
      if (bannerFile && tid) {
        await uploadBanner(tid, bannerFile);
      }
      setName(''); setStartDate(''); setEndDate(''); setRegDeadline('');
      setBannerFile(null); setBannerPreview(null);
      showFlash('Tournament created!');
    } finally {
      setUploading(false);
    }
  };

  const statusVariant = { ongoing: 'red', upcoming: 'amber', completed: 'green' };
  const nextStatus = { upcoming: 'ongoing', ongoing: 'completed', completed: 'upcoming' };

  return (
    <div className={styles.tabContent}>
      <div className={styles.formBox}>
        <p className={styles.boxTitle}>Create tournament</p>
        <div className={styles.grid2}>
          <Input label="Tournament name" value={name} onChange={e => setName(e.target.value)} placeholder="Campus Cricket Cup" />
          <Select label="Sport" value={sport} onChange={e => handleSportChange(e.target.value)}>
            {SPORTS.map(s => <option key={s.name} value={s.name}>{s.emoji} {s.name}</option>)}
          </Select>
        </div>
        <div className={styles.grid2}>
          <Select label="Registration type" value={regType} onChange={e => setRegType(e.target.value)}>
            <option value="individual">👤 Individual</option>
            <option value="team">👥 Team</option>
          </Select>
          {regType === 'team' && (
            <Input label="Team size (players per team)" type="number" value={teamSize} onChange={e => setTeamSize(e.target.value)} min={2} max={30} />
          )}
          {regType === 'individual' && (
            <Input label={`Max players`} type="number" value={maxP} onChange={e => setMaxP(e.target.value)} min={2} />
          )}
        </div>
        {regType === 'team' && (
          <div className={styles.grid2}>
            <Input label="Max teams" type="number" value={maxP} onChange={e => setMaxP(e.target.value)} min={2} />
            <div />
          </div>
        )}
        <div className={styles.grid2}>
          <Input label="Start date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <Input label="End date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <div className={styles.grid2}>
          <Input label="Registration deadline" type="date" value={regDeadline} onChange={e => setRegDeadline(e.target.value)} />
          <div />
        </div>

        {/* Banner upload */}
        <div className={styles.bannerUpload}>
          <p className={styles.boxTitle}>Tournament banner (optional)</p>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            onChange={handleBannerSelect}
            style={{ display: 'none' }}
          />
          {bannerPreview ? (
            <div className={styles.bannerPreviewWrap}>
              <img src={bannerPreview} alt="Banner preview" className={styles.bannerPreviewImg} />
              <div className={styles.bannerActions}>
                <Button variant="ghost" size="sm" onClick={() => bannerInputRef.current?.click()}>
                  <IconPhoto size={14} /> Change
                </Button>
                <Button variant="danger" size="sm" onClick={() => { setBannerFile(null); setBannerPreview(null); }}>
                  <IconTrash size={13} /> Remove
                </Button>
              </div>
            </div>
          ) : (
            <button className={styles.bannerDropzone} onClick={() => bannerInputRef.current?.click()}>
              <IconUpload size={22} />
              <span>Click to upload a banner image</span>
              <span className={styles.bannerHint}>Recommended: 1200×400px, under 5 MB</span>
            </button>
          )}
        </div>

        <Button variant="primary" size="sm" onClick={handleCreate} disabled={uploading} style={{ marginTop: 10 }}>
          {uploading ? 'Creating…' : <><IconPlus size={14} /> Create tournament</>}
        </Button>
      </div>
      <div className={styles.listBox}>
        <p className={styles.boxTitle}>All tournaments</p>
        {tournaments.length === 0 && <p className={styles.empty}>No tournaments yet</p>}
        {tournaments.map(t => (
          <div key={t.id} className={styles.listRow}>
            <div>
              <span className={styles.rowName}>{t.sportEmoji || '🏆'} {t.name}</span>
              <Badge variant={statusVariant[t.status] || 'gray'}>{t.status}</Badge>
              {t.registrationType === 'team' && <Badge variant="blue">Team</Badge>}
              <span className={styles.rowSub}>
                {' · '}
                {t.registrationType === 'team'
                  ? `${(t.teams || []).length} teams`
                  : `${(t.players || []).length} players`
                }
                {' · '}{(t.matches || []).length} matches
              </span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <Button variant="ghost" size="sm" onClick={async () => {
                await updateTournamentMeta(t.id, { status: nextStatus[t.status] || 'upcoming' });
                showFlash(`Status → ${nextStatus[t.status]}`);
              }}>
                {t.status === 'upcoming' ? '▶ Start' : t.status === 'ongoing' ? '✓ End' : '↺ Reopen'}
              </Button>
              <Button variant="danger" size="sm" onClick={async () => {
                if (confirm('Delete this tournament?')) {
                  await deleteTournament(t.id);
                  showFlash('Deleted');
                }
              }}><IconTrash size={13} /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Settings tab ────────────────────────────────────────────────────────────
function SettingsTab({ tournament: t, updateTournamentMeta, deleteTournament, showFlash, onClose }) {
  const { uploadBanner } = useTournamentStore();
  const [name, setName]   = useState(t.name);
  const [status, setStatus] = useState(t.status);
  const [maxP, setMaxP]   = useState(t.maxPlayers || '');
  const [regType, setRegType] = useState(t.registrationType || 'individual');
  const [teamSize, setTeamSize] = useState(t.teamSize || 1);
  const [bannerUploading, setBannerUploading] = useState(false);
  const settingsBannerRef = useRef(null);

  const handleSave = async () => {
    await updateTournamentMeta(t.id, {
      name: name.trim() || t.name,
      status,
      maxPlayers: parseInt(maxP) || null,
      registrationType: regType,
      teamSize: parseInt(teamSize) || 1,
    });
    showFlash('Settings saved!');
  };

  const handleBannerUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showFlash('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { showFlash('Image must be under 5 MB'); return; }
    setBannerUploading(true);
    try {
      await uploadBanner(t.id, file);
      showFlash('Banner updated!');
    } catch (err) {
      showFlash('Failed to upload banner');
    } finally {
      setBannerUploading(false);
      if (settingsBannerRef.current) settingsBannerRef.current.value = '';
    }
  };

  const handleRemoveBanner = async () => {
    await updateTournamentMeta(t.id, { bannerUrl: null });
    showFlash('Banner removed');
  };

  return (
    <div className={styles.tabContent}>
      <div className={styles.formBox}>
        <p className={styles.boxTitle}>Tournament settings</p>
        <Input label="Name" value={name} onChange={e => setName(e.target.value)} />
        <div className={styles.grid2} style={{ marginTop: 8 }}>
          <Select label="Status" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="upcoming">Upcoming</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
          </Select>
          <Input label={regType === 'team' ? 'Max teams' : 'Max players'} type="number" value={maxP} onChange={e => setMaxP(e.target.value)} min={2} />
        </div>
        <div className={styles.grid2} style={{ marginTop: 8 }}>
          <Select label="Registration type" value={regType} onChange={e => setRegType(e.target.value)}>
            <option value="individual">👤 Individual</option>
            <option value="team">👥 Team</option>
          </Select>
          {regType === 'team' && (
            <Input label="Team size" type="number" value={teamSize} onChange={e => setTeamSize(e.target.value)} min={2} max={30} />
          )}
        </div>
        <Button variant="primary" size="sm" onClick={handleSave} style={{ marginTop: 10 }}>Save settings</Button>
      </div>

      {/* Banner management */}
      <div className={styles.formBox}>
        <p className={styles.boxTitle}>Tournament banner</p>
        <input
          ref={settingsBannerRef}
          type="file"
          accept="image/*"
          onChange={handleBannerUpload}
          style={{ display: 'none' }}
        />
        {t.bannerUrl ? (
          <div className={styles.bannerPreviewWrap}>
            <img src={t.bannerUrl} alt="Tournament banner" className={styles.bannerPreviewImg} />
            <div className={styles.bannerActions}>
              <Button variant="ghost" size="sm" onClick={() => settingsBannerRef.current?.click()} disabled={bannerUploading}>
                {bannerUploading ? 'Uploading…' : <><IconPhoto size={14} /> Change</>}
              </Button>
              <Button variant="danger" size="sm" onClick={handleRemoveBanner}>
                <IconTrash size={13} /> Remove
              </Button>
            </div>
          </div>
        ) : (
          <button className={styles.bannerDropzone} onClick={() => settingsBannerRef.current?.click()} disabled={bannerUploading}>
            {bannerUploading ? (
              <span>Uploading…</span>
            ) : (
              <>
                <IconUpload size={22} />
                <span>Click to upload a banner image</span>
                <span className={styles.bannerHint}>Recommended: 1200×400px, under 5 MB</span>
              </>
            )}
          </button>
        )}
      </div>

      <div className={styles.formBox} style={{ borderColor: 'var(--red-400)' }}>
        <p className={styles.boxTitle} style={{ color: 'var(--red-600)' }}>Danger zone</p>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>Permanently delete this tournament and all its data.</p>
        <Button variant="danger" size="sm" onClick={async () => {
          if (confirm('Are you sure? This cannot be undone.')) {
            await deleteTournament(t.id);
            showFlash('Tournament deleted');
            onClose();
          }
        }}><IconTrash size={13} /> Delete tournament</Button>
      </div>
    </div>
  );
}

// ─── Players tab ─────────────────────────────────────────────────────────────
function PlayersTab({ players, addPlayer, removePlayer, showFlash, tournament }) {
  const [name, setName]   = useState('');
  const [team, setTeam]   = useState('');
  const [skill, setSkill] = useState('Intermediate');

  const handleAdd = () => {
    if (!name.trim()) return;
    addPlayer({ name: name.trim(), team: team.trim(), skill });
    setName(''); setTeam('');
    showFlash('Player added!');
  };

  return (
    <div className={styles.tabContent}>
      <div className={styles.formBox}>
        <p className={styles.boxTitle}>Add player</p>
        <div className={styles.grid2}>
          <Input label="Name" value={name} onChange={e => setName(e.target.value)} placeholder="Alex Johnson" />
          <Select label="Skill" value={skill} onChange={e => setSkill(e.target.value)}>
            {['Beginner','Intermediate','Advanced','Pro'].map(s => <option key={s}>{s}</option>)}
          </Select>
        </div>
        <Input label="Team / partner (optional)" value={team} onChange={e => setTeam(e.target.value)} placeholder="Net Ninjas" />
        <Button variant="primary" size="sm" onClick={handleAdd} style={{ marginTop: 10 }}><IconPlus size={14} /> Add player</Button>
      </div>
      <div className={styles.listBox}>
        {players.length === 0 && <p className={styles.empty}>No players yet</p>}
        {players.map(p => (
          <div key={p.id} className={styles.listRow}>
            <div>
              <span className={styles.rowName}>{p.isTeam ? '👥 ' : ''}{p.name}</span>
              <Badge variant="teal">{p.skill}</Badge>
              {p.team && <span className={styles.rowSub}> · {p.team}</span>}
              {p.isTeam && <Badge variant="blue">Team</Badge>}
            </div>
            <Button variant="danger" size="sm" onClick={() => removePlayer(p.id)}><IconTrash size={13} /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Matches tab ─────────────────────────────────────────────────────────────
function MatchesTab({ players, matches, addMatch, removeMatch, playerName, showFlash }) {
  const [p1, setP1]       = useState(players[0]?.id || '');
  const [p2, setP2]       = useState(players[1]?.id || '');
  const [round, setRound] = useState('Group Stage');
  const [court, setCourt] = useState('');

  const handleAdd = () => {
    if (!p1 || !p2 || p1 === p2) return;
    addMatch({ p1: parseInt(p1), p2: parseInt(p2), score1: 0, score2: 0, round, court: court || 'TBD', status: 'upcoming' });
    setCourt('');
    showFlash('Match created!');
  };

  const statusVariant = { completed: 'green', live: 'red', upcoming: 'gray' };

  return (
    <div className={styles.tabContent}>
      <div className={styles.formBox}>
        <p className={styles.boxTitle}>Create match</p>
        <div className={styles.grid2}>
          <Select label="Player 1" value={p1} onChange={e => setP1(e.target.value)}>
            {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select label="Player 2" value={p2} onChange={e => setP2(e.target.value)}>
            {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>
        <div className={styles.grid2}>
          <Select label="Round" value={round} onChange={e => setRound(e.target.value)}>
            {['Group Stage','Quarter-Final','Semi-Final','Final'].map(r => <option key={r}>{r}</option>)}
          </Select>
          <Input label="Court" value={court} onChange={e => setCourt(e.target.value)} placeholder="Court 1" />
        </div>
        <Button variant="primary" size="sm" onClick={handleAdd} style={{ marginTop: 10 }}><IconPlus size={14} /> Create match</Button>
      </div>
      <div className={styles.listBox}>
        {matches.length === 0 && <p className={styles.empty}>No matches yet</p>}
        {matches.map(m => (
          <div key={m.id} className={styles.listRow}>
            <div>
              <span className={styles.rowName}>{playerName(m.p1)} vs {playerName(m.p2)}</span>
              <Badge variant={statusVariant[m.status]}>{m.status}</Badge>
              <span className={styles.rowSub}> · {m.round} · {m.court}</span>
            </div>
            <Button variant="danger" size="sm" onClick={() => removeMatch(m.id)}><IconTrash size={13} /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Referees tab ─────────────────────────────────────────────────────────────
function RefereesTab({ referees, matches, addReferee, removeReferee, assignReferee, playerName, showFlash }) {
  const [name, setName] = useState('');
  const [pin, setPin]   = useState('');

  const handleAdd = () => {
    if (!name.trim() || pin.length < 4) return;
    addReferee({ name: name.trim(), pin });
    setName(''); setPin('');
    showFlash('Referee added!');
  };

  const activeMatches = matches.filter(m => m.p1 && m.p2);

  return (
    <div className={styles.tabContent}>
      <div className={styles.formBox}>
        <p className={styles.boxTitle}>Add referee</p>
        <div className={styles.grid2}>
          <Input label="Full name" value={name} onChange={e => setName(e.target.value)} placeholder="James Okoro" />
          <Input label="PIN (4+ digits)" type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" maxLength={8} />
        </div>
        <Button variant="primary" size="sm" onClick={handleAdd} style={{ marginTop: 10 }}><IconPlus size={14} /> Add referee</Button>
      </div>
      <div className={styles.listBox}>
        <p className={styles.boxTitle} style={{ marginBottom: 8 }}>Referees & match assignments</p>
        {referees.map(r => {
          const assigned = activeMatches.find(m => m.refereeId === r.id);
          return (
            <div key={r.id} className={styles.refRow}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconGavel size={15} color="var(--blue-600)" />
                  <span className={styles.rowName}>{r.name}</span>
                  {assigned
                    ? <Badge variant="blue">Assigned</Badge>
                    : <Badge variant="gray">Unassigned</Badge>}
                </div>
                <div style={{ marginTop: 6 }}>
                  <Select value={assigned?.id || ''} onChange={e => {
                    const matchId = parseInt(e.target.value);
                    if (matchId) assignReferee(matchId, r.id);
                  }}>
                    <option value="">— Assign to match —</option>
                    {activeMatches.filter(m => m.status !== 'completed').map(m => (
                      <option key={m.id} value={m.id}>
                        {playerName(m.p1)} vs {playerName(m.p2)} ({m.round})
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <Button variant="danger" size="sm" onClick={() => removeReferee(r.id)} style={{ alignSelf: 'flex-start', marginTop: 2 }}><IconTrash size={13} /></Button>
            </div>
          );
        })}
        {referees.length === 0 && <p className={styles.empty}>No referees added yet</p>}
      </div>
    </div>
  );
}

// ─── Scores tab ──────────────────────────────────────────────────────────────
function ScoresTab({ matches, updateMatch, playerName, showFlash }) {
  const [sel, setSel]   = useState(matches.find(m => m.p1 && m.p2 && m.status !== 'completed')?.id || '');
  const [s1, setS1]     = useState('');
  const [s2, setS2]     = useState('');

  const active = matches.filter(m => m.p1 && m.p2 && m.status !== 'completed');
  const match  = matches.find(m => m.id === parseInt(sel));

  const handleSelect = (id) => {
    setSel(id);
    const m = matches.find(x => x.id === parseInt(id));
    if (m) { setS1(m.score1); setS2(m.score2); }
  };

  const save = (status) => {
    if (!match) return;
    updateMatch(match.id, { score1: parseInt(s1)||0, score2: parseInt(s2)||0, status });
    showFlash('Score saved!');
  };

  return (
    <div className={styles.tabContent}>
      <Select label="Select match" value={sel} onChange={e => handleSelect(e.target.value)}>
        <option value="">— Pick a match —</option>
        {active.map(m => <option key={m.id} value={m.id}>{playerName(m.p1)} vs {playerName(m.p2)} ({m.round})</option>)}
      </Select>
      {match && (
        <div className={styles.scoreEditor}>
          <div className={styles.scoreTeam}>
            <div className={styles.scoreTeamName}>{playerName(match.p1)}</div>
            <input type="number" className={styles.scoreBig} min={0} max={99} value={s1} onChange={e => setS1(e.target.value)} />
          </div>
          <div className={styles.scoreVs}>VS</div>
          <div className={styles.scoreTeam}>
            <div className={styles.scoreTeamName}>{playerName(match.p2)}</div>
            <input type="number" className={styles.scoreBig} min={0} max={99} value={s2} onChange={e => setS2(e.target.value)} />
          </div>
        </div>
      )}
      {match && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 16 }}>
          <Button variant="primary" onClick={() => save('live')}>Set live</Button>
          <Button variant="ghost" onClick={() => save('completed')}>Mark complete</Button>
        </div>
      )}
    </div>
  );
}
