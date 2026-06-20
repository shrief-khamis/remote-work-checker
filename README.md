# Remote Job Caveat Checker

Remote Job Caveat Checker is a Chrome extension that reads a job posting and checks whether "remote" really means working from anywhere.

It reports:

- the job title, company, and stated location
- whether the job is remote worldwide, geographically restricted, or unclear
- exact quotes that reveal country, region, timezone, work authorization, payroll, or office-proximity requirements

## Install from GitHub

The extension is not currently available in the Chrome Web Store, so it must be loaded manually.

1. Open this repository on GitHub.
2. Click the green **Code** button, then click **Download ZIP**.
3. Find the downloaded ZIP file and extract it.
4. Open Chrome and enter `chrome://extensions` in the address bar.
5. Turn on **Developer mode** in the upper-right corner.
6. Click **Load unpacked**.
7. Select the extracted folder that contains `manifest.json`.
8. Optional: open Chrome's Extensions menu and pin **Remote Job Caveat Checker** for easier access.

Chrome does not automatically update manually installed extensions. To update, download the latest version, replace the old extracted folder, and click the extension's **Reload** button on `chrome://extensions`.

## Choose an AI provider

The extension needs either an API key from a supported AI provider or a local AI server running on your computer.

1. Right-click the extension icon.
2. Choose **Options** from the dropdown menu.
3. Choose a provider and model.
4. Paste that provider's API key.
5. Click **Save settings**.

You can create or learn how to create keys on each provider's official page:

- [OpenAI API keys and authentication](https://platform.openai.com/docs/api-reference/authentication)
- [Anthropic API setup and keys](https://platform.claude.com/docs/en/api/overview)
- [Google Gemini API keys](https://ai.google.dev/gemini-api/docs/interactions/api-key)
- [xAI (Grok) quickstart and API keys](https://docs.x.ai/developers/quickstart)
- [Groq quickstart and API keys](https://console.groq.com/docs/quickstart)
- [OpenRouter authentication and API keys](https://openrouter.ai/docs/api/reference/authentication)

API usage may cost money depending on the provider, model, and account. Check the provider's pricing and usage limits before using a paid model. However, this task does not require a very strong model with deep thinking or research capabilities, so a cheap light model is fine here.

### My suggestions

These estimates assume an unusually large job page of about 14,200 input tokens and a 300-token result. Most job pages should cost less, but provider prices and free-tier limits can change. The following table estimates how many checks can you get for a mere 5 USD

| Provider | Suggested budget model | Approximate checks for $5 | Notes |
| --- | --- | ---: | --- |
| OpenAI | `gpt-4.1-nano` | 3,250 | The cheapest OpenAI model that works with the extension's current request format. |
| Google Gemini | `gemini-2.5-flash-lite` | 3,250 | Also has a free tier, subject to Google's quotas. |
| Groq | `llama-3.1-8b-instant` | 6,800 | Extremely inexpensive, though a small model may miss subtle caveats on noisy pages. |
| OpenRouter | `openrouter/free` | Free | Uses an available free model automatically; model quality, availability, and rate limits can vary. |
| Local server | Your installed model | No API charge | Runs through LM Studio or Ollama using your own computer. |

For the best balance of price and consistency, start with `gpt-4.1-nano` or `gemini-2.5-flash-lite`. OpenRouter's free router is useful for experimenting, while stronger models are worth trying if a cheaper model repeatedly misses restrictions.

I do not currently recommend Anthropic or xAI for this task because their least expensive suitable models are still comparatively costly. They remain available in the extension for people who specifically want to use those providers, and in case either provider introduces cheaper models in the future.

### Use a local model instead

Local mode does not require a cloud-provider API key.

1. Install [LM Studio](https://lmstudio.ai/) or [Ollama](https://ollama.com/).
2. Download a model and start the application's local server.
3. In the extension settings, choose **Local server**.
4. Select LM Studio or Ollama.
5. Enter the exact model identifier shown by that application.
6. Save the settings.

The extension uses the standard local endpoints:

```text
LM Studio: http://localhost:1234/v1/chat/completions
Ollama:    http://localhost:11434/v1/chat/completions
```

Please note that to run a local server, you need to have strong hardware, download the model, and run the server. Average consumer laptops or PCs may be able to run very light models, but be prepared for slow responses and mistakes. 

## Check a job posting

1. Open a page containing a job description.
2. Expand the job description first if the site only loads the full text after clicking **Show more** or **Read more**.
3. Click the **Remote Job Caveat Checker** extension icon.
4. Wait for the analysis to appear in the popup.

The extension uses a deliberately strict standard:

- **Fully remote from anywhere** means the posting explicitly permits worldwide work.
- **Remote has caveats** means the posting contains a geographic, legal, timezone, payroll, authorization, or similar restriction.
- **Remote status is vague** means the posting does not provide enough definite information.

## Privacy and API keys

- The extension sends the extracted job-page text to the AI provider you selected.
- In local-server mode, the request is sent to LM Studio or Ollama on your computer instead.
- API keys and settings are stored in Chrome's extension-only local storage (`chrome.storage.local`). They are not stored in, or exposed to, the visited website's local storage, nor sent to any server I own
- Settings are not synchronized through your Google account.
- Never paste API keys into GitHub issues, screenshots, recordings, or committed files.
- This extension does not collect or track any usage data.

## Troubleshooting

### The extension says settings are required

Open **Settings**, choose a provider and model, add the appropriate API key, and save again. Local-server users must have their selected server running and enter an installed model's exact identifier.

### The result misses part of the job description

Some websites do not add the full description to the page until **Show more** or **Read more** is clicked. Expand it and run the extension again.

### A custom model does not work

Confirm that the model name exactly matches one currently supported by the selected provider. Provider model names can change over time.

### The extension does not appear after downloading

Downloading the ZIP does not install it automatically. Extract it and follow the **Load unpacked** steps above.


## How it works under the hood

When the extension icon is clicked, it:

1. clones the current page's visible document body
2. removes scripts, styles, embedded frames, and hidden elements from the clone
3. converts the remaining page to Markdown with [Turndown](https://github.com/mixmark-io/turndown)
4. sends the Markdown and analysis instructions to the configured model
5. validates and displays the model's structured result in the popup

## Third-party software

This extension uses [Turndown](https://github.com/mixmark-io/turndown) to convert webpage HTML into Markdown. Turndown is copyright (c) 2017 Dom Christie and is distributed under the MIT License. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the complete notice.

## License

Remote Job Caveat Checker is available under the [MIT License](LICENSE).
