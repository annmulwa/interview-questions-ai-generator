// Configuration
const API_ENDPOINT = '/.netlify/functions/generateQuestions';
const SPEECH_ENDPOINT = '/.netlify/functions/generateSpeech';

// Caches generated audio per "Listen" button, keyed by the button element,
// so pausing/resuming/replaying a question never re-calls the (paid) API
const audioCache = new Map();

// Get HTML elements
const jobForm = document.getElementById('jobForm');
const jobTitleInput = document.getElementById('jobTitle');
const loadingState = document.getElementById('loadingState');
const resultsContainer = document.getElementById('resultsContainer');
const questionsList = document.getElementById('questionsList');
const errorContainer = document.getElementById('errorContainer');
const errorMessage = document.getElementById('errorMessage');
const resetBtn = document.getElementById('resetBtn');
const errorRetryBtn = document.getElementById('errorRetryBtn');

// Event Listeners
jobForm.addEventListener('submit', handleFormSubmit);
resetBtn.addEventListener('click', resetForm);
errorRetryBtn.addEventListener('click', resetForm);

/**
 * Handle form submission
 */
async function handleFormSubmit(event) {
    event.preventDefault(); // Prevent page reload

    const jobTitle = jobTitleInput.value.trim();

    // Validate input
    if (!jobTitle) {
        showError('Please enter a job title');
        return;
    }

    // Hide previous results/errors
    hideAll();

    // Show loading state
    loadingState.classList.remove('hidden');

    try {
        // Call the API
        const questions = await generateQuestions(jobTitle);

        // Hide loading and show results
        loadingState.classList.add('hidden');
        displayQuestions(questions, jobTitle);
    } catch (error) {
        loadingState.classList.add('hidden');
        showError(error.message);
    }
}

/**
 * Call the Netlify function to generate questions
 * The function handles the API call securely on the server
 */
async function generateQuestions(jobTitle) {
    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ jobTitle })
        });

        const data = await response.json();

        if (!response.ok) {
            // Parse error message from response
            if (data.error) {
                throw new Error(data.error);
            }
            // Check for specific error types
            if (response.status === 401) {
                throw new Error('Authentication failed.');
            } else if (response.status === 429) {
                throw new Error('Too many requests. Please wait a moment and try again.');
            } else if (response.status === 500) {
                throw new Error('Server error. Please try again later.');
            } else {
                throw new Error(`Error: ${response.statusText}`);
            }
        }

        if (data.error) {
            throw new Error(data.error);
        }

        if (!data.questions || data.questions.length === 0) {
            throw new Error('Could not generate questions. Please try again.');
        }

        return data.questions;
    } catch (error) {
        throw new Error(error.message || 'Failed to generate questions. Please try again.');
    }
}

/**
 * Display questions in the UI
 */
function displayQuestions(questions, jobTitle) {
    // Clear previous questions
    questionsList.innerHTML = '';

    // A fresh set of questions means the old audio (and its cached blobs) is
    // no longer relevant - stop playback and free the object URLs
    clearAudioCache();

    // Create a question element for each question
    questions.forEach((question, index) => {
        const questionItem = document.createElement('div');
        questionItem.className = 'question-item';

        const heading = document.createElement('h3');
        heading.textContent = `Question ${index + 1}`;

        const row = document.createElement('div');
        row.className = 'question-row';

        const text = document.createElement('p');
        text.textContent = question; // textContent escapes automatically

        const listenBtn = document.createElement('button');
        listenBtn.type = 'button';
        listenBtn.className = 'btn-listen';
        listenBtn.textContent = '\uD83D\uDD0A Listen';
        // Close over the raw (unescaped) question text directly, rather than
        // reading it back from the DOM, so nothing needs re-parsing
        listenBtn.addEventListener('click', () => playQuestionAudio(question, listenBtn));

        row.appendChild(text);
        row.appendChild(listenBtn);

        questionItem.appendChild(heading);
        questionItem.appendChild(row);
        questionsList.appendChild(questionItem);
    });

    // Show results container
    resultsContainer.classList.remove('hidden');
}

