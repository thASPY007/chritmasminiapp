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
    const { prompt } = req.body;

    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer r8_EVqAOSi9jOFJEe7OLa8zWyNFmEq8LbZ3MOysI',      body: JSON.stringify({
        version: '5599ed30703defd1d160a25a63321b4dec97101d98b4674bcc56e41f62f35637',
        input: {
          prompt: prompt,
          width: 1024,
          height: 1024,
          num_inference_steps: 4,
          output_format: 'png'
        }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.detail || `API Error: ${response.status}`);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
