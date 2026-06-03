import styles from "./Footer.module.css";

export default function Footer({ onNavigate }) {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span className={styles.note}>
          Independent student project. Not affiliated with McMaster University.
        </span>
        <nav className={styles.links}>
          <button className={styles.linkBtn} onClick={() => onNavigate("privacy")}>
            Privacy
          </button>
          <span className={styles.sep}>·</span>
          <button className={styles.linkBtn} onClick={() => onNavigate("terms")}>
            Terms
          </button>
        </nav>
      </div>
    </footer>
  );
}
