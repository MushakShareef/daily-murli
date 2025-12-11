// pages/translate-test.jsx
import React, { useState } from "react";

export default function TranslateTestPage() {
  const [text, setText] = useState("ओम् शान्ति");
  const [target, setTarget] = useState("Tamil");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const callTranslate = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, targetLanguage: target, sourceLanguage: "Hindi" }),
      });
      const json = await res.json();
      setResult({ ok: res.ok, status: res.status, body: json });
    } catch (err) {
      setResult({ ok: false, error: String(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24, fontFamily: "Arial, sans-serif", maxWidth: 880, margin: "0 auto" }}>
      <h1>Translate API Test</h1>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", marginBottom: 6 }}>Text (Hindi):</label>
        <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} style={{ width: "100%", padding: 10 }} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", marginBottom: 6 }}>Target language:</label>
        <select value={target} onChange={(e) => setTarget(e.target.value)} style={{ padding: 8 }}>
          <option>Hindi</option>
          <option>Tamil</option>
          <option>Malayalam</option>
          <option>Telugu</option>
          <option>English</option>
        </select>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={callTranslate} style={{ padding: "10px 14px", background: "#111", color: "#fff", border: "none", borderRadius: 6 }}>
          {loading ? "Translating..." : "Translate"}
        </button>
      </div>

      <div style={{ marginTop: 18 }}>
        <h3>Result</h3>
        <pre style={{ background: "#f7f7f7", padding: 12, borderRadius: 6 }}>
          {result ? JSON.stringify(result, null, 2) : "No result yet."}
        </pre>
      </div>

      <div style={{ marginTop: 12, color: "#555" }}>
        <strong>Note:</strong> If you do not have an OpenAI key in `.env.local`, the server will return mock translations (that’s OK for testing).
      </div>
    </div>
  );
}
