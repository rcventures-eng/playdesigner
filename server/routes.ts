import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const SYSTEM_PROMPT = `You are an expert football play designer AI. You generate football plays in a specific JSON format for a web-based play designer application.

COORDINATE SYSTEM:
- Field dimensions: 694 x 392 pixels
- Line of Scrimmage (LOS): Y = 284 pixels
- Offense moves UP (lower Y values toward 0)
- Defense moves DOWN (higher Y values) or waits above LOS
- Field center X: 347 pixels
- Valid X range: 27 to 667 pixels (with side padding)
- Valid Y range for offense: 72 to 368 pixels
- Valid Y range for defense: 12 to 320 pixels

PLAYER COLOR CODES (use exact hex values):
- QB (Quarterback): #000000 (black)
- RB (Running Back): #39ff14 (neon green)
- WR (Wide Receiver): #39ff14 (neon green)
- TE (Tight End): #eab308 (yellow)
- OL (Offensive Line): #f97316 (orange)
- C (Center): #f97316 (orange)
- LB (Linebacker): #87CEEB (light blue)
- DB (Defensive Back): #9333ea (purple)
- DL (Defensive Line): #FFB6C1 (pink)

ROUTE TYPES:
- "straight": Direct line route
- "curved": Smooth curved route
- "zigzag": Sharp angle cuts

ROUTE STYLES:
- "solid": Standard route
- "dashed": Optional/check-down route

OUTPUT FORMAT - You MUST return valid JSON with this exact structure:
{
  "players": [
    {
      "id": "player-1",
      "label": "QB",
      "color": "#000000",
      "x": 347,
      "y": 312,
      "side": "offense"
    }
  ],
  "routes": [
    {
      "id": "route-1",
      "playerId": "player-1",
      "type": "curved",
      "style": "solid",
      "color": "#000000",
      "points": [{"x": 347, "y": 312}, {"x": 347, "y": 200}, {"x": 400, "y": 150}]
    }
  ]
}

IMPORTANT RULES:
1. Always include at least 5 offensive players for a valid formation
2. QB should be near center X (around 347) and below LOS (Y > 284)
3. Routes should start from the player's position
4. Routes should have at least 2 points (start and end)
5. Use realistic football formations and route concepts
6. Player IDs should be unique (player-1, player-2, etc.)
7. Route IDs should be unique and reference valid playerIds
8. Only return the JSON object, no markdown or explanation`;

export async function registerRoutes(app: Express): Promise<Server> {
  // Generate play endpoint using Gemini AI
  app.post("/api/generate-play", async (req, res) => {
    try {
      const { prompt, image } = req.body;

      if (!prompt && !image) {
        return res.status(400).json({ error: "Prompt or image is required" });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key not configured" });
      }

      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
        },
      });

      let result;

      if (image) {
        // Multimodal request with image
        const imageData = {
          inlineData: {
            data: image.replace(/^data:image\/\w+;base64,/, ""),
            mimeType: "image/png",
          },
        };

        const textPrompt = prompt || "Analyze this football play diagram and generate a play with players and routes based on what you see.";
        
        result = await model.generateContent([
          { text: SYSTEM_PROMPT },
          { text: textPrompt },
          imageData,
        ]);
      } else {
        // Text-only request
        result = await model.generateContent([
          { text: SYSTEM_PROMPT },
          { text: prompt },
        ]);
      }

      const response = result.response;
      const text = response.text();

      // Parse the JSON response
      let playData;
      try {
        playData = JSON.parse(text);
      } catch (parseError) {
        // Try to extract JSON from the response if it contains extra text
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          playData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("Invalid JSON response from AI");
        }
      }

      // Validate the response structure
      if (!playData.players || !Array.isArray(playData.players)) {
        throw new Error("Response missing players array");
      }
      if (!playData.routes || !Array.isArray(playData.routes)) {
        playData.routes = []; // Routes are optional
      }

      // Add timestamps to IDs to ensure uniqueness
      const ts = Date.now();
      playData.players = playData.players.map((p: any, i: number) => ({
        ...p,
        id: `player-${ts}-${i}`,
        side: p.side || "offense",
      }));
      playData.routes = playData.routes.map((r: any, i: number) => ({
        ...r,
        id: `route-${ts}-${i}`,
        playerId: playData.players[parseInt(r.playerId?.split("-").pop() || "0")]?.id || r.playerId,
      }));

      res.json(playData);
    } catch (error: any) {
      console.error("Generate play error:", error);
      res.status(500).json({ 
        error: error.message || "Failed to generate play",
        details: error.toString()
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
