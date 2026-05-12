# Interview Questions AI Generator

Generate tailored interview questions for any job role using Google's Gemini AI.

**Live Demo:** https://lambent-kringle-2da022.netlify.app/

## Features

- Generate 3 tailored interview questions for any job role
- Secure backend proxy - API key never exposed to client
- XSS protection with HTML escaping
- Fully responsive design
- Loading state with spinner animation
- Graceful error handling with retry functionality

## Quick Start

### Prerequisites
- Node.js
- Google Gemini API key (get free at [ai.google.dev](https://ai.google.dev))

### Installation

```bash
git clone https://github.com/annmulwa/interview-questions-ai-generator.git
cd interview-questions-ai-generator
```

Create `.env.local` file:
```
GEMINI_API_KEY=your_api_key_here
```

Install Netlify CLI:
```bash
npm install -g netlify-cli
```

### Run Locally

```bash
netlify dev
```

Visit `http://localhost:8888`

## Tech Stack

- HTML5, CSS3, Vanilla JavaScript
- Node.js + Netlify Functions
- Google Gemini API (gemini-2.5-flash)
- Netlify
