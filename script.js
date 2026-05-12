// Configuration
const API_ENDPOINT = '/.netlify/functions/generateQuestions';

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

        if (!response.ok) {
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

        const data = await response.json();

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

    // Create a question element for each question
    questions.forEach((question, index) => {
        const questionItem = document.createElement('div');
        questionItem.className = 'question-item';

        questionItem.innerHTML = `
            <h3>Question ${index + 1}</h3>
            <p>${escapeHtml(question)}</p>
        `;

        questionsList.appendChild(questionItem);
    });

    // Show results container
    resultsContainer.classList.remove('hidden');
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
