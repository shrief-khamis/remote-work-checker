const CUSTOM_MODEL = "__custom__";

const PROVIDERS = {
  openai: {
    label: "OpenAI",
    models: ["gpt-4.1-nano", "gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1", "gpt-4o"]
  },
  anthropic: {
    label: "Anthropic",
    models: ["claude-haiku-4-5", "claude-3-5-haiku-latest", "claude-3-5-sonnet-latest", "claude-3-opus-latest"]
  },
  google: {
    label: "Google Gemini",
    models: ["gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"]
  },
  xai: {
    label: "xAI (Grok)",
    models: ["grok-build-0.1", "grok-4.3"]
  },
  groq: {
    label: "Groq",
    models: ["llama-3.1-8b-instant", "llama-3.3-70b-versatile", "mixtral-8x7b-32768"]
  },
  openrouter: {
    label: "OpenRouter",
    models: ["openrouter/free", "openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet", "google/gemini-flash-1.5"]
  },
  local: {
    label: "Local server",
    models: []
  }
};

const DEFAULT_SETTINGS = {
  provider: "openai",
  model: "gpt-4.1-mini",
  modelsByProvider: {},
  localModels: {},
  apiKeys: {},
  localServer: "lmstudio"
};

const providerSelect = document.getElementById("provider");
const modelSelect = document.getElementById("model");
const customModelInput = document.getElementById("customModel");
const localServerSelect = document.getElementById("localServer");
const apiKeyInput = document.getElementById("apiKey");
const modelLabel = modelSelect.closest("label");
const customModelLabel = document.getElementById("customModelLabel");
const localServerLabel = document.getElementById("localServerLabel");
const saveStatus = document.getElementById("saveStatus");

let settings = DEFAULT_SETTINGS;
let activeProvider = DEFAULT_SETTINGS.provider;
let activeLocalServer = DEFAULT_SETTINGS.localServer;

init();

async function init() {
  Object.entries(PROVIDERS).forEach(([value, provider]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = provider.label;
    providerSelect.appendChild(option);
  });

  settings = normalizeSettings({
    ...DEFAULT_SETTINGS,
    ...(await chrome.storage.local.get(DEFAULT_SETTINGS))
  });

  activeProvider = settings.provider;
  activeLocalServer = settings.localServer;
  providerSelect.value = activeProvider;
  renderProvider();
}

providerSelect.addEventListener("change", () => {
  captureProviderDraft();
  activeProvider = providerSelect.value;
  renderProvider();
});

modelSelect.addEventListener("change", syncCustomModelField);

localServerSelect.addEventListener("change", () => {
  settings.localModels[activeLocalServer] = customModelInput.value.trim();
  activeLocalServer = localServerSelect.value;
  settings.localServer = activeLocalServer;
  customModelInput.value = settings.localModels[activeLocalServer] || "";
});

document.getElementById("settingsForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  captureProviderDraft();

  const model = getActiveModel();
  if (!model) {
    customModelInput.focus();
    saveStatus.textContent = "Enter a model name";
    return;
  }

  settings.provider = activeProvider;
  settings.model = model;
  settings.localServer = activeLocalServer;

  await chrome.storage.local.set(settings);
  saveStatus.textContent = "Saved";
  setTimeout(() => {
    saveStatus.textContent = "";
  }, 1800);
});

function renderProvider() {
  const isLocal = activeProvider === "local";

  modelLabel.classList.toggle("hidden", isLocal);
  localServerLabel.classList.toggle("hidden", !isLocal);
  apiKeyInput.disabled = isLocal;
  apiKeyInput.placeholder = isLocal ? "Not required for local servers" : "Paste provider API key";
  apiKeyInput.value = isLocal ? "" : settings.apiKeys?.[activeProvider] || "";

  if (isLocal) {
    activeLocalServer = settings.localServer || "lmstudio";
    localServerSelect.value = activeLocalServer;
    customModelLabel.classList.remove("hidden");
    customModelInput.value = settings.localModels?.[activeLocalServer] || migratedModelFor("local");
    return;
  }

  populateModels();
  const savedModel = settings.modelsByProvider?.[activeProvider] || migratedModelFor(activeProvider);
  if (PROVIDERS[activeProvider].models.includes(savedModel)) {
    modelSelect.value = savedModel;
    customModelInput.value = "";
  } else if (savedModel) {
    modelSelect.value = CUSTOM_MODEL;
    customModelInput.value = savedModel;
  } else {
    modelSelect.value = PROVIDERS[activeProvider].models[0];
    customModelInput.value = "";
  }
  syncCustomModelField();
}

function populateModels() {
  modelSelect.textContent = "";
  PROVIDERS[activeProvider].models.forEach((model) => {
    const option = document.createElement("option");
    option.value = model;
    option.textContent = model;
    modelSelect.appendChild(option);
  });

  const customOption = document.createElement("option");
  customOption.value = CUSTOM_MODEL;
  customOption.textContent = "Custom...";
  modelSelect.appendChild(customOption);
}

function syncCustomModelField() {
  customModelLabel.classList.toggle("hidden", modelSelect.value !== CUSTOM_MODEL);
}

function captureProviderDraft() {
  if (activeProvider === "local") {
    settings.localModels[activeLocalServer] = customModelInput.value.trim();
    return;
  }

  settings.apiKeys[activeProvider] = apiKeyInput.value.trim();
  settings.modelsByProvider[activeProvider] = getActiveModel();
}

function getActiveModel() {
  if (activeProvider === "local" || modelSelect.value === CUSTOM_MODEL) {
    return customModelInput.value.trim();
  }
  return modelSelect.value;
}

function migratedModelFor(provider) {
  return settings.provider === provider ? settings.model : "";
}

function normalizeSettings(value) {
  const normalized = {
    ...value,
    modelsByProvider: { ...(value.modelsByProvider || {}) },
    localModels: { ...(value.localModels || {}) },
    apiKeys: { ...(value.apiKeys || {}) }
  };

  if (normalized.provider === "lmstudio") {
    normalized.provider = "local";
    normalized.localServer = "lmstudio";
    normalized.localModels.lmstudio ||= normalized.model;
  }

  return normalized;
}
