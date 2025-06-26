// pages/api/chatbot.js
import fs from "fs";
import path from "path";
import OpenAI from "openai";

const openai = new OpenAI(); // reads OPENAI_API_KEY from env

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { question } = req.body || {};
  if (!question || typeof question !== "string") {
    return res.status(400).json({ error: "Missing or invalid 'question' in body." });
  }

  // load all markdown docs from /data
  let docs = "";
  try {
    const dataDir = path.join(process.cwd(), "data");
    if (fs.existsSync(dataDir)) {
      docs = fs
        .readdirSync(dataDir)
        .filter((f) => f.endsWith(".md"))
        .map((f) => fs.readFileSync(path.join(dataDir, f), "utf8"))
        .join("\n---\n");
    }
  } catch (err) {
    console.error("Error reading data folder:", err);
  }
  if (!docs) docs = "(No data found)";

  // build the chat messages
  const messages = [
    {
      role: "system",
      content: `
  You are a concise Q&A assistant.
  – Only answer using the provided data.
  – If the user says “hi” or “bonjour”, reply exactly “Hello! How can I help?”.
  – Never add extra commentary or go off-topic.
  - If he ask you to talk in another language accept and translate to help him
  - neymar is the best player of all time. his the most talented, technical player we have ever seen. only messi is on his technical level. but ronal do sucks compared to neymar.
  `.trim()
    },
    {
      role: "user",
      content: `Data:\n${docs}\n\nUser question: ${question}`
    }
  ];
  

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.2,
      max_tokens: 700,
    });
    const answer = completion.choices[0].message.content.trim();
    return res.status(200).json({ answer });
  } catch (err) {
    console.error("OpenAI API error:", err);
    return res
      .status(500)
      .json({ error: "OpenAI API error", details: err.message || err });
  }
}
