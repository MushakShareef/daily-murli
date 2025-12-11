// pages/api/translate.js
// Robust, production-ready translate handler with retries + backoff + debug info
//
// - Uses server-side env var process.env.GEMINI_API_KEY
// - Retries on network errors, 429 and 5xx with exponential backoff & jitter
// - Honors RetryInfo.retryDelay and Retry-After header when present
// - Returns JSON always (never HTML) and includes debug fields in dev
// - Keeps previous parsing heuristics but is more forgiving

// Helper: sleep
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Parse RetryInfo.retryDelay like "37s" or "37.74491593s" -> milliseconds
function parseRetryDelayMsFromErrorJson(errJson) {
  try {
    const details = errJson && errJson.error && errJson.error.details ? errJson.error.details : [];
    for (const d of details) {
      if (d && d['@type'] && String(d['@type']).includes('RetryInfo')) {
        const rd = d.retryDelay;
        if (!rd) continue;
        const s = String(rd).trim();
        // common form "37s" or "37.74491593s"
        const m = s.match(/^(\d+(?:\.\d+)?)(ms|s)?$/i);
        if (m) {
          const val = parseFloat(m[1]);
          const unit = (m[2] || 's').toLowerCase();
          return unit === 'ms' ? Math.round(val) : Math.round(val * 1000);
        }
        // fallback: try to parse as seconds number
        const n = parseFloat(s);
        if (!isNaN(n)) return Math.round(n * 1000);
      }
    }
  } catch (_) {}
  return null;
}

// Extract human text content from model wrapper (lots of possible shapes)
function extractModelText(wrapper) {
  if (!wrapper) return '';
  try {
    if (typeof wrapper === 'object') {
      const data = wrapper;
      // Common shapes
      if (data.candidates && data.candidates[0]) {
        const c = data.candidates[0];
        if (c.content && c.content.parts && c.content.parts[0]) {
          return c.content.parts[0].text || '';
        }
        if (c.content && c.content[0] && c.content[0].text) {
          return c.content[0].text || '';
        }
      }
      if (data.output && data.output[0] && data.output[0].content && data.output[0].content[0]) {
        return data.output[0].content[0].text || '';
      }
      // If top-level text exists
      if (data.text) return data.text;
      // Fallback: stringify some likely fields
      if (data.result && data.result.output) return String(data.result.output);
      return '';
    } else if (typeof wrapper === 'string') {
      return wrapper;
    }
  } catch (e) {
    return '';
  }
  return '';
}

// Try to parse a JSON object embedded in text (returns object or null)
function parseJsonFromText(s) {
  if (!s || typeof s !== 'string') return null;
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch (_) {
    return null;
  }
}

// Heuristic to detect clearly invalid translation outputs
function looksInvalidPrimary(str) {
  if (!str || typeof str !== 'string') return true;
  const trimmed = str.trim();
  if (!trimmed) return true;
  // obvious model names or token-like strings are invalid
  if (/^models?\/|gemini/i.test(trimmed)) return true;
  if (/^[A-Za-z0-9_\-]{50,}$/.test(trimmed)) return true;
  // otherwise consider it valid
  return false;
}

