const DEFAULT_SETTINGS = {
  provider: "openai",
  model: "gpt-4.1-mini",
  apiKeys: {},
  localServer: "lmstudio"
};

const TEMPERATURE = 0;

const LOCAL_SERVERS = {
  lmstudio: "http://localhost:1234/v1/chat/completions",
  ollama: "http://localhost:11434/v1/chat/completions"
};

const PROVIDER_CONFIG = {
  openai: { kind: "openai", endpoint: "https://api.openai.com/v1/chat/completions" },
  xai: { kind: "openai", endpoint: "https://api.x.ai/v1/chat/completions" },
  groq: { kind: "openai", endpoint: "https://api.groq.com/openai/v1/chat/completions" },
  openrouter: { kind: "openai", endpoint: "https://openrouter.ai/api/v1/chat/completions" },
  local: { kind: "openai-local" },
  anthropic: { kind: "anthropic", endpoint: "https://api.anthropic.com/v1/messages" },
  google: { kind: "google" }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "ANALYZE_ACTIVE_TAB") return false;

  analyzeActiveTab()
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));

  return true;
});

async function analyzeActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab was found.");
  if (!/^https?:\/\//.test(tab.url || "")) {
    throw new Error("This extension can analyze regular http and https pages only.");
  }

  const [{ result: page }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["vendor/turndown.js", "pageExtractor.js"]
  });

  if (!page?.markdown || page.markdown.length < 200) {
    throw new Error("Could not extract enough readable job description text from this page.");
  }

  console.group("Remote Job Caveat Checker: extracted markdown");
  console.log("URL:", page.url);
  console.log("Title:", page.title);
  console.log("Extraction strategy:", page.extractionStrategy);
  console.log("Section count:", page.sectionCount);
  console.log("Page text characters:", page.textLength);
  console.log("Markdown characters:", page.markdown.length);
  console.log(page.markdown);
  console.groupEnd();

  const settings = normalizeSettings(await chrome.storage.local.get(DEFAULT_SETTINGS));
  validateSettings(settings);

  return callProvider(settings, buildMessages(page));
}

function validateSettings(settings) {
  const provider = PROVIDER_CONFIG[settings.provider];
  if (!provider) throw new Error("Provider settings are incomplete. Choose a provider in settings.");

  if (!settings.model) throw new Error("Provider settings are incomplete. Choose a model in settings.");

  if (settings.provider !== "local" && !settings.apiKeys?.[settings.provider]) {
    throw new Error("Provider settings are incomplete. Add an API key in settings.");
  }

  if (settings.provider === "local" && !LOCAL_SERVERS[settings.localServer]) {
    throw new Error("Provider settings are incomplete. Choose a local server in settings.");
  }
}

function normalizeSettings(settings) {
  if (settings.provider !== "lmstudio") return settings;

  return {
    ...settings,
    provider: "local",
    localServer: "lmstudio"
  };
}

function buildMessages(page) {
  const system = [
    "You analyze job descriptions for remote-work caveats.",
    "Return only strict JSON matching the requested schema.",
    "Use exact sentence quotes from the provided job description when making a definite claim.",
    "A job is 'anywhere' only when the text explicitly says the person can work from anywhere in the world or equivalent global wording.",
    "A job is 'caveat' when remote work is restricted to a country, region, state, timezone, office proximity, legal entity, work authorization, visa, citizenship, payroll location, or similar requirement.",
    "A job is 'vague' when the posting says remote but does not definitively prove global remote eligibility or a concrete restriction."
  ].join(" ");

  const user = [
    "Analyze this extracted job page markdown.",
    "",
    "JSON schema:",
    "{",
    '  "job": {',
    '    "title": "string or Unknown",',
    '    "company": "string or Unknown",',
    '    "statedLocation": "string or Unknown"',
    "  },",
    '  "remoteAnalysis": {',
    '    "verdict": "anywhere | caveat | vague",',
    '    "summary": "short explanation",',
    '    "evidenceQuotes": ["exact full sentences from the job description, empty if no definite evidence"]',
    "  }",
    "}",
    "",
    "Rules:",
    "- Quote exact complete sentences only from the markdown.",
    "- If verdict is caveat, include the exact sentence or sentences proving the caveat.",
    "- If verdict is anywhere, include the exact sentence proving global remote eligibility.",
    "- If remote wording is vague, explain that and leave evidenceQuotes empty unless a quote is useful without overstating it.",
    "",
    `Page title: ${page.title}`,
    `Page URL: ${page.url}`,
    "",
    "Markdown:",
    page.markdown
  ].join("\n");

  return { system, user };
}

