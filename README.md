# Interview Questions AI Generator

Generate tailored interview questions for any job role using Google's Gemini AI.

**Live Demo:** https://lambent-kringle-2da022.netlify.app/

---

## What It Does

Paste a job title, click generate, and get three targeted interview questions in seconds. The app uses Google Gemini to produce role-specific questions rather than generic ones: a Staff Engineer prompt returns architecture and leadership questions, a Junior Frontend prompt returns fundamentals and problem-solving questions.

---

## Architecture

The app is intentionally lean: a static frontend (HTML, CSS, vanilla JavaScript) backed by a single Netlify serverless function that proxies requests to the Gemini API.

```
Browser --> Netlify Function (Node.js) --> Google Gemini API
```

### Why a serverless proxy?

The most common mistake in AI-powered frontend projects is calling third-party APIs directly from the browser. Doing so exposes the API key in client-side code where anyone can extract it from DevTools and run up your bill.

The Netlify Function solves this cleanly:

- The API key lives only in Netlify's environment variables, never in the bundle
- The browser never sees the key; it calls the Netlify function endpoint, not Gemini directly
- The function validates the incoming request before forwarding it

This is the same pattern used in production AI tools: a thin backend layer acts as a secure gateway between the client and the upstream AI service.

### Why vanilla JavaScript?

A React app would have been over-engineered for this scope. The interaction surface is small (one input, one button, one output area) and vanilla JS handles it with less complexity and faster load times. The tradeoff is explicit DOM manipulation, which is a fair cost for eliminating a build pipeline on a project this size.

---

## Security Details

**API key protection:** The Gemini API key is injected at runtime via Netlify environment variables. It is never committed to the repository or exposed in any client-side asset.

**XSS protection:** AI-generated content is sanitized using a DOM-based escaping technique: each question is assigned to a temporary element via `textContent` (which the browser treats as plain text), then read back as `innerHTML` (which returns the safely escaped string). This means a malicious or unexpected model response cannot inject executable script tags into the page.

**Input validation:** The serverless function validates the job title before forwarding the request: it checks the field is non-empty, enforces a 100-character limit, and rejects strings that contain no letters (e.g. numbers or symbols only). Invalid requests are rejected with a 400 before the Gemini API is ever called.

---

## Features

- Role-specific question generation powered by Gemini 2.5 Flash
- Secure serverless proxy; API key never exposed to the client
- XSS-safe rendering of AI output
- Responsive design, works on mobile and desktop
- Loading spinner with graceful error handling and retry

---

## Quick Start

### Prerequisites

- Node.js
- A Google Gemini API key (free at [ai.google.dev](https://ai.google.dev))
- Netlify CLI

### Run Locally

```bash
git clone https://github.com/annmulwa/interview-questions-ai-generator.git
cd interview-questions-ai-generator
npm install -g netlify-cli
```

Create a `.env.local` file:

```
GEMINI_API_KEY=your_api_key_here
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
| Serverless function | Node.js on Netlify Functions |
| AI | Google Gemini API (gemini-2.5-flash) |
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
        └── generateQuestions.js   # Serverless proxy to Gemini API
```
