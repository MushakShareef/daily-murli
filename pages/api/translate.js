// pages/api/translate.js
// Free Google Translate endpoint handler (improved, FIXED)
// - POST { text, targetLanguage } -> { primaryTranslation, englishTranslation, debug? }
// - Supports: Tamil, English, Telugu, Kannada, Malayalam
// - Uses translate.googleapis.com (no API key)
// - Preserves custom dictionary + cache + debug

/* -------------------- STEP 1: Custom Tamil Dictionary -------------------- */

const TAMIL_DICTIONARY = {
  "अमरलोक": "அமரலகம்",
  "मृत्युलोक": "மரண உலகம்",
  "स्वर्ग": "சுவர்க்கம்",
  "स्वर्गलोक": "சுவர்க்குலகம்",
  "नरकलोक": "நரகுலகம்",
  "कलियुग": "கலியுகம்",
  "सतयुग": "சத்யயுகம்",
  "त्रेतायुग": "த்ரேதாயுகம்",
  "द्वापरयुग": "துவாபரயுகம்",
  "ब्रह्मा": "பிரம்மா",
  "शिव": "சிவ பாபா",
  "ईश्वरीय": "ஈஸ்வரீய",
  "ज्ञान": "ஞானம்",
  "योग": "யோகம்",
  "धर्म": "தர்மம்",
  "कर्म": "கர்மம்",
};

/* -------------------- Cache -------------------- */

const CACHE_MAX_ENTRIES = 500;
const cache = new Map();

function cacheKey(text, targetLang) {
  return `${targetLang}::${text}`;
}

function cacheSet(key, value) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(key, { ...value, ts: Date.now() });
}

function cacheGet(key) {
  return cache.get(key) || null;
}

/* -------------------- Language Helpers -------------------- */

function langToCode(lang) {
  if (!lang || typeof lang !== "string") return "en";
  const l = lang.trim().toLowerCase();
  if (l === "tamil" || l === "ta") return "ta";
  if (l === "telugu" || l === "te") return "te";
  if (l === "kannada" || l === "kn") return "kn";
  if (l === "malayalam" || l === "ml") return "ml";
  if (l === "english" || l === "en") return "en";
  return "en";
}

/* -------------------- Text Helpers -------------------- */

function isParagraph(text) {
  return text.includes(" ") || text.includes("\n") || text.length > 25;
}

function isMostlyLatin(s) {
  if (!s) return false;
  const cleaned = s.replace(/[\s\p{P}\p{S}]/gu, "");
  if (!cleaned) return false;
  const latin = (cleaned.match(/[A-Za-z]/g) || []).length;
  return latin / cleaned.length > 0.4;
}

function applyTamilDictionary(text) {
  for (const key of Object.keys(TAMIL_DICTIONARY)) {
    if (text.trim() === key) {
      return TAMIL_DICTIONARY[key];
    }
  }
  return null;
}

/* -------------------- Google Translate -------------------- */

async function callGoogleTranslate(text, source = "auto", target = "en") {
  const cleanText = text.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  const encoded = encodeURIComponent(cleanText);

  const url =
    `https://translate.googleapis.com/translate_a/single` +
    `?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encoded}`;

  const resp = await fetch(url);
  const textResp = await resp.text();

  let json = null;
  try {
    json = JSON.parse(textResp);
  } catch {}

  return { status: resp.status, json };
}

/* ✅ MISSING FUNCTION — THIS WAS THE MAIN BUG */
async function callGoogleTranslateAuto(text, source, target) {
  return callGoogleTranslate(text, source, target);
}

function extractTranslationFromGoogleArray(arr) {
  if (!Array.isArray(arr) || !Array.isArray(arr[0])) return "";
  return arr[0]
    .map(seg => (Array.isArray(seg) ? seg[0] : ""))
    .join("")
    .trim();
}

/* -------------------- Handler -------------------- */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text, targetLanguage } = req.body || {};

  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "Missing text" });
  }

  const targetCode = langToCode(targetLanguage);
  const cacheK = cacheKey(text, targetCode);

  const cached = cacheGet(cacheK);
  if (cached) {
    return res.status(200).json({
      primaryTranslation: cached.primary,
      englishTranslation: cached.english,
      debug: { cached: true },
    });
  }

  try {
    /* ---- Dictionary ONLY for single-word Tamil ---- */
    if (
      targetCode === "ta" &&
      !isParagraph(text)
    ) {
      const dictHit = applyTamilDictionary(text);
      if (dictHit) {
        const result = {
          primaryTranslation: dictHit,
          englishTranslation: "Dictionary-based translation",
        };
        cacheSet(cacheK, result);
        return res.status(200).json(result);
      }
    }

    /* ---- English (always) ---- */
    const callEnglish = await callGoogleTranslateAuto(text, "auto", "en");
    const englishText = extractTranslationFromGoogleArray(callEnglish.json);

    /* ---- Primary target ---- */
    let primaryText = englishText;
    if (targetCode !== "en") {
      const callPrimary = await callGoogleTranslateAuto(text, "auto", targetCode);
      primaryText = extractTranslationFromGoogleArray(callPrimary.json);

      // transliteration chain fix
      if (isMostlyLatin(primaryText) && englishText) {
        const chain = await callGoogleTranslateAuto(englishText, "en", targetCode);
        const chained = extractTranslationFromGoogleArray(chain.json);
        if (chained && !isMostlyLatin(chained)) {
          primaryText = chained;
        }
      }
    }

    const result = {
      primaryTranslation: primaryText || englishText,
      englishTranslation: englishText || text,
    };

    cacheSet(cacheK, result);
    return res.status(200).json(result);
  } catch (err) {
    console.error("translate error:", err);
    return res.status(200).json({
      primaryTranslation: `${targetLanguage} (fallback): ${text}`,
      englishTranslation: `English (fallback): ${text}`,
    });
  }
}