async function callProvider(settings, messages) {
  const provider = PROVIDER_CONFIG[settings.provider];
  const temperature = TEMPERATURE;

  if (provider.kind === "openai" || provider.kind === "openai-local") {
    const endpoint = settings.provider === "local" ? LOCAL_SERVERS[settings.localServer] : provider.endpoint;
    const headers = { "Content-Type": "application/json" };
    if (provider.kind === "openai") {
      headers.Authorization = `Bearer ${settings.apiKeys[settings.provider]}`;
    }
    if (settings.provider === "openrouter") {
      headers["HTTP-Referer"] = "chrome-extension://remote-job-caveat-checker";
      headers["X-Title"] = "Remote Job Caveat Checker";
    }

    const body = {
      model: settings.model,
      temperature,
      messages: [
        { role: "system", content: messages.system },
        { role: "user", content: messages.user }
      ]
    };

    if (provider.kind === "openai") {
      body.response_format = { type: "json_object" };
    }

    const response = await fetchJson(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    return parseModelJson(response.choices?.[0]?.message?.content);
  }

  if (provider.kind === "anthropic") {
    const response = await fetchJson(provider.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": settings.apiKeys[settings.provider],
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: settings.model,
        max_tokens: 1200,
        temperature,
        system: messages.system,
        messages: [{ role: "user", content: messages.user }]
      })
    });

    return parseModelJson(response.content?.map((part) => part.text || "").join(""));
  }

  if (provider.kind === "google") {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.model)}:generateContent?key=${encodeURIComponent(settings.apiKeys[settings.provider])}`;
    const response = await fetchJson(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: {
          temperature,
          responseMimeType: "application/json"
        },
        contents: [
          {
            role: "user",
            parts: [{ text: `${messages.system}\n\n${messages.user}` }]
          }
        ]
      })
    });

    return parseModelJson(response.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join(""));
  }

  throw new Error("Unsupported provider.");
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload;

  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    const detail = payload?.error?.message || payload?.message || response.statusText;
    throw new Error(`Provider request failed: ${detail}`);
  }

  return payload;
}

function parseModelJson(content) {
  if (!content) throw new Error("The provider returned an empty response.");

  const cleaned = content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("The provider did not return valid JSON.");
    parsed = JSON.parse(match[0]);
  }

  return normalizeAnalysis(parsed);
}

function normalizeAnalysis(value) {
  const verdict = ["anywhere", "caveat", "vague"].includes(value?.remoteAnalysis?.verdict)
    ? value.remoteAnalysis.verdict
    : "vague";

  return {
    job: {
      title: cleanField(value?.job?.title),
      company: cleanField(value?.job?.company),
      statedLocation: cleanField(value?.job?.statedLocation)
    },
    remoteAnalysis: {
      verdict,
      summary: cleanField(value?.remoteAnalysis?.summary),
      evidenceQuotes: Array.isArray(value?.remoteAnalysis?.evidenceQuotes)
        ? value.remoteAnalysis.evidenceQuotes.map(cleanField).filter(Boolean)
        : []
    }
  };
}

function cleanField(value) {
  const text = String(value || "").trim();
  return text || "Unknown";
}
