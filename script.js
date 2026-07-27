// Configuration
const API_ENDPOINT = '/.netlify/functions/generateQuestions';
const SPEECH_ENDPOINT = '/.netlify/functions/generateSpeech';

// Tracks the audio currently playing so starting a new one stops the last one
let currentAudio = null;

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

    // Stop any audio left over from a previous set of questions
    stopCurrentAudio();

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
 * Request speech audio for a question from the Netlify function and play it.
 * Talks to ElevenLabs' Text-to-Speech API through a serverless proxy, the
 * same pattern used for Gemini: the API key never reaches the browser.
 */
async function playQuestionAudio(questionText, buttonEl) {
    const originalLabel = buttonEl.textContent;
    buttonEl.disabled = true;
    buttonEl.textContent = 'Loading...';

    try {
        stopCurrentAudio();

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
        currentAudio = audio;

        buttonEl.textContent = '\u23F8 Playing...';

        const resetButton = () => {
            buttonEl.textContent = originalLabel;
            buttonEl.disabled = false;
            URL.revokeObjectURL(audioUrl);
            if (currentAudio === audio) currentAudio = null;
        };

        audio.addEventListener('ended', resetButton);
        audio.addEventListener('error', resetButton);

        await audio.play();
    } catch (error) {
        buttonEl.textContent = 'Error - retry';
        buttonEl.disabled = false;
        console.error('Speech playback error:', error.message);
        setTimeout(() => {
            buttonEl.textContent = originalLabel;
        }, 2500);
    }
}

/**
 * Stop and clean up whatever audio is currently playing, if anything
 */
function stopCurrentAudio() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
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
