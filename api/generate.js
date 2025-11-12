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

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    // First, fetch the profile picture
    let imageData = null;
    if (pfpUrl) {
      try {
        const imageResponse = await fetch(pfpUrl);
        if (imageResponse.ok) {
          const arrayBuffer = await imageResponse.arrayBuffer();
          imageData = Buffer.from(arrayBuffer).toString('base64');
          console.log('Successfully fetched profile picture');
        }
      } catch (error) {
        console.log('Could not fetch profile picture, will generate without it:', error.message);
      }
    }

    // Build the Christmas-themed prompt
    const finalPrompt = `Transform this into a festive Christmas portrait: ${prompt}. The image should have a Christmas theme with festive elements like a christmas sweater, holiday decorations, warm cozy lighting, and a joyful holiday atmosphere. Professional photography style, high quality, cinematic lighting.`;
    
    console.log('Generating with Gemini 2.5 Flash Image');

    // Use Gemini 2.5 Flash Image for image generation
    const requestBody = {
      contents: [
        {
          parts: [
            { text: finalPrompt }
          ]
        }
      ],
      generationConfig: {
        responseModalities: ["IMAGE"],
        temperature: 1.0,
        topP: 0.95,
      }
    };

    // If we have a profile picture, add it to the request
    if (imageData) {
      requestBody.contents[0].parts.unshift({
        inline_data: {
          mime_type: "image/jpeg",
          data: imageData
        }
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Gemini response received');

    // Extract the generated image from the response
    if (!result.candidates || !result.candidates[0] || !result.candidates[0].content) {
      throw new Error('No image generated in response');
    }

    const content = result.candidates[0].content;
    let generatedImageBase64 = null;

    // Find the image part in the response
    for (const part of content.parts) {
      if (part.inline_data && part.inline_data.mime_type && part.inline_data.mime_type.startsWith('image/')) {
        generatedImageBase64 = part.inline_data.data;
        break;
      }
    }

    if (!generatedImageBase64) {
      throw new Error('No image data found in response');
    }

    console.log('Image generated successfully');

    // Return the base64 image with proper data URI format
    return res.status(200).json({
      status: 'succeeded',
      output: [`data:image/png;base64,${generatedImageBase64}`]
    });

  } catch (error) {
    console.error('Error:', error.message);
    return res.status(500).json({
      status: 'failed',
      error: error.message || 'Image generation failed'
    });
  }
}
