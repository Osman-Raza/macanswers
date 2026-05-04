import { useState, useRef, useEffect } from "react";
import { api } from "../lib/api.js";
import styles from "./KnowledgeBase.module.css";

const SUGGESTIONS = [
  "When is the last day to drop a course?",
  "What's my dental plan coverage?",
  "How do I apply for OSAP?",
  "Is there a snow day today?",
  "What's the tuition for engineering?",
  "When does housing application open?",
];

function Message({ msg }) {
  if (msg.role === "user") {
    return <div className={styles.userMsg}>{msg.content}</div>;
  }

  if (msg.loading) {
    return (
      <div className={styles.botMsg}>
        <div className={styles.typing}>
          <span /><span /><span />
        </div>
      </div>
    );
  }

  if (msg.lowConfidence) {
    return (
      <div className={`${styles.botMsg} ${styles.lowConf}`}>
        <p>I don't have enough information to answer this confidently.</p>
        <a href={msg.source} target="_blank" rel="noreferrer">
          Check the McMaster page directly →
        </a>
      </div>
    );
  }

  return (
    <div className={styles.botMsg}>
      <p className={styles.answer}>{msg.content}</p>
      {msg.source && (
        <a className={styles.source} href={msg.source} target="_blank" rel="noreferrer">
          Source ↗
        </a>
      )}
    </div>
  );
}

export default function KnowledgeBase() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function submit(question) {
    if (!question.trim() || loading) return;
    const q = question.trim();
    setInput("");
    setMessages((m) => [
      ...m,
      { role: "user", content: q },
      { role: "bot", loading: true },
    ]);
    setLoading(true);

    try {
      const { answer, source, lowConfidence } = await api.ask(q);
      setMessages((m) => [
        ...m.slice(0, -1),
        { role: "bot", content: answer, source, lowConfidence },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m.slice(0, -1),
        { role: "bot", content: "Something went wrong — try again.", source: null },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className={styles.page}>
      {empty && (
        <div className={styles.hero}>
          <span className={styles.heroEyebrow}>McMaster University</span>
          <h1 className={styles.heroTitle}>
            Ask anything about <span>Mac.</span>
          </h1>
          <p className={styles.heroSub}>
            Instant answers with cited sources — tuition, deadlines, OSAP, snow days, and more.
          </p>
          <div className={styles.suggestions}>
            {SUGGESTIONS.map((s) => (
              <button key={s} className={styles.chip} onClick={() => submit(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {!empty && (
        <div className={styles.messages}>
          {messages.map((msg, i) => (
            <Message key={i} msg={msg} />
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      <div className={styles.inputBar}>
        <input
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit(input)}
          placeholder="Ask a McMaster question..."
          disabled={loading}
        />
        <button
          className={styles.sendBtn}
          onClick={() => submit(input)}
          disabled={loading || !input.trim()}
        >
          ↑
        </button>
      </div>
    </div>
  );
}