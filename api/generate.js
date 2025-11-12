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

    const HUGGINGFACE_API_TOKEN = process.env.HUGGINGFACE_API_TOKEN;
    
    // Build the Christmas-themed prompt
    let finalPrompt = `${prompt}. Christmas themed portrait, festive holiday style, wearing a christmas sweater, cozy atmosphere, professional photography, Christmas decorations in background, warm lighting, high quality`;
    
    console.log('Generating with prompt:', finalPrompt);
    
    // Use FLUX.1-dev for better quality
    const response = await fetch('https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-dev', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUGGINGFACE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: finalPrompt,
        parameters: {
          guidance_scale: 7.5,
          num_inference_steps: 50
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HuggingFace API error:', errorText);
      throw new Error(`HuggingFace API error: ${errorText}`);
    }

    // HuggingFace returns image as blob
    const imageBlob = await response.blob();
    const buffer = await imageBlob.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const base64Image = `data:image/png;base64,${base64}`;
    
    console.log('Image generated successfully');

    return res.status(200).json({
      status: 'succeeded',
      output: [base64Image]
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
