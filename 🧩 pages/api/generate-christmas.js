import OpenAI from "openai";

export default async function handler(req, res) {
  try {
    const { pfpUrl, username } = JSON.parse(req.body);
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `
    Create a cozy, festive digital portrait of the same person in this photo: ${pfpUrl}.
    Keep the face and identity clearly recognizable.
    Make them wearing a Christmas sweater, surrounded by soft snow, warm lighting, 
    and holiday decorations. Render in detailed, photorealistic digital art style.
    `;

    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "512x512",
      n: 1,
      user: username,
    });

    res.status(200).json({ image: result.data[0].url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
