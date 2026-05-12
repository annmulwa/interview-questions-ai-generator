/**
 * Netlify Function to generate interview questions
 */
exports.handler = async (event) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { jobTitle } = JSON.parse(event.body);

        // Validate input
        if (!jobTitle || typeof jobTitle !== 'string') {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Invalid job title' })
            };
        }

        // Sanitize input (max 100 chars)
        const sanitizedJobTitle = jobTitle.trim().slice(0, 100);

        // Check if input contains at least one letter (not just numbers/symbols)
        if (!/[a-zA-Z]/.test(sanitizedJobTitle)) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Job title must contain at least one letter' })
            };
        }

        // Get API key from environment variables
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.error('GEMINI_API_KEY not configured');
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Server configuration error' })
            };
        }

        // Call Gemini API
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: `Generate exactly 3 thoughtful, specific interview questions for a ${sanitizedJobTitle} role. Format your response as a numbered list (1., 2., 3.) with just the questions, no additional text or explanation. Focus on behavioral and role-specific questions that assess key competencies.`
                                }
                            ]
                        }
                    ]
                })
            }
        );

        if (!response.ok) {
            console.error(`Gemini API error: ${response.statusText}`);
            if (response.status === 401) {
                return {
                    statusCode: 500,
                    body: JSON.stringify({ error: 'API authentication failed' })
                };
            } else if (response.status === 429) {
                return {
                    statusCode: 429,
                    body: JSON.stringify({ error: 'Too many requests. Please try again later.' })
                };
            } else {
                return {
                    statusCode: 502,
                    body: JSON.stringify({ error: 'Failed to generate questions' })
                };
            }
        }

        const data = await response.json();

        // Extract and parse questions
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            return {
                statusCode: 502,
                body: JSON.stringify({ error: 'Unexpected API response' })
            };
        }

        const responseText = data.candidates[0].content.parts[0].text;
        const questions = parseQuestions(responseText);

        if (questions.length === 0) {
            return {
                statusCode: 502,
                body: JSON.stringify({ error: 'Could not parse questions' })
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ questions })
        };
    } catch (error) {
        console.error('Function error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

/**
 * Parse numbered questions from response text
 */
function parseQuestions(text) {
    const questionPattern = /^\d+\.\s+(.+)$/gm;
    const matches = [...text.matchAll(questionPattern)];
    const questions = matches.map(match => match[1].trim());
    return questions.slice(0, 3);
}
