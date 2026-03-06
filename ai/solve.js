export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, mimeType, subject, mode } = req.body || {};

  // Log what we received for debugging
  console.log('solve called:', {
    hasImage: !!imageBase64,
    imageLen: imageBase64?.length,
    mimeType,
    subject,
    mode,
    hasKey: !!process.env.OPENAI_API_KEY,
    keyPrefix: process.env.OPENAI_API_KEY?.slice(0,8),
  });

  if (!imageBase64 || !mimeType) {
    return res.status(400).json({ error: 'Missing image data. imageBase64: ' + !!imageBase64 + ', mimeType: ' + !!mimeType });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not set in Vercel environment variables' });
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

  const system = `You are Cheatah, an AI that reads test and quiz images and answers every question.
${PROMPTS[subject] || ''}

IMPORTANT: Many tests are multiple choice. If you see lettered or radio button options (A/B/C/D), identify the correct one.

Format EXACTLY like this for every question:

Q1. [full question text]
Answer: [the correct answer]
Confidence: [0-100]%

Q2. [full question text]
Answer: [the correct answer]
Confidence: [0-100]%

${modeNote}`;

  try {
    console.log('Calling OpenAI API...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 2000,
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'high' } },
              { type: 'text', text: 'Read this test image carefully and answer every question using the exact format specified.' }
            ]
          }
        ]
      })
    });

    console.log('OpenAI status:', response.status);

    const data = await response.json();
    console.log('OpenAI response keys:', Object.keys(data));

    if (data.error) {
      console.error('OpenAI error:', data.error);
      return res.status(500).json({ error: data.error.message || JSON.stringify(data.error) });
    }

    const text = data.choices?.[0]?.message?.content || '';
    console.log('Got text, length:', text.length);

    return res.status(200).json({ text });

  } catch (err) {
    console.error('Caught error:', err);
    return res.status(500).json({ error: err.message || 'Unknown error' });
  }
}
