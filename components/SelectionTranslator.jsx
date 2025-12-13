import { useEffect, useState, useRef } from "react";

const LANGUAGES = [
  { label: "Tamil", value: "Tamil" },
  { label: "Telugu", value: "Telugu" },
  { label: "Kannada", value: "Kannada" },
  { label: "Malayalam", value: "Malayalam" },
];

export default function SelectionTranslator() {
  const [selectedText, setSelectedText] = useState("");
  const [englishMeaning, setEnglishMeaning] = useState("");
  const [translatedMeaning, setTranslatedMeaning] = useState("");
  const [language, setLanguage] = useState("Tamil");
  const [loading, setLoading] = useState(false);
  const popupRef = useRef(null);

  // ---- Handle text selection (desktop + mobile)
  useEffect(() => {
    const handleSelection = () => {
      const text = window.getSelection()?.toString().trim();
      if (text && text.length > 2) {
        setSelectedText(text);
        translateText(text, language);
      }
    };

    document.addEventListener("mouseup", handleSelection);
    document.addEventListener("touchend", handleSelection);

    return () => {
      document.removeEventListener("mouseup", handleSelection);
      document.removeEventListener("touchend", handleSelection);
    };
  }, [language]);

  // ---- Call API (English always + selected language)
  async function translateText(text, lang) {
    setLoading(true);
    setEnglishMeaning("");
    setTranslatedMeaning("");

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          targetLanguage: lang,
        }),
      });

      const data = await res.json();

      setEnglishMeaning(data.englishTranslation || "");
      setTranslatedMeaning(data.primaryTranslation || "");
    } catch (err) {
      console.error("Translation error:", err);
    } finally {
      setLoading(false);
    }
  }

  // ---- Close popup
  const closePopup = () => {
    setSelectedText("");
    setEnglishMeaning("");
    setTranslatedMeaning("");
  };

  if (!selectedText) return null;

  return (
    <div
      ref={popupRef}
      style={{
        position: "fixed",
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "95%",
        maxWidth: "420px",
        background: "#fff",
        border: "1px solid #ddd",
        borderRadius: "10px",
        padding: "14px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
        zIndex: 9999,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <strong>Meaning</strong>
        <button onClick={closePopup} style={{ border: "none", background: "none", fontSize: "18px" }}>
          ×
        </button>
      </div>

      {/* Language Selector */}
      <div style={{ marginTop: "10px" }}>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          style={{ width: "100%", padding: "6px" }}
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      <div style={{ marginTop: "12px", fontSize: "14px" }}>
        {loading && <p>Translating…</p>}

        {!loading && (
          <>
            {/* English (ALWAYS) */}
            {englishMeaning && (
              <>
                <h4 style={{ marginBottom: "4px" }}>English</h4>
                <p style={{ marginTop: 0 }}>{englishMeaning}</p>
              </>
            )}

            {/* Selected Language */}
            {translatedMeaning && (
              <>
                <h4 style={{ marginBottom: "4px" }}>{language}</h4>
                <p style={{ marginTop: 0 }}>{translatedMeaning}</p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
