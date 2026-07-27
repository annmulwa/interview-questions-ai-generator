# Interview Questions AI Generator

Generate tailored interview questions for any job role using Google's Gemini AI, with optional voice playback powered by ElevenLabs.

**Live Demo:** https://interview-questions-ai.netlify.app/

---

## What It Does

Paste a job title, click generate, and get three targeted interview questions in seconds. The app uses Google Gemini to produce role-specific questions rather than generic ones: a Staff Engineer prompt returns architecture and leadership questions, a Junior Frontend prompt returns fundamentals and problem-solving questions.

Each question also has a **Listen** button that converts the text to natural-sounding speech via the ElevenLabs Text-to-Speech API, useful for practicing an answer out loud rather than reading silently.

---

## Architecture

The app is intentionally lean: a static frontend (HTML, CSS, vanilla JavaScript) backed by two Netlify serverless functions, each proxying a different upstream AI service.

```
Browser --> Netlify Function (generateQuestions) --> Google Gemini API
Browser --> Netlify Function (generateSpeech)    --> ElevenLabs Text-to-Speech API
```

### Why a serverless proxy?

The most common mistake in AI-powered frontend projects is calling third-party APIs directly from the browser. Doing so exposes the API key in client-side code where anyone can extract it from DevTools and run up your bill.

Each Netlify Function solves this cleanly:

- API keys live only in Netlify's environment variables, never in the bundle
- The browser never sees either key; it calls the Netlify function endpoints, not Gemini or ElevenLabs directly
- Each function validates its incoming request before forwarding it upstream

This is the same pattern used in production AI tools: a thin backend layer acts as a secure gateway between the client and the upstream AI service.

### Why vanilla JavaScript?

A React app would have been over-engineered for this scope. The interaction surface is small (one input, one button, one output area) and vanilla JS handles it with less complexity and faster load times. The tradeoff is explicit DOM manipulation, which is a fair cost for eliminating a build pipeline on a project this size.

---

## Security Details

**API key protection:** The Gemini API key is injected at runtime via Netlify environment variables. It is never committed to the repository or exposed in any client-side asset.

**XSS protection:** AI-generated content is sanitized using a DOM-based escaping technique: each question is assigned to a temporary element via `textContent` (which the browser treats as plain text), then read back as `innerHTML` (which returns the safely escaped string). This means a malicious or unexpected model response cannot inject executable script tags into the page.

**Input validation:** The serverless function validates the job title before forwarding the request: it checks the field is non-empty, enforces a 100-character limit, and rejects strings that contain no letters (e.g. numbers or symbols only). Invalid requests are rejected with a 400 before the Gemini API is ever called.

The speech function applies the same pattern: text is capped at 1,000 characters, must contain at least one letter, and an optional `voiceId` is matched against an alphanumeric pattern before being placed in the upstream URL, rather than being forwarded as-is.

---

## Features

- Role-specific question generation powered by Gemini 2.5 Flash
- Voice playback of any question via ElevenLabs (Flash v2.5 model, ~75ms inference latency)
- Secure serverless proxies; API keys never exposed to the client
- XSS-safe rendering of AI output
- Responsive design, works on mobile and desktop
- Loading spinner with graceful error handling and retry

---

## Quick Start

### Prerequisites

- Node.js
- A Google Gemini API key (free at [ai.google.dev](https://ai.google.dev))
- An ElevenLabs API key (free tier available at [elevenlabs.io](https://elevenlabs.io))
- Netlify CLI

### Run Locally

```bash
git clone https://github.com/annmulwa/interview-questions-ai-generator.git
cd interview-questions-ai-generator
npm install -g netlify-cli
```

Create a `.env.local` file:

```
GEMINI_API_KEY=your_gemini_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```

Start the dev server:

```bash
netlify dev
```

Visit `http://localhost:8888`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Serverless functions | Node.js on Netlify Functions |
| Question generation | Google Gemini API (gemini-2.5-flash) |
| Voice synthesis | ElevenLabs API (eleven_flash_v2_5) |
| Hosting | Netlify |

---

## Project Structure

```
.
├── index.html              # App shell and UI
├── script.js               # Frontend logic, API calls, DOM updates
├── styles.css              # Responsive styles
├── netlify.toml            # Netlify build and redirect config
└── netlify/
    └── functions/
        ├── generateQuestions.js   # Serverless proxy to Gemini API
        └── generateSpeech.js      # Serverless proxy to ElevenLabs API
```
