import React, { useEffect, useRef, useState } from "react";

// SelectionTranslator.jsx
// - Attach selection listeners and show a translation popup positioned intelligently
// - Uses the free /api/translate endpoint in your project
// - Positions popup above the Android/Chrome selection toolbar when necessary
// - Reads latest `primaryLanguage` from a ref so listeners stay stable

export default function SelectionTranslator({ primaryLanguage = "Tamil" }) {
  const langRef = useRef(primaryLanguage);
  const popupRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [popupStyle, setPopupStyle] = useState({});
  const [selectedText, setSelectedText] = useState("");
  const [primaryTranslation, setPrimaryTranslation] = useState("");
  const [englishTranslation, setEnglishTranslation] = useState("");
  const [loading, setLoading] = useState(false);
  const fetchController = useRef(null);
  const debounceRef = useRef(null);

  // keep a ref of the latest language so handlers don't close over stale value
  useEffect(() => {
    langRef.current = primaryLanguage;
  }, [primaryLanguage]);

  // Helper: get current selection rect
  function getSelectionRect() {
    try {
      const sel = window.getSelection && window.getSelection();
      if (!sel || sel.rangeCount === 0) return null;
      const range = sel.getRangeAt(0).cloneRange();
      let rect = range.getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) {
        const rects = range.getClientRects();
        if (rects && rects.length) rect = rects[0];
      }
      if (!rect) return null;
      return rect;
    } catch (e) {
      return null;
    }
  }

  function computePopupPosition(rect, popupWidth = 320, popupHeight = 160) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const ANDROID_SELECTION_OVERLAY_ESTIMATE = 90; // safe margin to avoid bottom toolbar
    const MARGIN = 8;
    const safeBottomSpace = vh - rect.bottom;
    const safeTopSpace = rect.top;

    let top;
    let left = rect.left + rect.width / 2 - popupWidth / 2;
    left = Math.max(8, Math.min(left, vw - popupWidth - 8));

    if (safeBottomSpace > popupHeight + ANDROID_SELECTION_OVERLAY_ESTIMATE + MARGIN) {
      top = window.scrollY + rect.bottom + MARGIN;
    } else if (safeTopSpace > popupHeight + ANDROID_SELECTION_OVERLAY_ESTIMATE + MARGIN) {
      top = window.scrollY + rect.top - popupHeight - MARGIN;
    } else {
      // fallback near top of viewport (below any fixed header)
      top = window.scrollY + Math.min(rect.top, 80);
    }

    return { top, left };
  }

  // Utility: normalize selected text
  function normalizeSelectionText(s) {
    if (!s) return "";
    return s.replace(/\s+/g, " ").trim();
  }

  // Call translate API (debounced). Returns {primary, english}
  async function translateText(text, targetLanguage) {
    if (!text) return null;
    try {
      if (fetchController.current) {
        fetchController.current.abort();
      }
      fetchController.current = new AbortController();
      setLoading(true);

      const resp = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, targetLanguage }),
        signal: fetchController.current.signal,
      });

      const json = await resp.json();
      setLoading(false);
      return json;
    } catch (err) {
      setLoading(false);
      return null;
    }
  }

  // Main handler when selection changes
  async function handleSelectionEvent() {
    // small debounce to avoid multiple rapid calls on mobile
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const sel = window.getSelection && window.getSelection();
      if (!sel) {
        setVisible(false);
        return;
      }
      const text = normalizeSelectionText(sel.toString());
      if (!text) {
        setVisible(false);
        return;
      }

      const rect = getSelectionRect();
      if (!rect) {
        setVisible(false);
        return;
      }

      // compute popup position
      const popupWidth = Math.min(360, window.innerWidth - 24);
      const popupHeight = 160;
      const pos = computePopupPosition(rect, popupWidth, popupHeight);
      setPopupStyle({ position: "absolute", top: `${pos.top}px`, left: `${pos.left}px`, width: `${popupWidth}px`, zIndex: 2147483647 });

      setSelectedText(text);
      setVisible(true);

      // call translation API
      const target = langRef.current || primaryLanguage;
      const result = await translateText(text, target);
      if (result) {
        setPrimaryTranslation(result.primaryTranslation || result.primary || "");
        setEnglishTranslation(result.englishTranslation || result.english || "");
      } else {
        setPrimaryTranslation("");
        setEnglishTranslation("");
      }
    }, 120);
  }

  // Attach stable listeners that read latest language from ref
  useEffect(() => {
    function onMouseUp(e) {
      handleSelectionEvent();
    }
    function onTouchEnd(e) {
      setTimeout(() => handleSelectionEvent(), 150);
    }
    function onKeyUp(e) {
      if (e.key === "Enter" || e.key === " ") return;
      handleSelectionEvent();
    }

    document.addEventListener("mouseup", onMouseUp, true);
    document.addEventListener("touchend", onTouchEnd, true);
    document.addEventListener("keyup", onKeyUp, true);

    // hide popup on scroll/resize to avoid misplacement; could also reposition
    function onScrollResize() {
      setVisible(false);
    }
    window.addEventListener("scroll", onScrollResize, true);
    window.addEventListener("resize", onScrollResize);

    // click outside to close
    function onDocClick(e) {
      if (!popupRef.current) return;
      if (!popupRef.current.contains(e.target)) {
        setVisible(false);
      }
    }
    document.addEventListener("click", onDocClick, true);

    return () => {
      document.removeEventListener("mouseup", onMouseUp, true);
      document.removeEventListener("touchend", onTouchEnd, true);
      document.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("scroll", onScrollResize, true);
      window.removeEventListener("resize", onScrollResize);
      document.removeEventListener("click", onDocClick, true);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (fetchController.current) fetchController.current.abort();
    };
    // intentionally no deps so listeners are stable; latest language read from ref
  }, []);

  // small UI: popup content
  return (
    <>
      {visible && (
        <div ref={popupRef} style={popupStyle} className="selection-translate-popup">
          <div style={{ padding: 12, background: "#fff", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", pointerEvents: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: "#666" }}>Selected</div>
              <button onClick={() => setVisible(false)} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 16 }}>×</button>
            </div>

            <div style={{ minHeight: 44 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{loading ? "Translating..." : (primaryTranslation || "(no translation)")}</div>
              {englishTranslation && (
                <div style={{ marginTop: 6, color: "#666", fontSize: 13 }}>{englishTranslation}</div>
              )}
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => {
                if (!selectedText) return;
                // copy primary translation or original
                const textToCopy = primaryTranslation || selectedText;
                navigator.clipboard && navigator.clipboard.writeText(textToCopy);
              }} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #ddd", background: "#fff" }}>
                Copy
              </button>

              <a href={`https://translate.google.com/?sl=auto&tl=${encodeURIComponent(langRef.current||primaryLanguage)}&text=${encodeURIComponent(selectedText)}&op=translate`} target="_blank" rel="noreferrer" style={{ padding: "6px 10px", borderRadius: 6, background: "#111", color: "#fff", textDecoration: "none" }}>Open in Google</a>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .selection-translate-popup { pointer-events: auto; }
        @media (max-width: 600px) {
          .selection-translate-popup { width: calc(100% - 24px) !important; left: 12px !important; }
        }
      `}</style>
    </>
  );
}
