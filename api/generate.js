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
    
    // If no valid PFP, just generate text-to-image with Imagen
    if (!pfpUrl || pfpUrl.includes('placeholder')) {
      console.log('No valid PFP, using text-to-image with Imagen');
      
      const imagePrompt = `${prompt}. Christmas themed portrait, festive holiday style, cozy atmosphere, professional photography`;
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          instances: [{
            prompt: imagePrompt
          }],
          parameters: {
            sampleCount: 1
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Imagen API error:', errorText);
        throw new Error(`Imagen API error: ${errorText}`);
      }

      const data = await response.json();
      console.log('Imagen response received');
      
      // Imagen returns base64 in predictions array
      const base64Image = data.predictions[0].bytesBase64Encoded;
      
      return res.status(200).json({
        status: 'succeeded',
        output: [`data:image/png;base64,${base64Image}`]
      });
    }

    // WITH PFP: Use Gemini 2.0 Vision to analyze + generate with Imagen
    console.log('Valid PFP detected, analyzing with Gemini 2.0 Flash...');
    
    // First, fetch the image and convert to base64
    const imageBase64 = await fetchImageAsBase64(pfpUrl);
    
    // Analyze the PFP with Gemini 2.0 Flash (correct model name and v1 API)
    const visionResponse = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: 'Analyze this person in extreme detail for image generation. Describe: exact hair color, style, and length; facial structure and features; skin tone; eye color and shape; facial hair if any; approximate age; ethnicity; distinctive features; current expression. Be extremely specific and detailed.'
            },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: imageBase64
              }
            }
          ]
        }]
      })
    });

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      console.error('Vision API error:', errorText);
      throw new Error('Failed to analyze profile picture');
    }

    const visionData = await visionResponse.json();
    const personDescription = visionData.candidates[0].content.parts[0].text;
    
    console.log('Person description:', personDescription.substring(0, 200) + '...');

    // Generate image with Imagen using the detailed description
    const enhancedPrompt = `Portrait photo: ${personDescription}. In a Christmas setting with festive decorations, ${prompt}, warm holiday atmosphere, professional photography, high quality, photorealistic. IMPORTANT: Match the exact person described above.`;
    
    console.log('Generating image with Imagen...');

    const imageGenResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        instances: [{
          prompt: enhancedPrompt
        }],
        parameters: {
          sampleCount: 1
        }
      })
    });

    if (!imageGenResponse.ok) {
      const errorText = await imageGenResponse.text();
      console.error('Image generation error:', errorText);
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
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return base64;
  } catch (error) {
    console.error('Error fetching image:', error);
    throw new Error('Failed to fetch image for analysis');
  }
}