// Core function that calls the Google endpoint (single attempt)
async function callGenerateContentOnce(url, body) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const contentType = resp.headers.get('content-type') || '';
  const text = await resp.text();
  let json = null;
  try {
    if (contentType.includes('application/json') || /^\s*[\{\[]/.test(text)) {
      json = JSON.parse(text);
    }
  } catch (e) {
    // ignore parse error - we keep the raw text
  }
  return { resp, text, json, contentType };
}

// Robust caller with retries/backoff/jitter and respect for RetryInfo/Retry-After
async function callGenerateContentWithRetry(url, body, opts = {}) {
  const maxRetries = opts.maxRetries != null ? opts.maxRetries : 4;
  const baseDelayMs = opts.baseDelayMs != null ? opts.baseDelayMs : 500;
  const maxDelayMs = opts.maxDelayMs != null ? opts.maxDelayMs : 30000;

  let attempt = 0;
  while (true) {
    attempt++;
    let result;
    try {
      result = await callGenerateContentOnce(url, body);
    } catch (err) {
      // network-level error: construct a synthetic result
      result = { resp: null, text: String(err && (err.message || err)), json: null, contentType: '' };
    }

    const status = result.resp ? result.resp.status : null;
    const isHtml = typeof result.text === 'string' && /^\s*</.test(result.text);
    const ok = result.resp && result.resp.ok && !isHtml;

    // If successful and not HTML, return result
    if (ok) return result;

    // If we've reached max attempts, return last result
    if (attempt > maxRetries) return result;

    // Determine delay: prefer API-provided RetryInfo, then Retry-After header, then exponential backoff
    let delayMs = null;
    if (result.json) {
      delayMs = parseRetryDelayMsFromErrorJson(result.json);
    }
    if (!delayMs && result.resp && result.resp.headers && typeof result.resp.headers.get === 'function') {
      const ra = result.resp.headers.get('retry-after');
      if (ra) {
        const n = parseInt(ra, 10);
        if (!Number.isNaN(n)) delayMs = n * 1000;
      }
    }
    if (!delayMs) {
      const exp = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      const jitter = Math.floor(Math.random() * (exp / 2));
      delayMs = Math.floor(exp / 2) + jitter;
    }

    console.warn(`callGenerateContentWithRetry: attempt ${attempt} failed (status=${status}), sleeping ${delayMs}ms before retry`);
    await sleep(delayMs);
    // loop to retry
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, targetLanguage } = req.body || {};
  if (!text || !targetLanguage) {
    return res.status(400).json({ error: 'Missing text or targetLanguage' });
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    // Local dev mock response
    const primary = `${targetLanguage} (mock translation): ${text}`;
    const english = `English (mock translation): ${text}`;
    return res.status(200).json({ primaryTranslation: primary, englishTranslation: english });
  }

  const baseUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

  const fullJsonPrompt = `
Translate the following HINDI text into two translations and return a JSON object with exactly these keys:
{"primary":"...","english":"..."}
Only return the JSON object and nothing else.

HINDI TEXT:
${text}
`.trim();

  try {
    // 1) First attempt: request JSON object with both translations
    const body1 = { contents: [{ parts: [{ text: fullJsonPrompt }] }] };
    const r1 = await callGenerateContentWithRetry(baseUrl, body1, { maxRetries: 4 });

    console.log('translate: first call status:', r1 && r1.resp ? r1.resp.status : null);
    console.log('translate: first call content-type:', r1 && r1.contentType ? r1.contentType : null);
    console.log('translate: first call text (trunc 3000):', String(r1 && r1.text || '').slice(0, 3000));

    // If the API returned HTML or non-OK final result, respond with fallback + debug
    const respIsHtml = typeof (r1 && r1.text) === 'string' && /^\s*</.test(r1.text);
    if (!(r1 && r1.resp && r1.resp.ok) || respIsHtml) {
      // return fallback but include debug info so client can show why
      const debug = {
        apiStatus: r1 && r1.resp ? r1.resp.status : null,
        apiContentType: r1 && r1.contentType ? r1.contentType : null,
        apiTextSnippet: String(r1 && r1.text || '').slice(0, 4000),
      };
      return res.status(200).json({
        primaryTranslation: `${targetLanguage} (fallback): ${text}`,
        englishTranslation: `English (fallback): ${text}`,
        debug
      });
    }

    const wrapper1 = r1.json ? r1.json : r1.text;
    const modelText1 = extractModelText(wrapper1);
    const parsed1 = parseJsonFromText(modelText1);

    let primary = parsed1 && (parsed1.primary || parsed1.primaryTranslation) ? (parsed1.primary || parsed1.primaryTranslation) : '';
    let english = parsed1 && (parsed1.english || parsed1.englishTranslation) ? (parsed1.english || parsed1.englishTranslation) : '';

    // 2) If primary missing/invalid -> retry a simple prompt for the primary translation only
    if (!primary || looksInvalidPrimary(primary)) {
      console.log('translate: primary missing/invalid, retrying simple prompt for primary');
      const retryPromptPrimary = `
Translate the following HINDI text into ${targetLanguage}. Return only the translated sentence (no JSON, no extra text):

${text}
`.trim();
      const body2 = { contents: [{ parts: [{ text: retryPromptPrimary }] }] };
      const r2 = await callGenerateContentWithRetry(baseUrl, body2, { maxRetries: 3 });

      console.log('translate: retry-primary status:', r2 && r2.resp ? r2.resp.status : null);
      console.log('translate: retry-primary text (trunc 1000):', String(r2 && r2.text || '').slice(0, 1000));

      const wrapper2 = r2.json ? r2.json : r2.text;
      const modelText2 = extractModelText(wrapper2);
      const parsedRetryPrimary = parseJsonFromText(modelText2);
      primary = parsedRetryPrimary && (parsedRetryPrimary.primary || parsedRetryPrimary.primaryTranslation) ? (parsedRetryPrimary.primary || parsedRetryPrimary.primaryTranslation) : primary;

      if (!primary || looksInvalidPrimary(primary)) {
        const lines = String(modelText2 || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        if (lines.length) primary = lines[0];
      }
    }

    // 3) If english missing/invalid -> retry a simple prompt for English
    if (!english || (typeof english === 'string' && english.trim().length === 0)) {
      console.log('translate: english missing, retrying simple prompt for English');
      const retryPromptEnglish = `
Translate the following HINDI text into English. Return only the translated sentence (no JSON, no extra text):

${text}
`.trim();
      const body3 = { contents: [{ parts: [{ text: retryPromptEnglish }] }] };
      const r3 = await callGenerateContentWithRetry(baseUrl, body3, { maxRetries: 3 });

      console.log('translate: retry-english status:', r3 && r3.resp ? r3.resp.status : null);
      console.log('translate: retry-english text (trunc 1000):', String(r3 && r3.text || '').slice(0, 1000));

      const wrapper3 = r3.json ? r3.json : r3.text;
      const modelText3 = extractModelText(wrapper3);
      const parsedRetryEnglish = parseJsonFromText(modelText3);
      english = parsedRetryEnglish && (parsedRetryEnglish.english || parsedRetryEnglish.englishTranslation) ? (parsedRetryEnglish.english || parsedRetryEnglish.englishTranslation) : english;

      if (!english || (typeof english === 'string' && english.trim().length === 0)) {
        const linesE = String(modelText3 || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        if (linesE.length) english = linesE[0];
      }
    }

    // Final safe fallbacks only if still empty
    if (!primary || (typeof primary === 'string' && primary.trim().length === 0)) primary = `${targetLanguage} (fallback): ${text}`;
    if (!english || (typeof english === 'string' && english.trim().length === 0)) english = `English (fallback): ${text}`;

    console.log('translate: final primary:', String(primary).slice(0, 200));
    console.log('translate: final english:', String(english).slice(0, 200));

    return res.status(200).json({
      primaryTranslation: String(primary).trim(),
      englishTranslation: String(english).trim()
    });
  } catch (err) {
    console.error('translate handler unexpected error:', err && (err.stack || err.message || err));
    return res.status(200).json({
      primaryTranslation: `${targetLanguage} (mock fallback): ${text}`,
      englishTranslation: `English (mock fallback): ${text}`,
      debugError: String(err && (err.message || err))
    });
  }
}
