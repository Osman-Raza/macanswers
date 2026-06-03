import { Link } from "react-router-dom";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span className={styles.note}>
          Independent student project. Not affiliated with McMaster University.
        </span>
        <nav className={styles.links}>
          <Link to="/privacy">Privacy</Link>
          <span className={styles.sep}>·</span>
          <Link to="/terms">Terms</Link>
        </nav>
      </div>
    </footer>
  );
}
