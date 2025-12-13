import { useEffect, useState } from "react";

const LANGUAGES = [
  { label: "Tamil", value: "Tamil" },
  { label: "English", value: "English" },
  { label: "Telugu", value: "Telugu" },
  { label: "Malayalam", value: "Malayalam" },
  { label: "Kannada", value: "Kannada" },
];

export default function SelectionTranslator() {
  const [selectedText, setSelectedText] = useState("");
  const [translation, setTranslation] = useState("");
  const [language, setLanguage] = useState("Tamil");
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    function handleMouseUp() {
      const text = window.getSelection()?.toString().trim();
      if (!text) {
        setVisible(false);
        return;
      }

      const rect = window.getSelection().getRangeAt(0).getBoundingClientRect();
      setSelectedText(text);
      setPosition({
        x: rect.left + window.scrollX,
        y: rect.bottom + window.scrollY + 6,
      });
      setVisible(true);
    }

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []);

  useEffect(() => {
    if (!selectedText) return;

    async function translate() {
      try {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: selectedText,
            targetLanguage: language,
          }),
        });

        const data = await res.json();
        setTranslation(data.primaryTranslation || "No translation");
      } catch (err) {
        setTranslation("Error translating");
      }
    }

    translate();
  }, [selectedText, language]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: position.y,
        left: position.x,
        zIndex: 9999,
        background: "#fff",
        border: "1px solid #ccc",
        borderRadius: 8,
        padding: 10,
        maxWidth: 300,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      }}
    >
      {/* 🔹 Language Selector */}
      <div style={{ marginBottom: 6 }}>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          style={{
            width: "100%",
            padding: 4,
            fontSize: 14,
          }}
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      {/* 🔹 Original text */}
      <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>
        {selectedText}
      </div>

      {/* 🔹 Translation */}
      <div style={{ fontSize: 14, fontWeight: "bold" }}>
        {translation}
      </div>
    </div>
  );
}
