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

        // Enhance prompt to reference the person's appearance
    const enhancedPrompt = `A photorealistic Christmas portrait of a person resembling the photo provided, ${prompt.toLowerCase()}`;

    const response = await fetch('https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUGGINGFACE_API_TOKEN}`,        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: enhancedPrompt,        parameters: {
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
