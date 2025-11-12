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
    const HUGGINGFACE_API_TOKEN = process.env.HUGGINGFACE_API_TOKEN;

    if (!GEMINI_API_KEY || !HUGGINGFACE_API_TOKEN) {
      throw new Error('API keys not configured');
    }

    // Fetch the profile picture
    let imageData = null;
    let imageBuffer = null;
    if (pfpUrl) {
      try {
        const imageResponse = await fetch(pfpUrl);
        if (imageResponse.ok) {
          const arrayBuffer = await imageResponse.arrayBuffer();
          imageBuffer = Buffer.from(arrayBuffer);
          imageData = imageBuffer.toString('base64');
          console.log('Successfully fetched profile picture');
        }
      } catch (error) {
        console.log('Could not fetch profile picture:', error.message);
      }
    }

    // Step 1: Use Gemini 2.0 Flash to analyze the image
    let analysisDescription = '';
    if (imageData) {
      console.log('Analyzing image with Gemini 2.0 Flash...');
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
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
                    inline_data: {
                      mime_type: "image/jpeg",
                      data: imageData
                    }
                  },
                  {
                    text: "Describe this person's appearance in detail: their gender, age, hair color and style, skin tone, facial features, clothing style, and any distinctive characteristics. Be specific and concise, focusing on visual details that would help create an accurate portrait."
                  }
                ]
              }
            ]
          })
        }
      );

      if (geminiResponse.ok) {
        const geminiResult = await geminiResponse.json();
        analysisDescription = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
        console.log('Gemini analysis:', analysisDescription);
      } else {
        console.log('Gemini analysis failed, proceeding without it');
      }
    }

    // Step 2: Build enhanced Christmas prompt with Gemini's analysis
    const enhancedPrompt = analysisDescription 
      ? `${analysisDescription}. Transform this person into a festive Christmas portrait: wearing a cozy Christmas sweater with holiday patterns, surrounded by Christmas decorations, warm fairy lights in background, holding a mug of hot chocolate, joyful expression, professional photography, cinematic lighting, high quality, 4k`
      : `${prompt}. Festive Christmas portrait with cozy sweater, holiday decorations, warm lighting, professional quality`;
    
    console.log('Enhanced prompt:', enhancedPrompt);

    // Step 3: Use HuggingFace Image-to-Image model
    const hfModel = imageBuffer 
      ? 'timbrooks/instruct-pix2pix' // Image-to-image
      : 'black-forest-labs/FLUX.1-dev'; // Text-to-image fallback

    console.log(`Using HuggingFace model: ${hfModel}`);

    const hfResponse = await fetch(
      `https://router.huggingface.co/hf-inference/models/${hfModel}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HUGGINGFACE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(imageBuffer ? {
          inputs: enhancedPrompt,
          parameters: {
            image: imageData,
            strength: 0.75,
            guidance_scale: 7.5,
            num_inference_steps: 50
          }
        } : {
          inputs: enhancedPrompt,
          parameters: {
            guidance_scale: 7.5,
            num_inference_steps: 50
          }
        })
      }
    );

    if (!hfResponse.ok) {
      const errorText = await hfResponse.text();
      console.error('HuggingFace API error:', errorText);
      throw new Error(`HuggingFace API error: ${hfResponse.status}`);
    }

    // Convert response to base64
    const imageArrayBuffer = await hfResponse.arrayBuffer();
    const base64Image = Buffer.from(imageArrayBuffer).toString('base64');
    
    console.log('Image generated successfully with hybrid approach');

    return res.status(200).json({
      status: 'succeeded',
      output: [`data:image/png;base64,${base64Image}`]
    });

  } catch (error) {
    console.error('Error:', error.message);
    return res.status(500).json({
      status: 'failed',
      error: error.message || 'Image generation failed'
    });
  }
}
