// pages/index.jsx
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import DateNav from "../components/DateNav";
import SelectionTranslator from "../components/SelectionTranslator";

export default function Home() {
  const today = dayjs().format("YYYY-MM-DD");

  const [date, setDate] = useState(today);
  const [murli, setMurli] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchMurli() {
      setLoading(true);
      setError("");
      setMurli(null);

      try {
        const res = await fetch(`/api/murli?date=${date}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "No Murli available.");
        } else {
          setMurli(data);
        }
      } catch (err) {
        setError("Failed to load Murli.");
      } finally {
        setLoading(false);
      }
    }

    fetchMurli();
  }, [date]);

  return (
    <div
      style={{
        padding: 24,
        maxWidth: 900,
        margin: "0 auto",
        fontFamily: "Georgia, serif",
      }}
    >
      {/* Header */}
      <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 8,
      }}
    >
      <img
        src="/shiva512.png"
        alt="Baba"
        style={{
          width: 48,
          height: 48,
          objectFit: "contain",
        }}
      />

      <div>
        <h1 style={{ margin: 0 }}>Baba’s Tone</h1>
        <div style={{ color: "#666" }}>
          Feel the word - Brahma Kumaris 
        </div>
      </div>
    </header>


      {/* Date Navigation */}
      <DateNav date={date} setDate={setDate} />

      {/* Content */}
      <main style={{ marginTop: 18 }}>
        <h3 style={{ marginTop: 0 }}>{date}</h3>

        {loading && <p>Loading…</p>}

        {error && (
          <div style={{ padding: 24, color: "#444" }}>
            {error}
          </div>
        )}

        {murli && (
          <div>
            <div style={{ marginTop: 16 }}>
            {murli.content
              .split(/\n\s*\n/)   // split on blank lines
              .map((para, idx) => (
                <p
                  key={idx}
                  style={{
                    lineHeight: "1.8",
                    marginBottom: 14,
                    textAlign: "justify",
                  }}
                >
                  {para.trim()}
                </p>
              ))}
          </div>
          </div>
        )}
      </main>

      {/* Translator */}
      <SelectionTranslator />
    </div>
  );
}
