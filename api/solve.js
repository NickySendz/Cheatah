module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, mimeType, subject, mode } = req.body || {};

  if (!imageBase64 || !mimeType) {
    return res.status(400).json({ error: 'Missing image data' });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY not set in Vercel environment variables' });
  }

  const PROMPTS = {
    general: '',
    math:    'Answer like a perfect math student. Show concise steps.',
    bio:     'Answer like a perfect AP Biology student. Use precise scientific terminology.',
    chem:    'Answer like a perfect chemistry student. Show formulas and balance equations.',
    history: 'Answer like a perfect history student. Reference key dates, people, and causes.',
    english: 'Answer like a perfect English student. Quote text evidence where relevant.',
    physics: 'Answer like a perfect physics student. Show formulas, units, and numeric steps.',
    sat:     'Answer in SAT/ACT format. For multiple choice, state the letter and a one-line reason.',
  };

  const modeNote = mode === 'study'
    ? 'For each question provide the correct answer, a full explanation, and confidence %.'
    : 'For each question state the correct answer only. Include confidence %.';

  const prompt = `You are Cheatah, an AI that reads test and quiz images and answers every question.
${PROMPTS[subject] || ''}

IMPORTANT: Many tests are multiple choice with radio buttons or letters (A/B/C/D). Identify the correct option.

Format EXACTLY like this for every question:

Q1. [full question text]
Answer: [the correct answer]
Confidence: [0-100]%

Q2. [full question text]
Answer: [the correct answer]
Confidence: [0-100]%

Repeat for every question visible in the image. ${modeNote}`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        max_tokens: 2000,
        temperature: 0.1,
        messages: [
          { role: 'system', content: prompt },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${imageBase64}` }
              },
              {
                type: 'text',
                text: 'Read this test image carefully and answer every question using the exact format specified.'
              }
            ]
          }
        ]
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message || JSON.stringify(data.error) });
    }

    const text = data.choices?.[0]?.message?.content || '';

    if (!text) {
      return res.status(500).json({ error: 'No response. Raw: ' + JSON.stringify(data).slice(0, 300) });
    }

    return res.status(200).json({ text });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unknown error' });
  }
}

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};
