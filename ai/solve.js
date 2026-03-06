// Tell Vercel to allow larger request bodies (images can be 4-6MB as base64)
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

  const { imageBase64, mimeType, subject, mode } = req.body;

  if (!imageBase64 || !mimeType) {
    return res.status(400).json({ error: 'Missing image data' });
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
    ? 'For each question provide the correct answer choice, a full explanation of why it is correct, and your confidence %.'
    : 'For each question state the correct answer choice letter/text only. Include confidence %.';

  const system = `You are Cheatah, an AI that reads test and quiz images and answers every question.
${PROMPTS[subject] || ''}

IMPORTANT: Many tests are multiple choice. If you see lettered or radio button options (A/B/C/D or a/b/c/d), identify the correct one.

You MUST format your response EXACTLY like this for every question — no deviations:

Q1. [full question text]
Answer: [the correct answer]
Confidence: [0-100]%

Q2. [full question text]
Answer: [the correct answer]
Confidence: [0-100]%

Repeat this format for EVERY question visible in the image. ${modeNote}`;

  try {
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
              { type: 'text', text: 'Read this test image carefully and answer every question you can see using the exact format specified.' }
            ]
          }
        ]
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    const text = data.choices?.[0]?.message?.content || '';
    return res.status(200).json({ text });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Something went wrong' });
  }
}
