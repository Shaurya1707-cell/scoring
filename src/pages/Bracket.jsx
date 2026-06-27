import useTournamentStore from '../store/useTournamentStore';
import { Card, Badge } from '../components/UI';
import styles from './Bracket.module.css';

const ROUNDS = ['Group Stage', 'Quarter-Final', 'Semi-Final', 'Final'];

export default function Bracket() {
  const { activeTournament: t, playerName } = useTournamentStore();
  const matches = t?.matches || [];
  const rounds = ROUNDS.filter(r => matches.some(m => m.round === r));

  return (
    <Card>
      <h2 className={styles.title}>Tournament bracket</h2>
      <div className={styles.scroll}>
        <div className={styles.bracket}>
          {rounds.map((round, ri) => {
            const games = matches.filter(m => m.round === round);
            return (
              <div key={round} className={styles.roundCol}>
                <div className={styles.roundLabel}>{round}</div>
                <div className={styles.games} style={{ gap: ri === 0 ? 8 : ri === 1 ? 48 : 100 }}>
                  {games.map(m => {
                    const w1 = m.score1 > m.score2 && m.status === 'completed';
                    const w2 = m.score2 > m.score1 && m.status === 'completed';
                    return (
                      <div key={m.id} className={styles.matchCard}>
                        {m.status === 'live' && (
                          <div className={styles.liveBar}>
                            <span className={styles.liveDot} /> LIVE · {m.court}
                          </div>
                        )}
                        <div className={`${styles.matchTeam} ${w1 ? styles.winner : ''}`}>
                          <span>{playerName(m.p1)}</span>
                          {m.status !== 'upcoming' && <span className={styles.score}>{m.score1}</span>}
                        </div>
                        <div className={styles.divider} />
                        <div className={`${styles.matchTeam} ${w2 ? styles.winner : ''}`}>
                          <span>{playerName(m.p2)}</span>
                          {m.status !== 'upcoming' && <span className={styles.score}>{m.score2}</span>}
                        </div>
                        {m.status === 'upcoming' && (
                          <div className={styles.upcomingBar}>{m.court}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
