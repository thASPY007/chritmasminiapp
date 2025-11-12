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

    console.log('PFP URL:', pfpUrl);
    console.log('Original prompt:', prompt);

    // If no valid PFP, just generate text-to-image
    if (!pfpUrl || pfpUrl.includes('placeholder')) {
      console.log('No valid PFP, using text-to-image only');
      
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: `${prompt}. Christmas themed portrait, festive holiday style, cozy atmosphere, professional photography`,
          n: 1,
          size: '1024x1024',
          quality: 'standard'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${errorText}`);
      }

      const data = await response.json();
      const imageUrl = data.data[0].url;

      // Download and convert to base64
      const imageResponse = await fetch(imageUrl);
      const imageBlob = await imageResponse.blob();
      const buffer = await imageBlob.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const base64Image = `data:image/png;base64,${base64}`;

      return res.status(200).json({
        status: 'succeeded',
        output: [base64Image]
      });
    }

    // WITH PFP: Use vision analysis + image generation with detailed description
    console.log('Valid PFP detected, analyzing with GPT-4 Vision...');
    
    const visionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
                text: 'Analyze this person in extreme detail. Describe: exact hair color, style, and length; facial structure and features; skin tone; eye color and shape; facial hair if any; approximate age; ethnicity; distinctive features; current clothing/style. Be extremely specific and detailed so an AI can recreate this exact person.'
              },
              {
                type: 'image_url',
                image_url: { url: pfpUrl }
              }
            ]
          }
        ],
        max_tokens: 200
      })
    });

    if (!visionResponse.ok) {
      console.error('Vision API error:', await visionResponse.text());
      throw new Error('Failed to analyze profile picture');
    }

    const visionData = await visionResponse.json();
    const personDescription = visionData.choices[0].message.content;
    
    console.log('Person description:', personDescription);

    // Generate image with detailed person description + Christmas theme
    const enhancedPrompt = `Create a photorealistic Christmas portrait of this exact person: ${personDescription}. ${prompt}. CRITICAL: The person must have the EXACT physical features described above - same face, hair, skin tone, eyes, and distinctive features. Christmas setting with festive decorations, warm holiday atmosphere, professional portrait photography, high quality, detailed.`;
    
    console.log('Enhanced prompt:', enhancedPrompt.substring(0, 200) + '...');

    const imageGenResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: enhancedPrompt,
        n: 1,
        size: '1024x1024',
        quality: 'hd'
      })
    });

    if (!imageGenResponse.ok) {
      const errorText = await imageGenResponse.text();
      throw new Error(`Image generation error: ${errorText}`);
    }

    const imageData = await imageGenResponse.json();
    const imageUrl = imageData.data[0].url;

    // Download and convert to base64
    const imageResponse = await fetch(imageUrl);
    const imageBlob = await imageResponse.blob();
    const buffer = await imageBlob.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const base64Image = `data:image/png;base64,${base64}`;

    return res.status(200).json({
      status: 'succeeded',
      output: [base64Image]
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
