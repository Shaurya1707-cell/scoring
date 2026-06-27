import { IconTrophy, IconChartBar } from '@tabler/icons-react';
import useTournamentStore from '../store/useTournamentStore';
import { Card, StatCard, SectionHeader, Badge, LiveDot, ProgressBar } from '../components/UI';
import styles from './Leaderboard.module.css';

const SKILL_VARIANT = { Pro: 'amber', Advanced: 'teal', Intermediate: 'green', Beginner: 'gray' };
const RANK_COLOR    = ['var(--amber-600)', 'var(--gray-400)', 'var(--amber-800)'];

export default function Leaderboard() {
  const { activeTournament: t, getStats } = useTournamentStore();
  const players = t?.players || [];
  const matches = t?.matches || [];
  const stats  = getStats();
  const sorted = players
    .map(p => ({ ...p, ...(stats[p.id] || { wins: 0, losses: 0, pts: 0, played: 0 }) }))
    .sort((a, b) => b.pts - a.pts || b.wins - a.wins);

  const live      = matches.filter(m => m.status === 'live').length;
  const completed = matches.filter(m => m.status === 'completed').length;
  const upcoming  = matches.filter(m => m.status === 'upcoming').length;
  const maxPts    = Math.max(...sorted.map(p => p.pts), 1);

  return (
    <div className={styles.wrap}>
      <div className={styles.statsRow}>
        <StatCard label="Players"       value={players.length} />
        <StatCard label="Completed"     value={completed} />
        <StatCard label="Live now"      value={live}      color="var(--red-400)" />
        <StatCard label="Upcoming"      value={upcoming}  color="var(--gray-600)" />
      </div>

      <div className={styles.grid}>
        <Card>
          <SectionHeader title="Live standings" icon={() => <LiveDot />} />
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>#</th>
                <th className={styles.th}>Player</th>
                <th className={styles.th}>Skill</th>
                <th className={styles.th}>W</th>
                <th className={styles.th}>L</th>
                <th className={styles.th}>Pts</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => (
                <tr key={p.id} className={styles.tr}>
                  <td>
                    <span className={styles.rank} style={i < 3 ? { color: RANK_COLOR[i] } : {}}>
                      {i === 0 ? '🏆' : i + 1}
                    </span>
                  </td>
                  <td>
                    <div className={styles.playerName}>{p.name}</div>
                    {p.team && <div className={styles.playerTeam}>{p.team}</div>}
                  </td>
                  <td><Badge variant={SKILL_VARIANT[p.skill]}>{p.skill}</Badge></td>
                  <td><b>{p.wins}</b></td>
                  <td className={styles.muted}>{p.losses}</td>
                  <td><b style={{ color: 'var(--green-700)' }}>{p.pts}</b></td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan={6} className={styles.emptyRow}>No players registered yet</td></tr>
              )}
            </tbody>
          </table>
        </Card>

        <Card>
          <SectionHeader title="Points breakdown" icon={IconChartBar} />
          <div className={styles.bars}>
            {sorted.map(p => (
              <div key={p.id} className={styles.barRow}>
                <div className={styles.barLabel}>
                  <span>{p.name}</span>
                  <span style={{ fontWeight: 500, color: 'var(--green-700)' }}>{p.pts} pts</span>
                </div>
                <ProgressBar pct={(p.pts / maxPts) * 100} />
              </div>
            ))}
            {sorted.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>No data yet</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
