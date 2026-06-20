const views = {
  loading: document.getElementById("loadingView"),
  empty: document.getElementById("emptyView"),
  error: document.getElementById("errorView"),
  result: document.getElementById("resultView")
};

const statusText = document.getElementById("statusText");
const errorMessage = document.getElementById("errorMessage");

document.getElementById("settingsButton").addEventListener("click", openOptions);
document.getElementById("openOptionsButton").addEventListener("click", openOptions);
document.getElementById("retryButton").addEventListener("click", analyzeCurrentTab);
document.getElementById("reanalyzeButton").addEventListener("click", analyzeCurrentTab);

analyzeCurrentTab();

function openOptions() {
  chrome.runtime.openOptionsPage();
}

async function analyzeCurrentTab() {
  showView("loading");
  statusText.textContent = "Reading this page...";

  try {
    const response = await chrome.runtime.sendMessage({ type: "ANALYZE_ACTIVE_TAB" });

    if (!response?.ok) {
      throw new Error(response?.error || "Analysis failed.");
    }

    renderResult(response.result);
  } catch (error) {
    if (String(error.message || "").includes("Provider settings are incomplete")) {
      statusText.textContent = "Settings required";
      showView("empty");
      return;
    }

    statusText.textContent = "Could not analyze page";
    errorMessage.textContent = error.message || "Unknown error.";
    showView("error");
  }
}

function showView(name) {
  Object.entries(views).forEach(([key, element]) => {
    element.classList.toggle("hidden", key !== name);
  });
}

function renderResult(result) {
  statusText.textContent = "Analysis complete";

  document.getElementById("jobTitle").textContent = result.job?.title || "Unknown";
  document.getElementById("company").textContent = result.job?.company || "Unknown";
  document.getElementById("location").textContent = result.job?.statedLocation || "Unknown";

  const verdict = document.getElementById("verdict");
  const verdictKey = normalizeVerdict(result.remoteAnalysis?.verdict);
  verdict.className = `verdict ${verdictKey}`;
  verdict.textContent = verdictLabel(verdictKey);

  document.getElementById("summary").textContent =
    result.remoteAnalysis?.summary || "The model did not provide an analysis summary.";

  const quotes = Array.isArray(result.remoteAnalysis?.evidenceQuotes)
    ? result.remoteAnalysis.evidenceQuotes.filter(Boolean)
    : [];

  const quotesContainer = document.getElementById("quotes");
  quotesContainer.textContent = "";
  quotes.forEach((quote) => {
    const blockquote = document.createElement("blockquote");
    blockquote.textContent = quote;
    quotesContainer.appendChild(blockquote);
  });

  document.getElementById("quotesSection").classList.toggle("hidden", quotes.length === 0);
  showView("result");
}

function normalizeVerdict(value) {
  if (value === "anywhere") return "anywhere";
  if (value === "caveat") return "caveat";
  return "vague";
}

function verdictLabel(value) {
  if (value === "anywhere") return "Fully remote from anywhere";
  if (value === "caveat") return "Remote has caveats";
  return "Remote status is vague";
}
