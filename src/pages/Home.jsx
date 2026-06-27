import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { IconCalendar, IconUsers, IconTrophy, IconClock, IconUsersGroup } from '@tabler/icons-react';
import useTournamentStore from '../store/useTournamentStore';
import { Badge, LiveDot } from '../components/UI';
import styles from './Home.module.css';

const STATUS_CONFIG = {
  ongoing:   { label: 'Live',      variant: 'red',   section: '🔴 Ongoing Tournaments' },
  upcoming:  { label: 'Upcoming',  variant: 'amber', section: '📅 Upcoming Tournaments' },
  completed: { label: 'Completed', variant: 'green', section: '✅ Past Tournaments' },
};

function formatDate(val) {
  if (!val) return '—';
  // Firestore Timestamp
  if (val.toDate) return val.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  // ISO string
  return new Date(val).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isDeadlinePassed(deadline) {
  if (!deadline) return false;
  const d = deadline.toDate ? deadline.toDate() : new Date(deadline);
  return d < new Date();
}

export default function Home() {
  const { tournaments, tournamentsLoaded, subscribeTournaments, unsubscribeTournaments } = useTournamentStore();

  useEffect(() => {
    subscribeTournaments();
    return () => unsubscribeTournaments();
  }, []);

  if (!tournamentsLoaded) {
    return <div className={styles.loading}>Loading tournaments…</div>;
  }

  const ongoing   = tournaments.filter(t => t.status === 'ongoing');
  const upcoming  = tournaments.filter(t => t.status === 'upcoming');
  const completed = tournaments.filter(t => t.status === 'completed');

  const sections = [
    { key: 'ongoing',   items: ongoing,   ...STATUS_CONFIG.ongoing },
    { key: 'upcoming',  items: upcoming,  ...STATUS_CONFIG.upcoming },
    { key: 'completed', items: completed, ...STATUS_CONFIG.completed },
  ].filter(s => s.items.length > 0);

  return (
    <div className={styles.wrap}>
      <div className={styles.hero}>
        <h1 className={styles.heroTitle}>🏆 TournScore</h1>
        <p className={styles.heroSub}>Live tournaments, real-time scores, instant updates.</p>
      </div>

      {sections.length === 0 && (
        <div className={styles.empty}>
          <IconTrophy size={48} strokeWidth={1} style={{ opacity: 0.2 }} />
          <p>No tournaments yet.</p>
          <p className={styles.emptySub}>An admin can create tournaments from the Admin panel.</p>
        </div>
      )}

      {sections.map(sec => (
        <section key={sec.key} className={styles.section}>
          <h2 className={styles.sectionTitle}>{sec.section}</h2>
          <div className={styles.grid}>
            {sec.items.map(t => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TournamentCard({ tournament: t }) {
  const isTeam = t.registrationType === 'team';
  const playerCount = isTeam ? (t.teams || []).length : (t.players || []).length;
  const matchCount  = (t.matches || []).length;
  const liveMatches = (t.matches || []).filter(m => m.status === 'live').length;
  const deadlinePassed = isDeadlinePassed(t.registrationDeadline);
  const canRegister = (t.status === 'upcoming' || t.status === 'ongoing') && !deadlinePassed;
  const isFull = t.maxPlayers && playerCount >= t.maxPlayers;
  const cfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.upcoming;

  return (
    <Link to={`/tournament/${t.id}`} className={`${styles.card} ${t.bannerUrl ? styles.cardWithBanner : ''}`}>
      {t.bannerUrl && (
        <div className={styles.cardBannerWrap}>
          <img src={t.bannerUrl} alt="" className={styles.cardBannerImg} />
        </div>
      )}
      <div className={styles.cardTop}>
        <span className={styles.sportEmoji}>{t.sportEmoji || '🏆'}</span>
        <div className={styles.cardMeta}>
          <Badge variant={cfg.variant}>
            {t.status === 'ongoing' && <LiveDot />}
            {cfg.label}
          </Badge>
          {isTeam && <Badge variant="blue">Team</Badge>}
          {t.status === 'ongoing' && liveMatches > 0 && (
            <span className={styles.liveCount}>{liveMatches} live match{liveMatches !== 1 ? 'es' : ''}</span>
          )}
        </div>
      </div>

      <h3 className={styles.cardName}>{t.name}</h3>
      <span className={styles.cardSport}>{t.sport}</span>

      <div className={styles.cardInfo}>
        <div className={styles.infoItem}>
          {isTeam ? <IconUsersGroup size={14} /> : <IconUsers size={14} />}
          <span>{playerCount}{t.maxPlayers ? `/${t.maxPlayers}` : ''} {isTeam ? 'teams' : 'players'}</span>
        </div>
        {t.startDate && (
          <div className={styles.infoItem}>
            <IconCalendar size={14} />
            <span>{formatDate(t.startDate)}</span>
          </div>
        )}
        {(t.status === 'upcoming' || t.status === 'ongoing') && t.registrationDeadline && (
          <div className={`${styles.infoItem} ${deadlinePassed ? styles.deadlinePassed : styles.deadlineOpen}`}>
            <IconClock size={14} />
            <span>{deadlinePassed ? 'Registration closed' : `Register by ${formatDate(t.registrationDeadline)}`}</span>
          </div>
        )}
        {canRegister && !isFull && !t.registrationDeadline && (
          <div className={`${styles.infoItem} ${styles.deadlineOpen}`}>
            <IconClock size={14} />
            <span>Registration open</span>
          </div>
        )}
        {t.status === 'completed' && (
          <div className={styles.infoItem}>
            <IconTrophy size={14} />
            <span>{matchCount} matches played</span>
          </div>
        )}
      </div>

      {canRegister && !isFull && (
        <div className={styles.regTag}>
          Open for registration →
        </div>
      )}
    </Link>
  );
}
