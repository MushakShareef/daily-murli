// components/Header.jsx
import React from "react";

export default function Header({ onTodayClick, language, onLanguageChange }) {
  return (
    <header style={{ position: "sticky", top: 0, background: "#fff", borderBottom: "1px solid #E0E0E0", zIndex: 30 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", maxWidth: 960, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onTodayClick} aria-label="Go to today" style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer" }}>🔔</button>
          <div>
            <h1 style={{ margin: 0, fontSize: 18 }}>Read Murli in Baba's Words</h1>
            <div style={{ fontSize: 12, color: "#555" }}>Brahma Kumaris - Daily Murli</div>
          </div>
        </div>

        <div>
          <label htmlFor="lang" style={{ display: "none" }}>Language</label>
          <select id="lang" value={language} onChange={(e) => onLanguageChange(e.target.value)} style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #E0E0E0" }}>
            <option>Hindi</option>
            <option>Tamil</option>
            <option>Malayalam</option>
            <option>Telugu</option>
            <option>Kannada</option>
            <option>English</option>
          </select>
        </div>
      </div>
    </header>
  )
}
