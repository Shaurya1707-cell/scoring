import { IconClipboardList, IconGavel } from '@tabler/icons-react';
import useTournamentStore from '../store/useTournamentStore';
import { SectionHeader, Badge, EmptyState, LiveDot } from '../components/UI';
import styles from './Scores.module.css';

const STATUS_VARIANT = { completed: 'green', live: 'red', upcoming: 'gray' };

export default function Scores() {
  const { activeTournament: t, playerName } = useTournamentStore();
  const matches = t?.matches || [];
  const referees = t?.referees || [];
  const shown = matches.filter(m => m.p1 && m.p2);

  const live      = shown.filter(m => m.status === 'live');
  const completed = shown.filter(m => m.status === 'completed');
  const upcoming  = shown.filter(m => m.status === 'upcoming');

  if (!shown.length) {
    return <EmptyState icon={IconClipboardList} message="No matches created yet. Admin can create matches in the admin panel." />;
  }

  const getReferee = (refereeId) => referees.find(r => r.id === refereeId);

  const MatchCard = ({ m }) => {
    const w1  = m.score1 > m.score2 && m.status === 'completed';
    const w2  = m.score2 > m.score1 && m.status === 'completed';
    const ref = getReferee(m.refereeId);
    return (
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.meta}>{m.round} · {m.court}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {m.status === 'live' && <LiveDot />}
            <Badge variant={STATUS_VARIANT[m.status]}>{m.status}</Badge>
          </div>
        </div>
        <div className={styles.teams}>
          <div className={`${styles.teamRow} ${w1 ? styles.winner : ''}`}>
            <span>{playerName(m.p1)}</span>
            <span className={`${styles.pts} ${!w1 && m.status !== 'upcoming' ? styles.loser : ''}`}>
              {m.status !== 'upcoming' ? m.score1 : '—'}
            </span>
          </div>
          <div className={styles.sep} />
          <div className={`${styles.teamRow} ${w2 ? styles.winner : ''}`}>
            <span>{playerName(m.p2)}</span>
            <span className={`${styles.pts} ${!w2 && m.status !== 'upcoming' ? styles.loser : ''}`}>
              {m.status !== 'upcoming' ? m.score2 : '—'}
            </span>
          </div>
        </div>
        {ref && (
          <div className={styles.refTag}>
            <IconGavel size={12} /> {ref.name}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.wrap}>
      {live.length > 0 && (
        <section>
          <SectionHeader title="Live matches" icon={() => <LiveDot />} />
          <div className={styles.grid}>{live.map(m => <MatchCard key={m.id} m={m} />)}</div>
        </section>
      )}
      {upcoming.length > 0 && (
        <section>
          <SectionHeader title="Upcoming" />
          <div className={styles.grid}>{upcoming.map(m => <MatchCard key={m.id} m={m} />)}</div>
        </section>
      )}
      {completed.length > 0 && (
        <section>
          <SectionHeader title="Completed" />
          <div className={styles.grid}>{completed.map(m => <MatchCard key={m.id} m={m} />)}</div>
        </section>
      )}
    </div>
  );
}
