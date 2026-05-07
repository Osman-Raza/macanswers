import { useState } from "react";
import { signInWithMcMaster } from "./supabase.js";
import styles from "./SignInModal.module.css";

export default function SignInModal({ onClose, reason = "interact" }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit() {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await signInWithMcMaster(email.trim().toLowerCase());
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.icon}>🎓</div>
        <h2 className={styles.title}>Sign in to {reason}</h2>
        <p className={styles.sub}>
          Use your McMaster email to sign in. We'll send you a magic link — no password needed.
        </p>

        {!sent ? (
          <>
            <input
              className={styles.input}
              type="email"
              placeholder="yourname@mcmaster.ca"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              disabled={loading}
              autoFocus
            />
            {error && <p className={styles.error}>{error}</p>}
            <button
              className={styles.submitBtn}
              onClick={handleSubmit}
              disabled={loading || !email.trim()}
            >
              {loading ? "Sending..." : "Send Magic Link"}
            </button>
            <button className={styles.cancelBtn} onClick={onClose}>
              Cancel
            </button>
          </>
        ) : (
          <div className={styles.sent}>
            <div className={styles.sentIcon}>📬</div>
            <p className={styles.sentText}>
              Magic link sent to <strong>{email}</strong>
            </p>
            <p className={styles.sentSub}>
              Check your McMaster email and click the link to sign in.
            </p>
            <button className={styles.cancelBtn} onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
