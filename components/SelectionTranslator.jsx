// components/SelectionTranslator.jsx
import React, { useEffect, useRef, useState } from "react";

/**
 * SelectionTranslator
 * - Attach this component somewhere near the root of your app (e.g. in pages/_app or pages/index)
 * - It listens to selections and shows a small translation popup near the selected text.
 */

// Simple in-memory cache to avoid repeated calls
const cache = new Map();
const CACHE_MAX = 1000;
function cacheSet(key, value) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > CACHE_MAX) {
    const first = cache.keys().next().value;
    cache.delete(first);
  }
}
function cacheGet(key) {
  const v = cache.get(key);
  return v;
}

// Helper: clean the selected text (remove zero-width, BOM, collapse whitespace)
function cleanSelectedText() {
  if (typeof window === "undefined" || !window.getSelection) return "";
  const sel = window.getSelection();
  if (!sel) return "";
  let s = sel.toString() || "";
  s = s.trim();
  s = s
    .replace(/\u200B/g, "") // zero width space
    .replace(/\u200C/g, "") // ZWNJ
    .replace(/\u200D/g, "") // ZWJ
    .replace(/\uFEFF/g, "") // BOM
    .replace(/\u00A0/g, " ") // nbsp -> space
    .replace(/[ \t\v\f\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // if too short or contains replacement char, return empty
  if (!s || s.length < 1 || /\uFFFD/.test(s)) return "";
  return s;
}

export default function SelectionTranslator({ primaryLanguage = (process.env.NEXT_PUBLIC_PRIMARY_LANGUAGE || "Tamil") }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState({ primary: "", english: "" });
  const popupRef = useRef(null);
  const timerRef = useRef(null);
  const lastKeyRef = useRef("");

  // debounce for selection (ms)
  const DEBOUNCE = 300;

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // compute popup position near selection
  function positionPopup(range) {
    try {
      const rect = range.getBoundingClientRect();
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;
      const popup = popupRef.current;
      const popupW = popup ? popup.offsetWidth : 220;
      const popupH = popup ? popup.offsetHeight : 110;
      // prefer above selection unless near top
      let top = rect.top + scrollY - popupH - 8;
      if (top < 10) top = rect.bottom + scrollY + 8; // below selection
      let left = rect.left + scrollX + rect.width / 2 - popupW / 2;
      // keep inside viewport
      const maxLeft = window.innerWidth + scrollX - popupW - 10;
      if (left < 10) left = 10;
      if (left > maxLeft) left = maxLeft;
      setPos({ top: Math.round(top), left: Math.round(left) });
    } catch (e) {
      // fallback center
      setPos({ top: 120, left: 20 });
    }
  }

  // send translate request
  async function fetchTranslation(text, targetLanguage) {
    const cacheKey = `${targetLanguage}::${text}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const resp = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, targetLanguage })
      });
      const j = await resp.json();
      const primary = j.primaryTranslation || j.primary || j.primaryLang || (j.body && j.body.primaryTranslation) || "";
      const english = j.englishTranslation || j.english || j.englishLang || "";
      const out = { primary: String(primary).trim(), english: String(english).trim() };
      cacheSet(cacheKey, out);
      return out;
    } catch (err) {
      console.error("translate fetch failed", err);
      return { primary: `${targetLanguage} (fallback): ${text}`, english: `English (fallback): ${text}` };
    }
  }

  // main handler triggered on mouseup / touchend / keyboard
  function handleSelectionEvent() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const selected = cleanSelectedText();
      if (!selected) {
        setVisible(false);
        return;
      }

      // avoid duplicate requests for same text
      if (lastKeyRef.current === selected) {
        // if popup already visible and results present, just return
        if (visible) return;
      }
      lastKeyRef.current = selected;

      // find selection range for positioning
      let range;
      try {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) {
          setVisible(false);
          return;
        }
        range = sel.getRangeAt(0).cloneRange();
      } catch (e) {
        range = null;
      }

      // position popup
      if (range) positionPopup(range);

      // show loading popup
      setLoading(true);
      setVisible(true);
      setResult({ primary: "", english: "" });

      // fetch translation
      const out = await fetchTranslation(selected, primaryLanguage);
      setResult(out);
      setLoading(false);
    }, DEBOUNCE);
  }

  // attach listeners
      useEffect(() => {
    // use capture to get events before other handlers
    function onMouseUp(e) { handleSelectionEvent(); }
    function onTouchEnd(e) {
      // wait a tiny bit after touchend for selection to settle
      setTimeout(() => handleSelectionEvent(), 150);
    }
    function onKeyUp(e) {
      // allow keyboard selection (shift+arrows)
      if (e.key === "Enter" || e.key === " ") return;
      handleSelectionEvent();
    }

    document.addEventListener("mouseup", onMouseUp, true);
    document.addEventListener("touchend", onTouchEnd, true);
    document.addEventListener("keyup", onKeyUp, true);

    return () => {
      document.removeEventListener("mouseup", onMouseUp, true);
      document.removeEventListener("touchend", onTouchEnd, true);
      document.removeEventListener("keyup", onKeyUp, true);
    };
  }, [primaryLanguage]);



  // hide popup when clicking outside it
  useEffect(() => {
    function onDocClick(e) {
      if (!visible) return;
      const p = popupRef.current;
      if (!p) return;
      if (!p.contains(e.target)) {
        setVisible(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [visible]);

  // render nothing if not visible
  return (
    <>
      {visible && (
        <div
          ref={popupRef}
          role="dialog"
          aria-live="polite"
          style={{
            position: "absolute",
            zIndex: 99999,
            top: pos.top,
            left: pos.left,
            width: 260,
            maxWidth: "90vw",
            background: "#fff",
            color: "#000",
            border: "1px solid #E0E0E0",
            borderRadius: 8,
            boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
            padding: 10,
            fontFamily: "'Noto Sans Devanagari', sans-serif",
            fontSize: 14,
            lineHeight: "1.4",
            pointerEvents: "auto"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 12, color: "#666" }}>{/* small label */}Selected</div>
            <button
              aria-label="Close translation"
              onClick={() => setVisible(false)}
              style={{
                border: "none",
                background: "transparent",
                color: "#444",
                fontSize: 14,
                cursor: "pointer",
                padding: 4,
                marginLeft: 8
              }}
            >
              ×
            </button>
          </div>

          <div style={{ fontSize: 12, color: "#444", marginBottom: 6, whiteSpace: "pre-wrap" }}>
            {/* show original smaller */}
            {loading ? <i>translating...</i> : <>{/* original text not shown to keep design minimal */}</>}
          </div>

          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
            {loading ? "…" : (result.primary || `${primaryLanguage} (fallback)`)}
          </div>

          <div style={{ fontSize: 13, color: "#444" }}>
            <small style={{ color: "#666" }}>{loading ? "" : (result.english || "English (fallback)")} </small>
          </div>
        </div>
      )}
    </>
  );
}
