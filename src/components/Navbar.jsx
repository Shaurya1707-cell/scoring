import { NavLink, useLocation } from 'react-router-dom';
import { IconTrophy, IconLock, IconShieldCheck, IconGavel } from '@tabler/icons-react';
import useTournamentStore from '../store/useTournamentStore';
import styles from './Navbar.module.css';

export default function Navbar({ onAdminClick, onRefereeClick }) {
  const { adminLoggedIn, currentReferee, activeTournament } = useTournamentStore();
  const location = useLocation();
  const isInsideTournament = location.pathname.startsWith('/tournament/');

  return (
    <nav className={styles.nav}>
      <NavLink to="/" className={styles.brand}>
        <span className={styles.brandIcon}>🏆</span>
        <span className={styles.brandText}>TournScore</span>
      </NavLink>

      {isInsideTournament && activeTournament && (
        <div className={styles.tournamentInfo}>
          <span className={styles.tournamentEmoji}>{activeTournament.sportEmoji || '🏆'}</span>
          <span className={styles.tournamentName}>{activeTournament.name}</span>
        </div>
      )}

      <div className={styles.authBtns}>
        {isInsideTournament && (
          <>
            {currentReferee ? (
              <button className={`${styles.authBtn} ${styles.refActive}`} onClick={onRefereeClick}>
                <IconGavel size={15} aria-hidden />
                <span>{currentReferee.name}</span>
              </button>
            ) : (
              <button className={`${styles.authBtn} ${styles.refBtn}`} onClick={onRefereeClick}>
                <IconGavel size={15} aria-hidden />
                <span>Referee</span>
              </button>
            )}
          </>
        )}
        <button
          className={`${styles.authBtn} ${adminLoggedIn ? styles.adminActive : ''}`}
          onClick={onAdminClick}
        >
          {adminLoggedIn
            ? <><IconShieldCheck size={15} aria-hidden /><span>Admin</span></>
            : <><IconLock size={15} aria-hidden /><span>Admin</span></>
          }
        </button>
      </div>
    </nav>
  );
}
