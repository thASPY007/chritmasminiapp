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

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    // If no valid PFP, just generate text-to-image
    if (!pfpUrl || pfpUrl.includes('placeholder')) {
      console.log('No valid PFP, using text-to-image only');
      
      const imagePrompt = `${prompt}. Christmas themed portrait, festive holiday style, cozy atmosphere, professional photography`;
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          instances: [{
            prompt: imagePrompt
          }],
          parameters: {
            sampleCount: 1,
            aspectRatio: '1:1',
            negativePrompt: 'blurry, low quality, distorted',
            safetyFilterLevel: 'block_some',
            personGeneration: 'allow_all'
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${errorText}`);
      }

      const data = await response.json();
      const base64Image = data.predictions[0].bytesBase64Encoded;
      
      return res.status(200).json({
        status: 'succeeded',
        output: [`data:image/png;base64,${base64Image}`]
      });
    }

    // WITH PFP: Use Gemini Vision to analyze + generate with detailed description
    console.log('Valid PFP detected, analyzing with Gemini Vision...');
    
    // First, analyze the PFP with Gemini Vision
    const visionResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: 'Analyze this person in extreme detail. Describe: exact hair color, style, and length; facial structure and features; skin tone; eye color and shape; facial hair if any; approximate age; ethnicity; distinctive features; current clothing/style. Be extremely specific and detailed so an AI can recreate this exact person.'
            },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: pfpUrl.includes('base64') ? pfpUrl.split(',')[1] : await fetchImageAsBase64(pfpUrl)
              }
            }
          ]
        }]
      })
    });

    if (!visionResponse.ok) {
      console.error('Vision API error:', await visionResponse.text());
      throw new Error('Failed to analyze profile picture');
    }

    const visionData = await visionResponse.json();
    const personDescription = visionData.candidates[0].content.parts[0].text;
    
    console.log('Person description:', personDescription);

    // Generate image with detailed person description + Christmas theme
    const enhancedPrompt = `Create a photorealistic Christmas portrait of this exact person: ${personDescription}. ${prompt}. CRITICAL: The person must have the EXACT physical features described above - same face, hair, skin tone, eyes, and distinctive features. Christmas setting with festive decorations, warm holiday atmosphere, professional portrait photography, high quality, detailed.`;
    
    console.log('Enhanced prompt:', enhancedPrompt.substring(0, 200) + '...');

    const imageGenResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        instances: [{
          prompt: enhancedPrompt
        }],
        parameters: {
          sampleCount: 1,
          aspectRatio: '1:1',
          negativePrompt: 'blurry, low quality, distorted, cartoon, anime',
          safetyFilterLevel: 'block_some',
          personGeneration: 'allow_all'
        }
      })
    });

    if (!imageGenResponse.ok) {
      const errorText = await imageGenResponse.text();
      throw new Error(`Image generation error: ${errorText}`);
    }

    const imageData = await imageGenResponse.json();
    const base64Image = imageData.predictions[0].bytesBase64Encoded;

    return res.status(200).json({
      status: 'succeeded',
      output: [`data:image/png;base64,${base64Image}`]
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Helper function to fetch image and convert to base64
async function fetchImageAsBase64(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return base64;
  } catch (error) {
    console.error('Error fetching image:', error);
    throw new Error('Failed to fetch image for analysis');
  }
}
