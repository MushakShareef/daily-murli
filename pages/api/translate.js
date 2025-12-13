// pages/api/translate.js
// Free Google Translate endpoint handler (improved)
// - POST { text, targetLanguage } -> { primaryTranslation, englishTranslation, debug? }
// - Supports: Tamil, English, Telugu, Kannada, Malayalam
// - Uses translate.googleapis.com (no API key)
// - Auto-detects source language and chains via English if transliteration detected
// - Simple in-memory cache for dev
// --- Step 1: Custom Tamil Dictionary ---
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

const CACHE_MAX_ENTRIES = 500;
const cache = new Map(); // simple in-memory cache: key -> { primary, english, ts }

function cacheKey(text, targetLang) {
  return `${targetLang}::${text}`;
}

function cacheSet(key, value) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    // delete oldest (Map preserves insertion order) — simple eviction
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(key, { ...value, ts: Date.now() });
}

function cacheGet(key) {
  const v = cache.get(key);
  if (!v) return null;
  return v;
}

function langToCode(lang) {
  if (!lang || typeof lang !== "string") return "en";
  const l = lang.trim().toLowerCase();
  if (l === "tamil" || l === "ta") return "ta";
  if (l === "telugu" || l === "te") return "te";
  if (l === "kannada" || l === "kn") return "kn";
  if (l === "malayalam" || l === "ml") return "ml";
  if (l === "english" || l === "en") return "en";
  // default: English
  return "en";
}

function applyTamilDictionary(text) {
  const keys = Object.keys(TAMIL_DICTIONARY);
  for (const key of keys) {
    if (text.includes(key)) {
      return TAMIL_DICTIONARY[key];
    }
  }
  return null;
}

function isParagraph(text) {
  return (
    text.includes(" ") ||       // more than one word
    text.includes("\n") ||      // multi-line
    text.length > 25            // long sentence
  );
}

async function callGoogleTranslate(text, source = "hi", target = "en") {
  const cleanText = text
    .replace(/\n+/g, " ")       // normalize newlines
    .replace(/\s+/g, " ")       // normalize spaces
    .trim();

  const encoded = encodeURIComponent(cleanText);

  // IMPORTANT: dt=t ONLY (no dictionary flags)
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


function extractTranslationFromGoogleArray(arr) {
  // Expected shape: [ [ [translatedText, originalText, ...], ... ], ... ]
  // We'll join the first element's pieces
  try {
    if (!Array.isArray(arr)) return "";
    const first = arr[0];
    if (!Array.isArray(first)) return "";
    // first is list of segments: [ [translated, original, ...], ... ]
    const parts = first.map((seg) => {
      if (Array.isArray(seg) && seg.length > 0) return seg[0];
      return "";
    });
    return parts.join("");
  } catch (e) {
    return "";
  }
}

function isMostlyLatin(s) {
  if (!s || typeof s !== "string") return false;
  // remove spaces and punctuation for ratio
  const cleaned = s.replace(/[\s\p{P}\p{S}]/gu, "");
  if (!cleaned) return false;
  const latinMatches = cleaned.match(/[A-Za-z]/g) || [];
  const latinCount = latinMatches.length;
  const total = cleaned.length;
  return (latinCount / total) > 0.4; // if >40% latin -> likely transliteration/roman
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { text, targetLanguage } = req.body || {};
  // --- CUSTOM DICTIONARY CHECK (Tamil only) ---
        if (targetLanguage.toLowerCase() === "tamil") {
        const dictMatch = applyTamilDictionary(text.trim());
        if (dictMatch) {
            return res.status(200).json({
            primaryTranslation: dictMatch,
            englishTranslation: "Dictionary-based translation",
            debug: { dictionaryHit: true }
            });
        }
        }
  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "Missing text" });
  }

  // map language name to code
  const targetCode = langToCode(targetLanguage);
  const cacheK = cacheKey(text, targetCode);

  // Return cached if available
  const cached = cacheGet(cacheK);
  if (cached) {
    return res.status(200).json({
      primaryTranslation: cached.primary,
      englishTranslation: cached.english,
      debug: { cached: true, ts: cached.ts }
    });
  }

  try {
    // 1) Primary translation (auto-detect -> target)
    const callPrimary = await callGoogleTranslateAuto(text, "auto", targetCode);

    // 2) English translation (auto-detect -> en)
    let callEnglish;
    if (targetCode === "en") {
      callEnglish = callPrimary;
    } else {
      callEnglish = await callGoogleTranslateAuto(text, "auto", "en");
    }

    // Extract primaryText
    let primaryText = "";
    if (callPrimary.json) {
      primaryText = extractTranslationFromGoogleArray(callPrimary.json);
    } else if (callPrimary.status === 200 && typeof callPrimary.textResp === "string") {
      try {
        const parsed = JSON.parse(callPrimary.textResp);
        primaryText = extractTranslationFromGoogleArray(parsed);
      } catch (_e) {
        primaryText = callPrimary.textResp.slice(0, 1000);
      }
    } else {
      primaryText = "";
    }

    // Extract englishText
    let englishText = "";
    if (callEnglish && callEnglish.json) {
      englishText = extractTranslationFromGoogleArray(callEnglish.json);
    } else if (callEnglish && callEnglish.status === 200 && typeof callEnglish.textResp === "string") {
      try {
        const parsed = JSON.parse(callEnglish.textResp);
        englishText = extractTranslationFromGoogleArray(parsed);
      } catch (_e) {
        englishText = callEnglish.textResp.slice(0, 1000);
      }
    } else {
      englishText = "";
    }

    // If primary looks like transliteration (latin-heavy) and englishText exists and target is not English,
    // try chain: englishText -> targetCode (en -> ta/ml/te/kn)
    if (isMostlyLatin(primaryText) && englishText && englishText.trim().length > 0 && targetCode !== "en") {
      const chainCall = await callGoogleTranslateAuto(englishText, "en", targetCode);
      let chainText = "";
      if (chainCall && chainCall.json) {
        chainText = extractTranslationFromGoogleArray(chainCall.json);
      } else if (chainCall && chainCall.status === 200 && typeof chainCall.textResp === "string") {
        try {
          const parsed = JSON.parse(chainCall.textResp);
          chainText = extractTranslationFromGoogleArray(parsed);
        } catch (e) {
          chainText = chainCall.textResp.slice(0, 1000);
        }
      }
      // if chain produced a non-latin result, use it
      if (chainText && !isMostlyLatin(chainText)) {
        primaryText = chainText;
      }
    }

    // Final fallback: if empty use fallback string
    if (!primaryText || primaryText.trim().length === 0) {
      primaryText = `${targetLanguage} (fallback): ${text}`;
    }
    if (!englishText || englishText.trim().length === 0) {
      englishText = `English (fallback): ${text}`;
    }

    // Cache
    cacheSet(cacheK, { primary: primaryText, english: englishText });

    // Return result with debug info
    return res.status(200).json({
      primaryTranslation: primaryText,
      englishTranslation: englishText,
      debug: {
        apiStatusPrimary: callPrimary && callPrimary.status,
        apiStatusEnglish: callEnglish && callEnglish.status,
        apiContentTypePrimary: callPrimary && callPrimary.contentType,
        apiContentTypeEnglish: callEnglish && callEnglish.contentType
      }
    });
  } catch (err) {
    console.error("translate handler error (google free improved):", err && (err.stack || err.message || err));
    return res.status(200).json({
      primaryTranslation: `${targetLanguage} (fallback): ${text}`,
      englishTranslation: `English (fallback): ${text}`,
      debugError: String(err)
    });
  }
}
