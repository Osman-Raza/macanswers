import { useState } from "react";
import { AuthProvider, useAuth } from "./auth/AuthContext.jsx";
import { signOut } from "./auth/supabase.js";
import KnowledgeBase from "./pages/KnowledgeBase.jsx";
import IssueTracker from "./pages/IssueTracker.jsx";
import Transit from "./pages/Transit.jsx";
import SignInModal from "./auth/SignInModal.jsx";
import styles from "./App.module.css";

const TABS = [
  { id: "ask",     label: "Ask Anything",  icon: "✦" },
  { id: "issues",  label: "Campus Issues", icon: "⬡" },
  { id: "transit", label: "Transit",       icon: "◎" },
];

function AppInner() {
  const [tab, setTab] = useState("ask");
  const [showSignIn, setShowSignIn] = useState(false);
  const { user } = useAuth();

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.logo}>M</span>
          <span className={styles.wordmark}>MacAnswers</span>
        </div>

        <nav className={styles.nav}>
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`${styles.tab} ${tab === t.id ? styles.active : ""}`}
              onClick={() => setTab(t.id)}
            >
              <span className={styles.tabIcon}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        <div className={styles.authArea}>
          {user ? (
            <div className={styles.userInfo}>
              <span className={styles.userEmail}>{user.email}</span>
              <button className={styles.signOutBtn} onClick={signOut}>Sign out</button>
            </div>
          ) : (
            <button className={styles.signInBtn} onClick={() => setShowSignIn(true)}>
              Sign in
            </button>
          )}
        </div>
      </header>

      <main className={styles.main}>
        {tab === "ask"     && <KnowledgeBase />}
        {tab === "issues"  && <IssueTracker onSignInRequired={() => setShowSignIn(true)} />}
        {tab === "transit" && <Transit />}
      </main>

      {showSignIn && (
        <SignInModal
          onClose={() => setShowSignIn(false)}
          reason="report or vote on issues"
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
