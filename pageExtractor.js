(() => {
  const MAX_MARKDOWN_CHARS = 55000;

  return extractPage();

  function extractPage() {
    if (typeof TurndownService === "undefined") {
      throw new Error("Turndown Service was not loaded before page extraction.");
    }

    const title = document.title || "";
    const canonicalUrl = document.querySelector('link[rel="canonical"]')?.href || location.href;
    const metaDescription = getMeta("description") || getMeta("og:description") || "";
    const body = cloneReadableBody();
    const turndown = new TurndownService({
      headingStyle: "atx",
      bulletListMarker: "-",
      codeBlockStyle: "fenced"
    });

    const bodyMarkdown = turndown.turndown(body);
    const markdown = compactMarkdown([
      `# ${cleanText(title)}`,
      canonicalUrl ? `Source: ${canonicalUrl}` : "",
      metaDescription ? `Summary: ${cleanText(metaDescription)}` : "",
      bodyMarkdown
    ].join("\n\n")).slice(0, MAX_MARKDOWN_CHARS);

    return {
      title,
      url: canonicalUrl,
      extractionStrategy: "whole-page-turndown",
      sectionCount: 1,
      textLength: document.body?.innerText?.length || 0,
      markdown
    };
  }

  function cloneReadableBody() {
    const sourceBody = document.body || document.documentElement;
    const clone = sourceBody.cloneNode(true);

    removeHiddenElements(sourceBody, clone);

    clone.querySelectorAll([
      "script",
      "style",
      "noscript",
      "template",
      "svg",
      "canvas",
      "iframe",
      "object",
      "embed"
    ].join(",")).forEach((node) => node.remove());

    return clone;
  }

  function removeHiddenElements(sourceRoot, cloneRoot) {
    const sourceElements = Array.from(sourceRoot.querySelectorAll("*"));
    const cloneElements = Array.from(cloneRoot.querySelectorAll("*"));

    sourceElements.forEach((sourceElement, index) => {
      const cloneElement = cloneElements[index];
      if (!cloneElement || !isHidden(sourceElement)) return;
      cloneElement.remove();
    });
  }

  function isHidden(element) {
    if (element.hidden || element.getAttribute("aria-hidden") === "true") {
      return true;
    }

    const style = window.getComputedStyle(element);
    return style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0;
  }

  function getMeta(name) {
    return document.querySelector(`meta[name="${name}"]`)?.content ||
      document.querySelector(`meta[property="${name}"]`)?.content ||
      "";
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function compactMarkdown(markdown) {
    return markdown
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
})();
