import styles from './UI.module.css';

// ─── Badge ────────────────────────────────────────────────────────────────────
export function Badge({ variant = 'gray', children }) {
  return <span className={`${styles.badge} ${styles[`badge_${variant}`]}`}>{children}</span>;
}

// ─── Button ───────────────────────────────────────────────────────────────────
export function Button({ variant = 'ghost', size = 'md', children, className = '', ...props }) {
  return (
    <button className={`${styles.btn} ${styles[`btn_${variant}`]} ${styles[`btn_${size}`]} ${className}`} {...props}>
      {children}
    </button>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, className = '', ...props }) {
  return <div className={`${styles.card} ${className}`} {...props}>{children}</div>;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
export function Avatar({ name, size = 38 }) {
  const initials = name?.split(' ').map(x => x[0]).join('').substring(0, 2).toUpperCase() || '?';
  return (
    <div className={styles.avatar} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials}
    </div>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────
export function Input({ label, ...props }) {
  return (
    <div className={styles.fieldWrap}>
      {label && <label className={styles.label}>{label}</label>}
      <input className={styles.input} {...props} />
    </div>
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────
export function Select({ label, children, ...props }) {
  return (
    <div className={styles.fieldWrap}>
      {label && <label className={styles.label}>{label}</label>}
      <select className={styles.input} {...props}>{children}</select>
    </div>
  );
}

// ─── Live dot ─────────────────────────────────────────────────────────────────
export function LiveDot() {
  return <span className={styles.liveDot} aria-label="Live" />;
}

// ─── Stat card ────────────────────────────────────────────────────────────────
export function StatCard({ label, value, color }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statNum} style={color ? { color } : {}}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}

// ─── Section header ──────────────────────────────────────────────────────────
export function SectionHeader({ title, icon: Icon, right }) {
  return (
    <div className={styles.sectionHeader}>
      <h2 className={styles.sectionTitle}>{Icon && <Icon size={18} />} {title}</h2>
      {right}
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, message }) {
  return (
    <div className={styles.emptyState}>
      {Icon && <Icon size={36} strokeWidth={1.2} style={{ opacity: 0.3, marginBottom: 10 }} />}
      <p>{message}</p>
    </div>
  );
}

// ─── Alert ───────────────────────────────────────────────────────────────────
export function Alert({ variant = 'success', children }) {
  return <div className={`${styles.alert} ${styles[`alert_${variant}`]}`}>{children}</div>;
}

// ─── Progress bar ────────────────────────────────────────────────────────────
export function ProgressBar({ pct }) {
  return (
    <div className={styles.progressBar}>
      <div className={styles.progressFill} style={{ width: `${Math.round(pct)}%` }} />
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────
export function Modal({ children, onClose }) {
  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className={styles.modal}>{children}</div>
    </div>
  );
}

export function ModalHeader({ title, onClose }) {
  return (
    <div className={styles.modalHeader}>
      <h3 className={styles.modalTitle}>{title}</h3>
      {onClose && <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>}
    </div>
  );
}
