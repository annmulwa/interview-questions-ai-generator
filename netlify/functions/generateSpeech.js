/**
 * Netlify Function to convert an interview question to speech using ElevenLabs.
 * Mirrors the security pattern used in generateQuestions.js: the API key never
 * reaches the browser, and all input is validated before being forwarded upstream.
 */

// Default voice: "Rachel", a stock premade ElevenLabs voice available on all plans
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

// Flash v2.5 favors latency (~75ms model inference) over the last few % of
// expressiveness, which is the right trade-off for a "read this back to me" UI.
const MODEL_ID = 'eleven_flash_v2_5';

exports.handler = async (event) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { text, voiceId } = JSON.parse(event.body);

        // Validate input
        if (!text || typeof text !== 'string') {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Invalid text' })
            };
        }

        // Sanitize input (max 1000 chars - generous for a single interview question)
        const sanitizedText = text.trim().slice(0, 1000);

        if (!/[a-zA-Z]/.test(sanitizedText)) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Text must contain at least one letter' })
            };
        }

        // Only allow the caller to override the voice with a plausible ElevenLabs
        // voice ID (alphanumeric); anything else falls back to the default voice
        // rather than being forwarded into the request path.
        const sanitizedVoiceId = (typeof voiceId === 'string' && /^[a-zA-Z0-9]{10,30}$/.test(voiceId))
            ? voiceId
            : DEFAULT_VOICE_ID;

        // Get API key from environment variables
        const apiKey = process.env.ELEVENLABS_API_KEY;

        if (!apiKey) {
            console.error('ELEVENLABS_API_KEY not configured');
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Server configuration error' })
            };
        }

        // Call ElevenLabs Text-to-Speech API
        const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${sanitizedVoiceId}`,
            {
                method: 'POST',
                headers: {
                    'xi-api-key': apiKey,
                    'Content-Type': 'application/json',
                    'Accept': 'audio/mpeg',
                },
                body: JSON.stringify({
                    text: sanitizedText,
                    model_id: MODEL_ID,
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75,
                    },
                }),
            }
        );

        if (!response.ok) {
            console.error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
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
                    body: JSON.stringify({ error: 'Failed to generate speech' })
                };
            }
        }

        // ElevenLabs returns raw audio bytes; Netlify Functions need binary
        // responses base64-encoded with isBase64Encoded set.
        const audioBuffer = await response.arrayBuffer();
        const base64Audio = Buffer.from(audioBuffer).toString('base64');

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'audio/mpeg',
            },
            body: base64Audio,
            isBase64Encoded: true,
        };
    } catch (error) {
        console.error('Function error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