/**
 * Request speech audio for a question (once) and toggle play/pause on
 * subsequent clicks, using the same audio, so the API is only called once
 * per question. Talks to ElevenLabs' Text-to-Speech API through a serverless
 * proxy: the API key never reaches the browser.
 */
async function playQuestionAudio(questionText, buttonEl) {
    // Already generated - just toggle play/pause on the cached audio
    if (audioCache.has(buttonEl)) {
        const { audio } = audioCache.get(buttonEl);
        if (audio.paused) {
            pauseAllExcept(buttonEl);
            audio.play();
            setButtonState(buttonEl, 'playing');
        } else {
            audio.pause();
            setButtonState(buttonEl, 'paused');
        }
        return;
    }

    // First click for this question - fetch audio from the server
    setButtonState(buttonEl, 'loading');

    try {
        const response = await fetch(SPEECH_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: questionText })
        });

        if (!response.ok) {
            let message = 'Could not play audio. Please try again.';
            try {
                const data = await response.json();
                if (data.error) message = data.error;
            } catch (_) {
                // Response wasn't JSON (e.g. a raw error page) - keep default message
            }
            throw new Error(message);
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        audio.addEventListener('ended', () => setButtonState(buttonEl, 'idle'));
        audio.addEventListener('pause', () => {
            // Only reflect "paused" if it didn't just finish naturally
            if (audio.currentTime > 0 && audio.currentTime < audio.duration) {
                setButtonState(buttonEl, 'paused');
            }
        });
        audio.addEventListener('play', () => setButtonState(buttonEl, 'playing'));

        audioCache.set(buttonEl, { audio, url: audioUrl });

        pauseAllExcept(buttonEl);
        await audio.play();
    } catch (error) {
        console.error('Speech playback error:', error.message);
        setButtonState(buttonEl, 'error');
        setTimeout(() => setButtonState(buttonEl, 'idle'), 2500);
    }
}

/**
 * Pause every cached audio except the one tied to keepButton, and reflect
 * that in each of their button labels
 */
function pauseAllExcept(keepButton) {
    audioCache.forEach(({ audio }, button) => {
        if (button !== keepButton && !audio.paused) {
            audio.pause();
        }
    });
}

/**
 * Update a Listen button's label/disabled state for a given playback state
 */
function setButtonState(buttonEl, state) {
    switch (state) {
        case 'loading':
            buttonEl.textContent = 'Loading...';
            buttonEl.disabled = true;
            break;
        case 'playing':
            buttonEl.textContent = '\u23F8 Pause';
            buttonEl.disabled = false;
            break;
        case 'paused':
            buttonEl.textContent = '\u25B6 Resume';
            buttonEl.disabled = false;
            break;
        case 'error':
            buttonEl.textContent = 'Error - retry';
            buttonEl.disabled = false;
            break;
        case 'idle':
        default:
            buttonEl.textContent = '\uD83D\uDD0A Listen';
            buttonEl.disabled = false;
            break;
    }
}

/**
 * Stop all cached audio and release their object URLs - called when a new
 * set of questions is generated, since the old audio no longer applies
 */
function clearAudioCache() {
    audioCache.forEach(({ audio, url }) => {
        audio.pause();
        URL.revokeObjectURL(url);
    });
    audioCache.clear();
}

/**
 * Escape HTML to prevent XSS attacks
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Show error message
 */
function showError(message) {
    errorMessage.textContent = message;
    errorContainer.classList.remove('hidden');
}

/**
 * Hide all containers
 */
function hideAll() {
    loadingState.classList.add('hidden');
    resultsContainer.classList.add('hidden');
    errorContainer.classList.add('hidden');
}

/**
 * Reset form and hide results
 */
function resetForm() {
    jobTitleInput.value = '';
    hideAll();
    jobTitleInput.focus();
}
