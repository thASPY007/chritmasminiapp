// Function to analyze PFP using OpenAI GPT-4 Vision
async function analyzePFP(pfpUrl) {
  if (!pfpUrl || pfpUrl.includes('placeholder')) {
    return null; // Skip analysis for placeholder images
  }
  
  try {
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this person\'s physical appearance in EXTREME detail for use in photorealistic AI image generation. Describe: hair (color, length, style, texture), facial hair, skin tone, face shape, eye color, distinctive features, approximate age, ethnicity/appearance, clothing style visible, overall aesthetic. Be very specific and detailed. Max 80 words.'
              },
              {
                type: 'image_url',
                image_url: { url: pfpUrl }
              }
            ]
          }
        ],
        max_tokens: 150
      })
    });
    
    if (!openaiResponse.ok) {
      console.error('OpenAI API error:', await openaiResponse.text());
      return null;
    }
    
    const data = await openaiResponse.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error analyzing PFP:', error);
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, pfpUrl } = req.body;
    
    // Analyze PFP to get personalized description
    const pfpDescription = await analyzePFP(pfpUrl);

    // Enhance prompt to reference the person's appearance
    const enhancedPrompt = pfpDescription && pfpDescription.length > 0
      ? `Portrait of a person with ${pfpDescription}. Christmas themed with festive holiday outfit and cozy atmosphere. Photorealistic, professional quality.`
      : `${prompt.toLowerCase()}. Christmas theme, festive, professional photography.`;

    const response = await fetch('https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUGGINGFACE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: enhancedPrompt,
        parameters: {
          num_inference_steps: 4,
          guidance_scale: 0
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HuggingFace API error: ${errorText}`);
    }

    // HuggingFace returns the image as a blob
    const imageBlob = await response.blob();
    
    // Convert blob to base64
    const buffer = await imageBlob.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const imageUrl = `data:image/png;base64,${base64}`;

    return res.status(200).json({
      status: 'succeeded',
      output: [imageUrl]
    });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
