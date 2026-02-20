import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import path from "path";
import { storage } from "./storage";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { FOOTBALL_CONFIG, FORMATIONS, resolveColorKey } from "../shared/football-config";
import { LOGIC_DICTIONARY } from "../shared/logic-dictionary";
import { db } from "./db";
import { aiGenerationLogs, users, teams, plays, passwordResetTokens, featureRequests, playTeams, teamCoaches, teamPlayers, teamSplits, teamBlankPages, insertUserSchema, insertTeamSchema, insertPlaySchema, insertFeatureRequestSchema, insertTeamCoachSchema, insertTeamPlayerSchema, insertTeamBlankPageSchema, SQUAD_NAMES } from "@shared/schema";
import { desc, eq, and, gt, asc, sql, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendWelcomeEmail, sendPasswordResetEmail, sendFeatureRequestEmail } from "./resend";
import { z } from "zod";

// In-memory storage for logic dictionary changes (persisted only in memory for now)
let customLogicDictionary: typeof LOGIC_DICTIONARY | null = null;

// Convert FORMATIONS to a format with resolved colors for AI consumption
const getFormationsForAI = () => {
  const result: Record<string, any> = {};
  for (const [size, sizeData] of Object.entries(FORMATIONS)) {
    result[size] = {
      offense: {} as Record<string, any>,
      defense: {} as Record<string, any>,
    };
    for (const [side, sideData] of Object.entries(sizeData)) {
      for (const [variation, formationData] of Object.entries(sideData as Record<string, any>)) {
        result[size][side][variation] = {
          name: formationData.name,
          description: formationData.description,
          players: formationData.players.map((p: any) => ({
            label: p.label,
            x: p.x,
            y: p.y,
            color: resolveColorKey(p.colorKey),
            side: p.side,
          })),
        };
      }
    }
  }
  return result;
};

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Vision-specific prompt for processing uploaded play images
const generateVisionSystemPrompt = () => {
  const { field, colors } = FOOTBALL_CONFIG;
  const formationsData = getFormationsForAI();
  
  return `You are an expert Football Play digitizer. You will receive an image of a hand-drawn football play diagram. Your job is to convert this visual diagram into a specific JSON structure that matches the FOOTBALL_CONFIG coordinate system.

CRITICAL "SNAP-TO-GRID" RULE:
1. First, analyze the image to identify the formation type by counting players:
   - 5 players = 5v5 formation
   - 7 players = 7v7 formation  
   - 9 players = 9v9 formation
   - 11 players = 11v11 formation

2. Once you identify the formation size, you MUST use the EXACT player starting coordinates from the formations below. DO NOT use pixel positions from the image for player starting points - use these config values:

${JSON.stringify(formationsData, null, 2)}

3. PLAYER IDENTIFICATION (use these rules in order):
   a) If the drawing has labels (QB, RB, X, Y, Z, TE, C, LG, RG, LT, RT), use the label directly.
   b) If no labels, use SPATIAL POSITION to identify players:
      - Center-bottom player (behind where ball would be) = QB
      - Player directly behind QB = RB
      - Far left receiver at the line = Z
      - Far right receiver at the line = X  
      - Inside left receiver/slot = Y
      - Inside right receiver/slot = TE
      - Players at the very center of the line = C (center) and guards/tackles
   c) Count from left to right for receivers: leftmost = Z, next inside = Y, rightmost = X
   d) If player count doesn't match exactly, use the closest formation size and fill positions left-to-right

4. Once identified, use the EXACT x, y coordinates from the matching formation player above.

ROUTE INTERPRETER RULES:
Analyze the lines drawn from each player:
- Straight Line → type: "straight" (linear path)
- Curved/Wavy Line → type: "curved" (arc or bend in the path)
- Dotted/Dashed Line → Set isMotion: true on that route (pre-snap motion)
- Arrow Head at End → Use the arrow endpoint direction to calculate the route target. Scale the direction to create realistic route depths.

ROUTE DEPTH SCALING:
- Short routes (slant, quick out): 3-5 yards = 36-60 pixels above player start
- Medium routes (dig, curl, comeback): 8-12 yards = 96-144 pixels
- Deep routes (go, post, corner): 15-25 yards = 180-300 pixels
- Use the visual length proportions from the drawing to determine route depth category

PRIMARY TARGET DETECTION:
- If you see "Primary", "1", "#1", a star, or any similar marking near a player or route endpoint, set isPrimary: true on that player's route.
- The primary receiver is the QB's first read.

MOTION DETECTION (OFFENSE ONLY):
- Set isMotion: true if ANY of these conditions are met:
  1. The word "Motion", "M", or "Mot" appears near the player or route
  2. The route has a HORIZONTAL segment BEFORE going vertical (pre-snap lateral movement)
  3. An arrow points horizontally at the line of scrimmage before the main route
- Motion routes show a player moving sideways before the snap, then running their actual route
- IMPORTANT: Dotted lines on OFFENSE indicate motion; dotted lines on DEFENSE indicate man coverage (different meaning)
- isMotion should ONLY be true for offensive players, never defensive

ZONE/SHAPE DETECTION (CRITICAL FOR DEFENSIVE PLAYS):
Look for oval, ellipse, or circular shapes in the image - these represent COVERAGE ZONES:
1. IDENTIFY ZONE SHAPES: Any oval/ellipse drawn on the field represents a coverage area
2. ASSOCIATE WITH PLAYERS: Each zone shape is typically associated with a nearby defensive player (the one responsible for that zone)
3. COLOR MAPPING:
   - Purple/violet ovals (#9333ea) = DB/Safety zone coverage
   - Light blue/cyan ovals (#87CEEB) = LB zone coverage  
   - Use the same color as the associated player
4. POSITION AND SIZE: Estimate the zone's center (x, y) and dimensions (width, height) based on the drawing
5. ZONE SHAPES ARE MANDATORY: If you see ANY ovals or zone markers, you MUST include them in the shapes array

SHAPE SIZING GUIDELINES:
- Small zones (short coverage): width ~120-150px, height ~80-100px
- Medium zones (hook/curl): width ~150-200px, height ~100-120px
- Large zones (deep thirds): width ~200-250px, height ~100-150px

REQUIRED OUTPUT FOR EVERY ROUTE:
You MUST explicitly set both isPrimary and isMotion for every route in your response:
- isPrimary: true if this is the primary target, false otherwise
- isMotion: true if this player has pre-snap motion, false otherwise

PLAYER ROLE COLORING (use these EXACT hex values based on player label):
OFFENSE:
- QB (Quarterback): ${colors.offense.qb}
- RB (Running Back): ${colors.offense.rb}
- Y (Slot receiver): ${colors.offense.slotY}
- TE (Tight End): ${colors.offense.te}
- Z (Split End): ${colors.offense.receiverZ}
- X (Flanker): ${colors.offense.receiverX}
- C, LG, RG, LT, RT (Linemen): ${colors.offense.default}

DEFENSE:
- DL, DE, DT (Defensive Line): ${colors.defense.lineman}
- LB (Linebacker): ${colors.defense.linebacker}
- DB, CB, SS, FS (Defensive Backs): ${colors.defense.secondary}

ROUTE COLOR MATCHING:
- Routes inherit the player's color by default
- Mark primary routes with: isPrimary: true

COORDINATE SYSTEM:
- Field dimensions: ${field.width} x ${field.height} pixels
- Line of Scrimmage (LOS): Y = ${field.losY} pixels
- Offense moves UP (lower Y values, toward 0)
- Center X: ${field.centerX} pixels
- Pixels per yard: ${field.pixelsPerYard}

OUTPUT FORMAT - Return valid JSON with this exact structure:
{
  "players": [
    {
      "id": "player-1",
      "label": "QB",
      "color": "#000000",
      "x": 347,
      "y": 300,
      "side": "offense"
    }
  ],
  "routes": [
    {
      "id": "route-1",
      "playerId": "player-1",
      "type": "straight" | "curved",
      "style": "solid",
      "color": "#000000",
      "points": [{"x": 347, "y": 300}, {"x": 347, "y": 200}, {"x": 400, "y": 150}],
      "isPrimary": false,
      "isMotion": false
    }
  ],
  "shapes": [
    {
      "id": "shape-1",
      "playerId": "player-1",
      "type": "oval",
      "x": 150,
      "y": 100,
      "width": 180,
      "height": 100,
      "color": "#9333ea"
    }
  ],
  "footballs": [
    {
      "id": "football-1",
      "x": ${field.centerX},
      "y": ${field.losY}
    }
  ],
  "playType": "offense",
  "mechanics": {
    "hasPlayAction": false,
    "preSnapMotion": false,
    "hasRPO": false,
    "hasJetSweep": false
  },
  "detectedFormation": "5v5" | "7v7" | "9v9" | "11v11"
}

IMPORTANT RULES:
1. ALWAYS snap players to formation coordinates - never use image pixel positions
2. Routes must start from the player's snapped position
3. Route points should create smooth paths matching the drawn route shape
4. Include at least 2 points per route (start and end)
5. If the drawing is unclear, default to the closest standard route pattern
6. Only return the JSON object, no markdown or explanation
7. If you see ANY oval or zone shapes in the image, you MUST include them in the shapes array
8. Shape IDs should be unique (shape-1, shape-2, etc.) and reference valid playerIds
9. If no shapes are visible in the image, include an empty shapes array: "shapes": []`;
};

const generateSystemPrompt = () => {
  const { field, colors, labels, positions, logicRules, routeTypes, formationTemplates } = FOOTBALL_CONFIG;
  
  return `You are an expert football play designer AI. You generate football plays in a specific JSON format for a web-based play designer application.

STRICT APPLICATION CONFIGURATION (You MUST use these exact values):
${JSON.stringify(FOOTBALL_CONFIG, null, 2)}

COORDINATE SYSTEM:
- Field dimensions: ${field.width} x ${field.height} pixels
- Line of Scrimmage (LOS): Y = ${field.losY} pixels
- Pixels per yard: ${field.pixelsPerYard}
- Offense moves UP (lower Y values toward 0)
- Defense moves DOWN (higher Y values) or waits above LOS
- Field center X: ${Math.floor(field.width / 2)} pixels
- Valid X range: ${field.fieldLeft} to ${field.fieldRight} pixels
- Valid Y range for offense: 72 to 368 pixels
- Valid Y range for defense: 12 to 320 pixels

PLAYER COLOR CODES (use these EXACT hex values):
OFFENSE:
- QB (Quarterback): ${colors.offense.qb} (black)
- RB (Running Back): ${colors.offense.rb} (neon green)
- WR/Slot Y: ${colors.offense.slotY} (yellow)
- TE (Tight End): ${colors.offense.te} (orange)
- WR Z (Split End): ${colors.offense.receiverZ} (blue)
- WR X (Flanker): ${colors.offense.receiverX} (red)

DEFENSE:
- DL (Defensive Line): ${colors.defense.lineman} (pink)
- LB (Linebacker): ${colors.defense.linebacker} (light blue)
- DB (Defensive Back): ${colors.defense.secondary} (purple)

ROUTE COLORS:
- Primary/Blitz routes: ${colors.routes.primary} (red)
- Man coverage: ${colors.routes.man} (gray)

LABEL MAPPINGS:
- Offense colors to labels: ${JSON.stringify(labels.offense)}
- Defense colors to labels: ${JSON.stringify(labels.defense)}

ROUTE TYPES: ${JSON.stringify(routeTypes)}

ROUTE STYLES:
- "solid": Standard route
- "dashed": Optional/check-down route

FORMATION KNOWLEDGE:
- Offense: ${JSON.stringify(formationTemplates.offense)}
- Defense: ${JSON.stringify(formationTemplates.defense)}

EXACT FORMATION COORDINATES (CRITICAL - YOU MUST USE THESE EXACT POSITIONS):
When the user specifies a game format (5v5, 5-on-5, 7v7, 7-on-7, 9v9, 9-on-9, 11v11, 11-on-11, or any variation),
you MUST use the EXACT player coordinates from this configuration. DO NOT invent new player positions.
Your job is to generate ROUTES for these specific players, not to reposition them.

${JSON.stringify(getFormationsForAI(), null, 2)}

FORMATION SIZE ALIASES (map these to the formations above):
- "5v5", "5-on-5", "flag", "flag football", "5 man" → Use formations["5v5"]
- "7v7", "7-on-7", "7 man" → Use formations["7v7"]
- "9v9", "9-on-9", "9 man" → Use formations["9v9"]
- "11v11", "11-on-11", "full team", "varsity", "11 man" → Use formations["11v11"]

When a formation size is specified:
1. Copy the EXACT players array from the appropriate formation above
2. Use the EXACT x, y, color, and label values - do NOT modify positions
3. Generate routes that start from each player's exact position
4. Add routes based on the play concept requested (slants, corners, etc.)

LOGIC RULES (recognize these triggers in prompts):
${Object.entries(logicRules).map(([key, rule]) => 
  `- ${key.toUpperCase()}: triggers=${JSON.stringify(rule.triggers)}, ${rule.description}`
).join('\n')}

FOOTBALL STRATEGY DICTIONARY (Use this to interpret user prompts):

OFFENSIVE FORMATIONS:
${Object.entries(LOGIC_DICTIONARY.offense.formations).map(([name, data]) => 
  `- "${name}": ${data.rule}`
).join('\n')}

ROUTE TREE (how to draw specific route patterns):
${Object.entries(LOGIC_DICTIONARY.offense.routeTree).map(([name, data]) => 
  `- "${name}" (${data.style}, ${data.depth}): ${data.rule}`
).join('\n')}

OFFENSIVE CONCEPTS:
${Object.entries(LOGIC_DICTIONARY.offense.concepts).map(([name, data]) => 
  `- "${name}": ${data.rule} Routes: ${data.routes.join(', ')}`
).join('\n')}

DEFENSIVE FORMATIONS:
${Object.entries(LOGIC_DICTIONARY.defense.formations).map(([name, data]) => 
  `- "${name}": ${data.rule}`
).join('\n')}

DEFENSIVE ASSIGNMENTS:
${Object.entries(LOGIC_DICTIONARY.defense.assignments).map(([name, data]) => 
  `- "${name}" (${data.style}): ${data.rule}`
).join('\n')}

ZONE COVERAGE SHAPES (for defensive plays with zone coverage):
When generating ZONE defenses (Cover 2, Cover 3, Cover 4, Cover 5, Tampa 2, etc.), you MUST include oval shapes to show coverage zones:
- Each defensive player in zone coverage should have an associated oval shape showing their zone responsibility
- DB/Safety zones (deep coverage): Use color #9333ea (purple), larger ovals (width ~200-230px, height ~100-110px)
- LB zones (underneath/hook coverage): Use color #87CEEB (light blue), medium ovals (width ~170-190px, height ~95-105px)
- Position zones ABOVE the player (lower Y values) since defense faces the offense
- Zone shapes help coaches visualize coverage responsibilities

GAME MECHANICS (set these flags in your response when detected):
${Object.entries(LOGIC_DICTIONARY.mechanics).map(([name, data]) => 
  `- "${name}": flag="${data.flag}" - ${data.rule}`
).join('\n')}

KEYWORD TRIGGERS TO RECOGNIZE:
- Formation keywords: ${LOGIC_DICTIONARY.keywords.formationTriggers.join(', ')}
- Route keywords: ${LOGIC_DICTIONARY.keywords.routeTriggers.join(', ')}
- Defense keywords: ${LOGIC_DICTIONARY.keywords.defenseTriggers.join(', ')}
- Mechanic keywords: ${LOGIC_DICTIONARY.keywords.mechanicTriggers.join(', ')}

OUTPUT FORMAT - You MUST return valid JSON with this exact structure:
{
  "players": [
    {
      "id": "player-1",
      "label": "QB",
      "color": "${colors.offense.qb}",
      "x": ${Math.floor(field.width / 2)},
      "y": ${field.losY + field.pixelsPerYard},
      "side": "offense"
    }
  ],
  "routes": [
    {
      "id": "route-1",
      "playerId": "player-1",
      "type": "curved",
      "style": "solid",
      "color": "${colors.offense.qb}",
      "points": [{"x": 347, "y": 312}, {"x": 347, "y": 200}, {"x": 400, "y": 150}]
    }
  ],
  "shapes": [
    {
      "id": "shape-1",
      "playerId": "player-1",
      "type": "oval",
      "x": 150,
      "y": 100,
      "width": 180,
      "height": 100,
      "color": "#9333ea"
    }
  ],
  "footballs": [
    {
      "id": "football-1",
      "x": ${Math.floor(field.width / 2)},
      "y": ${field.losY}
    }
  ],
  "playType": "offense",
  "mechanics": {
    "hasPlayAction": false,
    "preSnapMotion": false,
    "hasRPO": false,
    "hasJetSweep": false
  }
}

MECHANICS FLAGS (include in response when user prompt contains these concepts):
- Set "hasPlayAction": true when prompt mentions "play action", "play-action", "PA", or "fake handoff"
- Set "preSnapMotion": true when prompt mentions "motion", "jet motion", or player moving before snap
- Set "hasRPO": true when prompt mentions "RPO" or "run-pass option"
- Set "hasJetSweep": true when prompt mentions "jet sweep" or "jet" with motion

IMPORTANT RULES:
1. Always include at least 5 offensive players for a valid formation
2. QB should be near center X (around ${Math.floor(field.width / 2)}) and below LOS (Y > ${field.losY})
3. Routes should start from the player's position
4. Routes should have at least 2 points (start and end)
5. Use realistic football formations and route concepts
6. Player IDs should be unique (player-1, player-2, etc.)
7. Route IDs should be unique and reference valid playerIds
8. Only return the JSON object, no markdown or explanation
9. Use the EXACT color hex codes from the configuration above
10. Match player labels to their colors as defined in LABEL MAPPINGS
11. For ZONE defenses, ALWAYS include shapes array with oval zones for each zone defender
12. Shape IDs should be unique (shape-1, shape-2, etc.) and reference valid playerIds
13. If no shapes are needed (man coverage or offense), include an empty shapes array: "shapes": []`;
};

// Helper function to get few-shot examples from highly-rated generations
const getHighRatedExamples = async (): Promise<string> => {
  try {
    const examples = await db.select({
      prompt: aiGenerationLogs.prompt,
      previewJson: aiGenerationLogs.previewJson,
      rating: aiGenerationLogs.rating,
    })
    .from(aiGenerationLogs)
    .where(and(
      gt(aiGenerationLogs.rating, 3),
      sql`${aiGenerationLogs.previewJson} IS NOT NULL`
    ))
    .orderBy(desc(aiGenerationLogs.rating), desc(aiGenerationLogs.timestamp))
    .limit(3);

    if (examples.length === 0) {
      return "";
    }

    let fewShotSection = `\n\n=== FEW-SHOT EXAMPLES OF HIGH-QUALITY PLAYS ===
The following are examples of plays that received high ratings (4-5 stars) from coaches. 
Use these as references for the quality and structure expected:\n\n`;

    examples.forEach((ex, i) => {
      fewShotSection += `Example ${i + 1} (Rating: ${ex.rating}/5):\n`;
      if (ex.prompt) {
        fewShotSection += `User Request: "${ex.prompt}"\n`;
      }
      fewShotSection += `Generated Output: ${JSON.stringify(ex.previewJson, null, 2)}\n\n`;
    });

    return fewShotSection;
  } catch (error) {
    console.error("Failed to fetch few-shot examples:", error);
    return "";
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/football-play-designer", (_req, res) => {
    const htmlPath = path.resolve(process.cwd(), "client", "public", "football-play-designer.html");
    res.sendFile(htmlPath);
  });

  app.get("/football-playbook-maker", (_req, res) => {
    const htmlPath = path.resolve(process.cwd(), "client", "public", "football-playbook-maker.html");
    res.sendFile(htmlPath);
  });

  app.get("/football-play-library", (_req, res) => {
    const htmlPath = path.resolve(process.cwd(), "client", "public", "football-play-library.html");
    res.sendFile(htmlPath);
  });

  app.post("/api/generate-play", async (req, res) => {
    try {
      const { prompt, image, situation } = req.body;

      if (!prompt && !image) {
        return res.status(400).json({ error: "Prompt or image is required" });
      }
      
      // Build situational context if provided
      let situationalContext = "";
      if (situation) {
        situationalContext = `\n\nCONSTRAINT: Design this play specifically for a "${situation}" scenario. Optimize routes, timing, and player positioning for this field position.\n`;
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key not configured" });
      }

      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash",
        generationConfig: {
          responseMimeType: "application/json",
        },
      });

      // Get few-shot examples from highly-rated generations
      const fewShotExamples = await getHighRatedExamples();

      let result;

      if (image) {
        // Use vision-specific prompt for image analysis
        const visionPrompt = generateVisionSystemPrompt() + fewShotExamples + situationalContext;
        
        // Detect MIME type from base64 header
        let mimeType = "image/png";
        if (image.includes("image/jpeg")) {
          mimeType = "image/jpeg";
        } else if (image.includes("image/webp")) {
          mimeType = "image/webp";
        } else if (image.includes("image/gif")) {
          mimeType = "image/gif";
        }
        
        const imageData = {
          inlineData: {
            data: image.replace(/^data:image\/\w+;base64,/, ""),
            mimeType,
          },
        };

        // Build text prompt with any user-specified format
        let textPrompt = "Analyze this hand-drawn football play diagram. ";
        if (prompt) {
          // Check if user specified a format
          const formatMatch = prompt.match(/(\d+)v(\d+)|(\d+)-on-(\d+)|flag|tackle/i);
          if (formatMatch) {
            textPrompt += `The user specified this should be a ${prompt} play. Use the corresponding formation from the config. `;
          } else {
            textPrompt += prompt + " ";
          }
        } else {
          textPrompt += "Auto-detect the formation size by counting the number of players drawn. ";
        }
        textPrompt += "Convert the drawing to the exact JSON format specified, snapping all players to formation coordinates and interpreting the drawn routes.";
        
        result = await model.generateContent([
          { text: visionPrompt },
          { text: textPrompt },
          imageData,
        ]);
      } else {
        // Use standard prompt for text-only generation with few-shot examples
        const systemPrompt = generateSystemPrompt() + fewShotExamples + situationalContext;
        result = await model.generateContent([
          { text: systemPrompt },
          { text: prompt },
        ]);
      }

      const response = result.response;
      const text = response.text();

      let playData;
      try {
        playData = JSON.parse(text);
      } catch (parseError) {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          playData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("Invalid JSON response from AI");
        }
      }

      if (!playData.players || !Array.isArray(playData.players)) {
        throw new Error("Response missing players array");
      }
      if (!playData.routes || !Array.isArray(playData.routes)) {
        playData.routes = [];
      }

      const ts = Date.now();
      
      const playerIdMap: Record<string, string> = {};
      playData.players = playData.players.map((p: any, i: number) => {
        const newId = `player-${ts}-${i}`;
        playerIdMap[p.id] = newId;
        return {
          ...p,
          id: newId,
          side: p.side || "offense",
        };
      });
      
      // Get player side lookup for motion validation (using NEW player IDs after remap)
      const playerSideLookup: Record<string, string> = {};
      playData.players.forEach((p: any) => {
        playerSideLookup[p.id] = p.side || "offense";
      });
      
      // Also create lookup with original IDs for route mapping
      const originalPlayerSideLookup: Record<string, string> = {};
      Object.entries(playerIdMap).forEach(([oldId, newId]) => {
        const player = playData.players.find((p: any) => p.id === newId);
        if (player) {
          originalPlayerSideLookup[oldId] = player.side || "offense";
        }
      });
      
      playData.routes = playData.routes.map((r: any, i: number) => {
        const newPlayerId = playerIdMap[r.playerId] || r.playerId;
        const playerSide = playerSideLookup[newPlayerId];
        
        // Infer motion from route geometry if not explicitly set (offense only)
        let inferredMotion = r.isMotion || false;
        if (!inferredMotion && playerSide === "offense" && r.points && r.points.length >= 2) {
          // Check if route starts with a horizontal segment (motion indicator)
          const firstPoint = r.points[0];
          const secondPoint = r.points[1];
          if (firstPoint && secondPoint) {
            const dx = Math.abs(secondPoint.x - firstPoint.x);
            const dy = Math.abs(secondPoint.y - firstPoint.y);
            // If horizontal movement is significantly greater than vertical at start, it's likely motion
            if (dx > 40 && dy < 20) {
              inferredMotion = true;
            }
          }
        }
        
        // Ensure motion is only for offense
        if (playerSide === "defense") {
          inferredMotion = false;
        }
        
        return {
          ...r,
          id: `route-${ts}-${i}`,
          playerId: newPlayerId,
          isPrimary: r.isPrimary || false,
          isMotion: inferredMotion,
        };
      });
      
      // If any route has isMotion, set the preSnapMotion mechanic
      const hasMotionRoutes = playData.routes.some((r: any) => r.isMotion);
      if (hasMotionRoutes) {
        playData.mechanics = playData.mechanics || {};
        playData.mechanics.preSnapMotion = true;
      }

      // Handle shapes (zone coverage ovals for defensive plays)
      // Remap playerId references to new player IDs
      if (playData.shapes && Array.isArray(playData.shapes)) {
        playData.shapes = playData.shapes.map((s: any, i: number) => ({
          ...s,
          id: `shape-${ts}-${i}`,
          playerId: playerIdMap[s.playerId] || s.playerId,
        }));
      } else {
        // Ensure shapes array exists (even if empty)
        playData.shapes = [];
      }

      // Log the successful generation to database with preview data
      try {
        await db.insert(aiGenerationLogs).values({
          prompt: prompt || null,
          hasImage: !!image,
          uploadedImage: image || null,
          status: "success",
          previewJson: playData,
        });
      } catch (logError: any) {
        console.error("Failed to log AI generation:", logError);
        console.error("Log error details:", logError?.message, logError?.code);
        // Add to response so admin knows logging failed
        playData._loggingFailed = true;
        playData._loggingError = logError?.message || "Unknown logging error";
      }

      res.json(playData);
    } catch (error: any) {
      console.error("Generate play error:", error);
      
      // Log the failed generation to database
      try {
        await db.insert(aiGenerationLogs).values({
          prompt: req.body.prompt || null,
          hasImage: !!req.body.image,
          uploadedImage: req.body.image || null,
          status: "error",
        });
      } catch (logError) {
        console.error("Failed to log AI generation error:", logError);
      }
      
      res.status(500).json({ 
        error: error.message || "Failed to generate play",
        details: error.toString()
      });
    }
  });

  // Auth middleware
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    next();
  };

  // Authentication Routes
  
  // Register new user
  app.post("/api/register", async (req, res) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.flatten() });
      }

      const { email, password, firstName, favoriteNFLTeam } = result.data;

      // Check if user already exists
      const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existingUser.length > 0) {
        return res.status(409).json({ error: "Email already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const [newUser] = await db.insert(users).values({
        email,
        password: hashedPassword,
        firstName: firstName || null,
        favoriteNFLTeam: favoriteNFLTeam || null,
      }).returning();

      // Set session
      req.session.userId = newUser.id;

      // Send welcome email (fire and forget - don't block registration)
      sendWelcomeEmail(email, firstName).catch((emailError) => {
        console.error("Failed to send welcome email:", emailError);
      });

      // Trigger n8n personalized outreach (fires 24hr later via n8n delay)
      fetch("https://raycarroll.app.n8n.cloud/webhook/rc-football-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName || "",
          email,
          favoriteNflTeam: favoriteNFLTeam || "",
        }),
      }).catch((webhookError) => {
        console.error("n8n welcome outreach webhook failed:", webhookError);
      });

      res.status(201).json({ 
        success: true, 
        user: { 
          id: newUser.id, 
          email: newUser.email,
          firstName: newUser.firstName,
          favoriteNFLTeam: newUser.favoriteNFLTeam
        } 
      });
    } catch (error: any) {
      console.error("Register error:", error);
      res.status(500).json({ error: error.message || "Registration failed" });
    }
  });

  // Login user
  app.post("/api/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      // Find user
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Capture client IP (handle Replit's proxy)
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;

      // Update lastLoginAt and lastLoginIp
      await db.update(users).set({
        lastLoginAt: new Date(),
        lastLoginIp: clientIp,
      }).where(eq(users.id, user.id));

      // Set session
      req.session.userId = user.id;

      res.json({ 
        success: true, 
        user: { id: user.id, email: user.email } 
      });
    } catch (error: any) {
      console.error("Login error:", error);
      
      // Handle database connection errors with user-friendly message
      if (error.code === 'EAI_AGAIN' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return res.status(503).json({ error: "Service temporarily unavailable. Please try again in a moment." });
      }
      if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
        return res.status(503).json({ error: "Connection timed out. Please try again." });
      }
      
      res.status(500).json({ error: "Login failed. Please try again." });
    }
  });

  // Logout user
  app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  // Feature request submission (no auth required)
  app.post("/api/feature-requests", async (req, res) => {
    try {
      // Honeypot check - if "website" field has any value, silently reject
      if (req.body.website && req.body.website.trim() !== "") {
        // Bot detected - return success to not tip off bots, but don't store or email
        return res.status(201).json({ success: true });
      }

      const { userType, featureDescription, useCase } = req.body;

      // Validate with schema
      const validUserTypes = ["Football Parent", "Amateur Coach", "Professional Coach"];
      if (!userType || typeof userType !== "string" || !validUserTypes.includes(userType)) {
        return res.status(400).json({ error: "Invalid user type" });
      }
      if (!featureDescription || typeof featureDescription !== "string" || featureDescription.trim().length === 0) {
        return res.status(400).json({ error: "Feature description is required" });
      }
      if (!useCase || typeof useCase !== "string" || useCase.trim().length === 0) {
        return res.status(400).json({ error: "Use case is required" });
      }

      // Limit field lengths to prevent abuse
      const maxLength = 5000;
      if (featureDescription.length > maxLength || useCase.length > maxLength) {
        return res.status(400).json({ error: "Content too long" });
      }

      // Get userId if user is logged in (optional)
      const userId = req.session?.userId || null;

      // Store in database with sanitized values
      await db.insert(featureRequests).values({
        userType: userType.trim(),
        featureDescription: featureDescription.trim(),
        useCase: useCase.trim(),
        userId,
      });

      // Send email notification (fire and forget)
      sendFeatureRequestEmail({
        userType,
        featureDescription,
        useCase,
      }).catch((emailError) => {
        console.error("Failed to send feature request email:", emailError);
      });

      res.status(201).json({ success: true });
    } catch (error: any) {
      console.error("Feature request error:", error);
      res.status(500).json({ error: "Failed to submit feature request" });
    }
  });

  // Forgot password - request reset link
  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Find user by email
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      
      // Always return success to prevent email enumeration attacks
      if (!user) {
        return res.json({ success: true, message: "If an account with that email exists, a reset link has been sent." });
      }

      // Generate secure random token
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      // Store token in database
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token,
        expiresAt,
      });

      // Build reset link using trusted base URL
      // In production, use the configured APP_BASE_URL or Replit production URL
      // In development, use localhost/dev preview URL
      let baseUrl: string;
      if (process.env.NODE_ENV === "production") {
        // Use configured production URL or construct from Replit environment
        baseUrl = process.env.APP_BASE_URL || 
          (process.env.REPL_SLUG && process.env.REPL_OWNER 
            ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
            : "https://workspace.artvandelet2002.repl.co");
      } else {
        // Development: use request origin (safe since it's internal)
        baseUrl = `${req.protocol}://${req.get("host")}`;
      }
      const resetLink = `${baseUrl}/reset-password?token=${token}`;

      // Send email
      try {
        await sendPasswordResetEmail(email, resetLink);
        console.log(`Password reset email sent to ${email}`);
      } catch (emailError) {
        console.error("Failed to send password reset email:", emailError);
        // Don't expose email errors to prevent enumeration
      }

      res.json({ success: true, message: "If an account with that email exists, a reset link has been sent." });
    } catch (error: any) {
      console.error("Forgot password error:", error);
      res.status(500).json({ error: error.message || "Failed to process request" });
    }
  });

  // Reset password with token
  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ error: "Token and password are required" });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }

      // Find valid token
      const [resetToken] = await db.select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.token, token),
            eq(passwordResetTokens.used, false),
            gt(passwordResetTokens.expiresAt, new Date())
          )
        )
        .limit(1);

      if (!resetToken) {
        return res.status(400).json({ error: "Invalid or expired reset link. Please request a new one." });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update user's password
      await db.update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, resetToken.userId));

      // Mark token as used
      await db.update(passwordResetTokens)
        .set({ used: true })
        .where(eq(passwordResetTokens.id, resetToken.id));

      res.json({ success: true, message: "Password has been reset successfully. You can now log in." });
    } catch (error: any) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: error.message || "Failed to reset password" });
    }
  });

  // Validate reset token (for frontend to check if token is valid)
  app.get("/api/validate-reset-token", async (req, res) => {
    try {
      const token = req.query.token as string;

      if (!token) {
        return res.json({ valid: false });
      }

      const [resetToken] = await db.select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.token, token),
            eq(passwordResetTokens.used, false),
            gt(passwordResetTokens.expiresAt, new Date())
          )
        )
        .limit(1);

      res.json({ valid: !!resetToken });
    } catch (error: any) {
      console.error("Validate token error:", error);
      res.json({ valid: false });
    }
  });

  // Get current user
  app.get("/api/me", requireAuth, async (req, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.session.userId!)).limit(1);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ 
        id: user.id, 
        email: user.email, 
        firstName: user.firstName, 
        isAdmin: user.isAdmin,
        favoriteNFLTeam: user.favoriteNFLTeam,
        favoriteNFLCoach: user.favoriteNFLCoach,
        offensiveSchemePreference: user.offensiveSchemePreference,
        defensiveSchemePreference: user.defensiveSchemePreference,
        avatarUrl: user.avatarUrl
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update user profile
  app.patch("/api/user/profile", requireAuth, async (req, res) => {
    try {
      const profileUpdateSchema = z.object({
        favoriteNFLTeam: z.string().max(100).optional(),
        favoriteNFLCoach: z.string().max(100).optional(),
        offensiveSchemePreference: z.string().max(100).optional(),
        defensiveSchemePreference: z.string().max(100).optional(),
        avatarUrl: z.string().url().max(500).optional().or(z.literal("")),
      });
      
      const parseResult = profileUpdateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid input", details: parseResult.error.flatten() });
      }
      
      const { favoriteNFLTeam, favoriteNFLCoach, offensiveSchemePreference, defensiveSchemePreference, avatarUrl } = parseResult.data;
      
      const updateData: { 
        favoriteNFLTeam?: string; 
        favoriteNFLCoach?: string | null;
        offensiveSchemePreference?: string | null;
        defensiveSchemePreference?: string | null;
        avatarUrl?: string | null;
      } = {};
      
      if (favoriteNFLTeam !== undefined) {
        updateData.favoriteNFLTeam = favoriteNFLTeam;
      }
      if (favoriteNFLCoach !== undefined) {
        updateData.favoriteNFLCoach = favoriteNFLCoach || null;
      }
      if (offensiveSchemePreference !== undefined) {
        updateData.offensiveSchemePreference = offensiveSchemePreference || null;
      }
      if (defensiveSchemePreference !== undefined) {
        updateData.defensiveSchemePreference = defensiveSchemePreference || null;
      }
      if (avatarUrl !== undefined) {
        updateData.avatarUrl = avatarUrl || null;
      }
      
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }
      
      const [updatedUser] = await db.update(users)
        .set(updateData)
        .where(eq(users.id, req.session.userId!))
        .returning();
      
      res.json({ 
        id: updatedUser.id, 
        email: updatedUser.email, 
        firstName: updatedUser.firstName,
        isAdmin: updatedUser.isAdmin,
        favoriteNFLTeam: updatedUser.favoriteNFLTeam,
        avatarUrl: updatedUser.avatarUrl
      });
    } catch (error: any) {
      console.error("Update profile error:", error);
      res.status(500).json({ error: error.message || "Failed to update profile" });
    }
  });

  // Team Management Routes
  
  // Create team
  app.post("/api/teams", requireAuth, async (req, res) => {
    try {
      const result = insertTeamSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.flatten() });
      }

      const { name, year, coverImageUrl } = result.data;

      const [newTeam] = await db.insert(teams).values({
        ownerId: req.session.userId!,
        name,
        year,
        coverImageUrl,
      }).returning();

      res.status(201).json(newTeam);
    } catch (error: any) {
      console.error("Create team error:", error);
      res.status(500).json({ error: error.message || "Failed to create team" });
    }
  });

  // Get user's teams
  app.get("/api/teams", requireAuth, async (req, res) => {
    try {
      const userTeams = await db.select().from(teams).where(eq(teams.ownerId, req.session.userId!));
      res.json(userTeams);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update a team (owner or admin can update)
  app.patch("/api/teams/:id", requireAuth, async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);
      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      // Fetch the team to check ownership
      const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
      
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }

      // Check if user is owner or admin
      const [currentUser] = await db.select({ isAdmin: users.isAdmin })
        .from(users)
        .where(eq(users.id, req.session.userId!))
        .limit(1);

      const isOwner = team.ownerId === req.session.userId;
      const isAdmin = currentUser?.isAdmin === true;

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: "Access denied. Only the team owner or an admin can update this team." });
      }

      // Validate and extract update fields
      const { name, year, coverImageUrl } = req.body;
      const updateData: Partial<{ name: string; year: string; coverImageUrl: string | null }> = {};

      if (name !== undefined) {
        if (typeof name !== 'string' || name.trim().length === 0) {
          return res.status(400).json({ error: "Team name cannot be empty" });
        }
        updateData.name = name.trim();
      }

      if (year !== undefined) {
        if (typeof year !== 'string') {
          return res.status(400).json({ error: "Year must be a string" });
        }
        updateData.year = year;
      }

      if (coverImageUrl !== undefined) {
        updateData.coverImageUrl = coverImageUrl || null;
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      const [updatedTeam] = await db.update(teams)
        .set(updateData)
        .where(eq(teams.id, teamId))
        .returning();

      res.json(updatedTeam);
    } catch (error: any) {
      console.error("Update team error:", error);
      res.status(500).json({ error: error.message || "Failed to update team" });
    }
  });

  // Delete a team (owner or admin can delete)
  app.delete("/api/teams/:id", requireAuth, async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);
      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      // Fetch the team to check ownership
      const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
      
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }

      // Check if user is owner or admin
      const [currentUser] = await db.select({ isAdmin: users.isAdmin })
        .from(users)
        .where(eq(users.id, req.session.userId!))
        .limit(1);

      const isOwner = team.ownerId === req.session.userId;
      const isAdmin = currentUser?.isAdmin === true;

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: "Access denied. Only the team owner or an admin can delete this team." });
      }

      // Delete the team (plays associated with this team will have their teamId set to null due to foreign key behavior)
      await db.delete(teams).where(eq(teams.id, teamId));

      res.status(200).json({ message: "Team deleted successfully" });
    } catch (error: any) {
      console.error("Delete team error:", error);
      res.status(500).json({ error: error.message || "Failed to delete team" });
    }
  });

  // Play Management Routes

  // Save a play (requires authentication, teamId is optional)
  app.post("/api/plays", requireAuth, async (req, res) => {
    try {
      const result = insertPlaySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.flatten() });
      }

      const { name, type, concept, formation, personnel, situation, data, tags, isFavorite, teamId, isPublic, clonedFromId } = result.data;

      // If teamId is provided, verify it belongs to the current user
      if (teamId) {
        const [team] = await db.select().from(teams).where(
          and(
            eq(teams.id, teamId),
            eq(teams.ownerId, req.session.userId!)
          )
        ).limit(1);
        
        if (!team) {
          return res.status(403).json({ error: "Team not found or access denied" });
        }
      }

      // Only admins can create public plays
      let finalIsPublic = false;
      if (isPublic) {
        const [currentUser] = await db.select({ isAdmin: users.isAdmin })
          .from(users)
          .where(eq(users.id, req.session.userId!))
          .limit(1);
        
        if (currentUser?.isAdmin) {
          finalIsPublic = true;
        }
      }

      // Ensure data is a proper object (handle stringified JSON)
      let parsedData = data;
      if (typeof parsedData === "string") {
        try {
          parsedData = JSON.parse(parsedData);
        } catch {
          parsedData = {};
        }
      }
      if (parsedData === null || typeof parsedData !== "object") {
        parsedData = {};
      }

      // Ensure tags is a proper array (handle stringified JSON)
      let parsedTags: string[] | unknown = tags;
      if (typeof parsedTags === "string") {
        const tagString = parsedTags;
        try {
          parsedTags = JSON.parse(tagString);
        } catch {
          // Try splitting by comma as fallback for legacy data
          parsedTags = tagString.split(",").map((t: string) => t.trim()).filter(Boolean);
        }
      }
      if (!Array.isArray(parsedTags)) {
        parsedTags = [];
      }

      const [newPlay] = await db.insert(plays).values({
        userId: req.session.userId!,
        teamId: teamId || null,
        name,
        type,
        concept: concept || null,
        formation: formation || null,
        personnel: personnel || null,
        situation: situation || null,
        data: parsedData,
        tags: parsedTags.length > 0 ? parsedTags : null,
        isFavorite: isFavorite ?? false,
        isPublic: finalIsPublic,
        clonedFromId: clonedFromId || null,
      }).returning();

      res.status(201).json(newPlay);
    } catch (error: any) {
      console.error("Create play error:", error);
      res.status(500).json({ error: error.message || "Failed to save play" });
    }
  });

  // Get public templates (no auth required)
  // Disable browser caching to ensure users always see the latest Global Library plays
  app.get("/api/public/templates", async (req, res) => {
    try {
      const publicPlays = await db.select().from(plays).where(
        eq(plays.isPublic, true)
      ).orderBy(desc(plays.createdAt));

      // Prevent stale browser cache so newly added public plays appear after refresh
      res.set('Cache-Control', 'no-cache, must-revalidate');
      res.json(publicPlays);
    } catch (error: any) {
      console.error("Get public templates error:", error);
      res.status(500).json({ error: error.message || "Failed to get templates" });
    }
  });

  // Get user's plays (with optional teamId filter and archive filter)
  app.get("/api/plays", requireAuth, async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : null;
      const showArchived = req.query.archived === "true";

      let userPlays;
      if (showArchived) {
        // Show only archived plays
        userPlays = await db.select().from(plays).where(
          and(
            eq(plays.userId, req.session.userId!),
            eq(plays.isArchived, true)
          )
        ).orderBy(desc(plays.createdAt));
      } else if (teamId) {
        // Filter by both userId and teamId, exclude archived
        userPlays = await db.select().from(plays).where(
          and(
            eq(plays.userId, req.session.userId!),
            eq(plays.teamId, teamId),
            eq(plays.isArchived, false)
          )
        ).orderBy(desc(plays.createdAt));
      } else {
        // Return all non-archived plays for the user (excluding public plays they don't own)
        userPlays = await db.select().from(plays).where(
          and(
            eq(plays.userId, req.session.userId!),
            eq(plays.isPublic, false),
            eq(plays.isArchived, false)
          )
        ).orderBy(desc(plays.createdAt));
      }

      // Also fetch public plays (Global Templates) - separate from user's plays
      const publicPlays = await db.select().from(plays).where(
        eq(plays.isPublic, true)
      ).orderBy(desc(plays.createdAt));

      // Get archived count for sidebar
      const archivedPlays = await db.select().from(plays).where(
        and(
          eq(plays.userId, req.session.userId!),
          eq(plays.isArchived, true)
        )
      );

      res.json({ userPlays, publicPlays, archivedCount: archivedPlays.length });
    } catch (error: any) {
      console.error("Get plays error:", error);
      res.status(500).json({ error: error.message || "Failed to get plays" });
    }
  });

  // Get a single play by ID
  app.get("/api/plays/:id", requireAuth, async (req, res) => {
    try {
      const playId = parseInt(req.params.id);
      if (isNaN(playId)) {
        return res.status(400).json({ error: "Invalid play ID" });
      }

      const [play] = await db.select().from(plays).where(eq(plays.id, playId)).limit(1);
      
      if (!play) {
        return res.status(404).json({ error: "Play not found" });
      }

      // Check authorization: user owns the play OR play is public OR user is admin
      const [currentUser] = await db.select({ isAdmin: users.isAdmin })
        .from(users)
        .where(eq(users.id, req.session.userId!))
        .limit(1);

      const isOwner = play.userId === req.session.userId;
      const isAdmin = currentUser?.isAdmin === true;
      const isPublic = play.isPublic === true;

      if (!isOwner && !isPublic && !isAdmin) {
        return res.status(403).json({ error: "Not authorized to view this play" });
      }

      res.json(play);
    } catch (error: any) {
      console.error("Get single play error:", error);
      res.status(500).json({ error: error.message || "Failed to get play" });
    }
  });

  // Update a play (PATCH for partial updates)
  app.patch("/api/plays/:id", requireAuth, async (req, res) => {
    try {
      const playId = parseInt(req.params.id);
      if (isNaN(playId)) {
        return res.status(400).json({ error: "Invalid play ID" });
      }

      // First fetch the play to check ownership and public status
      const [existingPlay] = await db.select().from(plays).where(
        eq(plays.id, playId)
      ).limit(1);

      if (!existingPlay) {
        return res.status(404).json({ error: "Play not found" });
      }

      // Check authorization: owner, team owner (for review mode), or admin
      const [currentUser] = await db.select({ isAdmin: users.isAdmin })
        .from(users)
        .where(eq(users.id, req.session.userId!))
        .limit(1);
      
      const isOwner = existingPlay.userId === req.session.userId;
      const isAdmin = currentUser?.isAdmin === true;
      
      // Check if user is the team owner for plays associated with a team
      let isTeamOwner = false;
      if (existingPlay.teamId) {
        const [team] = await db.select({ ownerId: teams.ownerId })
          .from(teams)
          .where(eq(teams.id, existingPlay.teamId))
          .limit(1);
        isTeamOwner = team?.ownerId === req.session.userId;
      }
      
      // Security check for public plays - only admins can edit
      if (existingPlay.isPublic) {
        if (!isAdmin) {
          return res.status(403).json({ error: "Public plays can only be edited by admins. Clone this play to your library first." });
        }
      } else {
        // For non-public plays, verify ownership, team ownership, or admin status
        if (!isOwner && !isTeamOwner && !isAdmin) {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      // Build update object with only provided fields
      const updateData: Partial<{ isFavorite: boolean; tags: string[]; isPublic: boolean; concept: string; situation: string | null; data: unknown }> = {};
      
      // Team owners (who are not the play owner) can ONLY update the data field (notes editing in review mode)
      // This prevents privilege escalation where team owners could modify play metadata
      const isTeamOwnerOnly = isTeamOwner && !isOwner && !isAdmin;
      
      // Allow updating play data (for coach review mode - notes editing)
      // All authorized users (owner, team owner, admin) can update data
      if (req.body.data !== undefined) {
        updateData.data = req.body.data;
      }
      
      // Metadata fields: Only play owners and admins can update these
      if (!isTeamOwnerOnly) {
        if (typeof req.body.isFavorite === "boolean") {
          updateData.isFavorite = req.body.isFavorite;
        }
        if (Array.isArray(req.body.tags)) {
          updateData.tags = req.body.tags;
        }
        // Allow updating the play concept/category
        if (typeof req.body.concept === "string") {
          const validConcepts = ["run", "pass", "play-action", "rpo", "trick"];
          if (validConcepts.includes(req.body.concept)) {
            updateData.concept = req.body.concept;
          }
        }
        // Allow updating the play situation
        if (req.body.situation !== undefined) {
          // Validate against allowed situational tags (all possible values across formats)
          const validSituations = [
            'Open Field', 'Red Zone', 'Goal Line', '2pt Conversion',
            'High Red Zone', 'Low Red Zone',
            'Backed Up', 'Coming Out', 'Midfield', 'Plus Territory'
          ];
          if (req.body.situation === null || validSituations.includes(req.body.situation)) {
            updateData.situation = req.body.situation;
          }
        }
        // Allow admins to toggle isPublic
        if (typeof req.body.isPublic === "boolean" && isAdmin) {
          updateData.isPublic = req.body.isPublic;
        }
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      const [updatedPlay] = await db.update(plays)
        .set(updateData)
        .where(eq(plays.id, playId))
        .returning();

      res.json(updatedPlay);
    } catch (error: any) {
      console.error("Update play error:", error);
      res.status(500).json({ error: error.message || "Failed to update play" });
    }
  });

  // Delete a play (owner or admin can delete)
  app.delete("/api/plays/:id", requireAuth, async (req, res) => {
    try {
      const playId = parseInt(req.params.id);
      if (isNaN(playId)) {
        return res.status(400).json({ error: "Invalid play ID" });
      }

      // Fetch the play to check ownership
      const [play] = await db.select().from(plays).where(eq(plays.id, playId)).limit(1);
      
      if (!play) {
        return res.status(404).json({ error: "Play not found" });
      }

      // Check if user is owner or admin
      const [currentUser] = await db.select({ isAdmin: users.isAdmin })
        .from(users)
        .where(eq(users.id, req.session.userId!))
        .limit(1);

      const isOwner = play.userId === req.session.userId;
      const isAdmin = currentUser?.isAdmin === true;

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: "Access denied. Only the play owner or an admin can delete this play." });
      }

      // Delete the play
      await db.delete(plays).where(eq(plays.id, playId));

      res.status(200).json({ message: "Play deleted successfully" });
    } catch (error: any) {
      console.error("Delete play error:", error);
      res.status(500).json({ error: error.message || "Failed to delete play" });
    }
  });

  // Toggle archive status on a play (owner or admin can archive/unarchive)
  app.patch("/api/plays/:id/archive", requireAuth, async (req, res) => {
    try {
      const playId = parseInt(req.params.id);
      if (isNaN(playId)) {
        return res.status(400).json({ error: "Invalid play ID" });
      }

      // Fetch the play to check ownership
      const [play] = await db.select().from(plays).where(eq(plays.id, playId)).limit(1);
      
      if (!play) {
        return res.status(404).json({ error: "Play not found" });
      }

      // Check if user is owner or admin
      const [currentUser] = await db.select({ isAdmin: users.isAdmin })
        .from(users)
        .where(eq(users.id, req.session.userId!))
        .limit(1);

      const isOwner = play.userId === req.session.userId;
      const isAdmin = currentUser?.isAdmin === true;

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: "Access denied. Only the play owner or an admin can archive this play." });
      }

      // Toggle the archive status
      const newArchiveStatus = !play.isArchived;
      const [updatedPlay] = await db.update(plays)
        .set({ isArchived: newArchiveStatus })
        .where(eq(plays.id, playId))
        .returning();

      res.json({ 
        message: newArchiveStatus ? "Play archived" : "Play unarchived",
        play: updatedPlay 
      });
    } catch (error: any) {
      console.error("Archive play error:", error);
      res.status(500).json({ error: error.message || "Failed to archive play" });
    }
  });

  // Get teams a play is assigned to
  app.get("/api/plays/:id/teams", requireAuth, async (req, res) => {
    try {
      const playId = parseInt(req.params.id);
      if (isNaN(playId)) {
        return res.status(400).json({ error: "Invalid play ID" });
      }

      // Verify play exists and user owns it or is admin
      const [play] = await db.select().from(plays).where(eq(plays.id, playId)).limit(1);
      if (!play) {
        return res.status(404).json({ error: "Play not found" });
      }

      const [currentUser] = await db.select({ isAdmin: users.isAdmin })
        .from(users)
        .where(eq(users.id, req.session.userId!))
        .limit(1);

      const isOwner = play.userId === req.session.userId;
      const isAdmin = currentUser?.isAdmin === true;

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: "Not authorized to view this play's teams" });
      }

      const assignments = await db.select({ teamId: playTeams.teamId })
        .from(playTeams)
        .where(eq(playTeams.playId, playId));

      res.json(assignments.map(a => a.teamId));
    } catch (error: any) {
      console.error("Get play teams error:", error);
      res.status(500).json({ error: error.message || "Failed to get play teams" });
    }
  });

  // Assign play to a team
  app.post("/api/plays/:id/teams/:teamId", requireAuth, async (req, res) => {
    console.log("[Play-Team Assign] Starting - playId:", req.params.id, "teamId:", req.params.teamId, "userId:", req.session.userId);
    try {
      const playId = parseInt(req.params.id);
      const teamId = parseInt(req.params.teamId);
      
      if (isNaN(playId) || isNaN(teamId)) {
        console.log("[Play-Team Assign] Invalid IDs - playId:", playId, "teamId:", teamId);
        return res.status(400).json({ error: "Invalid play or team ID" });
      }

      // Verify play exists and user owns it or is admin
      const [play] = await db.select().from(plays).where(eq(plays.id, playId)).limit(1);
      if (!play) {
        return res.status(404).json({ error: "Play not found" });
      }

      const [currentUser] = await db.select({ isAdmin: users.isAdmin })
        .from(users)
        .where(eq(users.id, req.session.userId!))
        .limit(1);

      const isOwner = play.userId === req.session.userId;
      const isAdmin = currentUser?.isAdmin === true;

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: "Not authorized to modify this play" });
      }

      // Verify team exists and user owns it or is admin
      const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }
      if (team.ownerId !== req.session.userId && !isAdmin) {
        return res.status(403).json({ error: "Not authorized to add plays to this team" });
      }

      // Check if assignment already exists
      const [existing] = await db.select()
        .from(playTeams)
        .where(and(eq(playTeams.playId, playId), eq(playTeams.teamId, teamId)))
        .limit(1);

      if (existing) {
        return res.json({ message: "Play already assigned to team" });
      }

      // Create the assignment
      console.log("[Play-Team Assign] Inserting - playId:", playId, "teamId:", teamId);
      await db.insert(playTeams).values({ playId, teamId });
      console.log("[Play-Team Assign] Success - play", playId, "assigned to team", teamId);

      res.json({ message: "Play assigned to team" });
    } catch (error: any) {
      console.error("Assign play to team error:", error);
      res.status(500).json({ error: error.message || "Failed to assign play to team" });
    }
  });

  // Remove play from a team
  app.delete("/api/plays/:id/teams/:teamId", requireAuth, async (req, res) => {
    try {
      const playId = parseInt(req.params.id);
      const teamId = parseInt(req.params.teamId);
      
      if (isNaN(playId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid play or team ID" });
      }

      // Verify play exists and user owns it or is admin
      const [play] = await db.select().from(plays).where(eq(plays.id, playId)).limit(1);
      if (!play) {
        return res.status(404).json({ error: "Play not found" });
      }

      const [currentUser] = await db.select({ isAdmin: users.isAdmin })
        .from(users)
        .where(eq(users.id, req.session.userId!))
        .limit(1);

      const isOwner = play.userId === req.session.userId;
      const isAdmin = currentUser?.isAdmin === true;

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: "Not authorized to modify this play" });
      }

      // Delete the assignment
      await db.delete(playTeams)
        .where(and(eq(playTeams.playId, playId), eq(playTeams.teamId, teamId)));

      res.json({ message: "Play removed from team" });
    } catch (error: any) {
      console.error("Remove play from team error:", error);
      res.status(500).json({ error: error.message || "Failed to remove play from team" });
    }
  });

  // Admin API Routes
  
  // Check if current user is an admin (secure endpoint with debug info)
  app.get("/api/admin/check", async (req, res) => {
    try {
      console.log("[Admin Check] Session:", { 
        userId: req.session?.userId,
        hasSession: !!req.session 
      });
      
      if (!req.session?.userId) {
        return res.json({ isAdmin: false, reason: "no_session", userId: null });
      }
      
      const [user] = await db.select({ 
        id: users.id,
        email: users.email,
        isAdmin: users.isAdmin 
      })
        .from(users)
        .where(eq(users.id, req.session.userId))
        .limit(1);
      
      console.log("[Admin Check] User found:", user);
      
      res.json({ 
        isAdmin: user?.isAdmin === true,
        userId: user?.id,
        email: user?.email,
        isAdminRaw: user?.isAdmin,
        reason: user ? (user.isAdmin ? "is_admin" : "not_admin") : "user_not_found"
      });
    } catch (error: any) {
      console.error("Admin check failed:", error);
      res.json({ isAdmin: false, reason: "error", error: error.message });
    }
  });
  
  // Admin authentication middleware - requires session auth AND isAdmin flag
  // NOTE: Define middleware BEFORE routes that use it
  const verifyAdmin = async (req: Request, res: Response, next: NextFunction) => {
    // First check: user must be logged in with a valid session
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    try {
      // Second check: verify user has admin privileges in database
      const [user] = await db.select({ isAdmin: users.isAdmin })
        .from(users)
        .where(eq(users.id, req.session.userId))
        .limit(1);
      
      if (!user || !user.isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      next();
    } catch (error) {
      console.error("Admin verification failed:", error);
      return res.status(500).json({ error: "Authorization check failed" });
    }
  };

  // Get current logic dictionary (protected)
  app.get("/api/admin/config", verifyAdmin, async (_req, res) => {
    try {
      res.json({
        logicDictionary: customLogicDictionary || LOGIC_DICTIONARY,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Save logic dictionary (protected, in-memory only for now)
  app.post("/api/admin/config", verifyAdmin, async (req, res) => {
    try {
      const { logicDictionary } = req.body;
      if (!logicDictionary) {
        return res.status(400).json({ error: "logicDictionary is required" });
      }
      customLogicDictionary = logicDictionary;
      res.json({ success: true, message: "Logic dictionary updated (in-memory)" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get formation presets (protected)
  app.get("/api/admin/presets", verifyAdmin, async (_req, res) => {
    try {
      res.json(FORMATIONS);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get AI generation logs (protected)
  app.get("/api/admin/logs", verifyAdmin, async (_req, res) => {
    try {
      const logs = await db.select().from(aiGenerationLogs).orderBy(desc(aiGenerationLogs.timestamp)).limit(100);
      res.json(logs);
    } catch (error: any) {
      console.error("Failed to fetch logs:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update AI generation log feedback (protected)
  app.patch("/api/admin/logs/:id", verifyAdmin, async (req, res) => {
    try {
      const logId = parseInt(req.params.id);
      if (isNaN(logId)) {
        return res.status(400).json({ error: "Invalid log ID" });
      }

      const { rating, feedbackNotes, correctDiagram } = req.body;
      
      // Validate rating if provided
      if (rating !== undefined && (typeof rating !== 'number' || rating < 0 || rating > 5)) {
        return res.status(400).json({ error: "Rating must be a number between 0 and 5" });
      }

      const updateData: { rating?: number; feedbackNotes?: string; correctDiagram?: string | null } = {};
      if (rating !== undefined) updateData.rating = rating;
      if (feedbackNotes !== undefined) updateData.feedbackNotes = feedbackNotes;
      if (correctDiagram !== undefined) updateData.correctDiagram = correctDiagram;

      const [updatedLog] = await db.update(aiGenerationLogs)
        .set(updateData)
        .where(eq(aiGenerationLogs.id, logId))
        .returning();

      if (!updatedLog) {
        return res.status(404).json({ error: "Log not found" });
      }

      res.json(updatedLog);
    } catch (error: any) {
      console.error("Failed to update log:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Get all users for email management with pagination and sorting
  app.get("/api/admin/users", verifyAdmin, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const sortBy = (req.query.sortBy as string) || "createdAt";
      const sortOrder = (req.query.sortOrder as string) === "asc" ? "asc" : "desc";
      const offset = (page - 1) * limit;

      // Build sort column
      const sortColumns: Record<string, any> = {
        email: users.email,
        firstName: users.firstName,
        favoriteNFLTeam: users.favoriteNFLTeam,
        lastLoginIp: users.lastLoginIp,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      };
      const sortColumn = sortColumns[sortBy] || users.createdAt;

      // Get total count
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(users);
      const total = Number(count);
      const totalPages = Math.ceil(total / limit);

      // Get paginated users with sorting
      const allUsers = await db.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        favoriteNFLTeam: users.favoriteNFLTeam,
        isAdmin: users.isAdmin,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        lastLoginIp: users.lastLoginIp,
      }).from(users)
        .orderBy(sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn))
        .limit(limit)
        .offset(offset);

      res.json({
        users: allUsers,
        total,
        page,
        totalPages,
      });
    } catch (error: any) {
      console.error("Failed to fetch users:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Resend welcome email
  app.post("/api/admin/resend-welcome-email", verifyAdmin, async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Look up user to get their first name
      const [user] = await db.select({
        firstName: users.firstName,
        email: users.email,
      }).from(users).where(eq(users.email, email)).limit(1);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      await sendWelcomeEmail(user.email, user.firstName);
      
      res.json({ success: true, message: `Welcome email sent to ${email}` });
    } catch (error: any) {
      console.error("Failed to send welcome email:", error);
      res.status(500).json({ error: error.message || "Failed to send email" });
    }
  });

  // Admin: Reset user password directly
  app.post("/api/admin/reset-user-password", verifyAdmin, async (req, res) => {
    try {
      const { email, newPassword } = req.body;
      
      if (!email || !newPassword) {
        return res.status(400).json({ error: "Email and new password are required" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }

      // Find user
      const [user] = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await db.update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, user.id));

      res.json({ success: true, message: `Password reset successfully for ${email}` });
    } catch (error: any) {
      console.error("Admin reset password error:", error);
      res.status(500).json({ error: error.message || "Failed to reset password" });
    }
  });

  // Admin: Delete a play (public/global template plays)
  app.delete("/api/admin/plays/:id", verifyAdmin, async (req, res) => {
    try {
      const playId = parseInt(req.params.id);
      if (isNaN(playId)) {
        return res.status(400).json({ error: "Invalid play ID" });
      }

      // Find the play first
      const [existingPlay] = await db.select().from(plays).where(
        eq(plays.id, playId)
      ).limit(1);

      if (!existingPlay) {
        return res.status(404).json({ error: "Play not found" });
      }

      // Delete the play
      await db.delete(plays).where(eq(plays.id, playId));

      res.json({ success: true, message: `Play "${existingPlay.name}" deleted successfully` });
    } catch (error: any) {
      console.error("Admin delete play error:", error);
      res.status(500).json({ error: error.message || "Failed to delete play" });
    }
  });

  // Admin: Delete a play by name (useful for debugging/cleanup)
  app.delete("/api/admin/plays/by-name/:name", verifyAdmin, async (req, res) => {
    try {
      const playName = decodeURIComponent(req.params.name);
      
      // Find all plays with this name that are public
      const matchingPlays = await db.select().from(plays).where(
        and(
          eq(plays.name, playName),
          eq(plays.isPublic, true)
        )
      );

      if (matchingPlays.length === 0) {
        return res.status(404).json({ error: `No public play found with name "${playName}"` });
      }

      // Delete all matching plays
      await db.delete(plays).where(
        and(
          eq(plays.name, playName),
          eq(plays.isPublic, true)
        )
      );

      res.json({ 
        success: true, 
        message: `Deleted ${matchingPlays.length} play(s) named "${playName}"`,
        deletedCount: matchingPlays.length 
      });
    } catch (error: any) {
      console.error("Admin delete play by name error:", error);
      res.status(500).json({ error: error.message || "Failed to delete play" });
    }
  });

  // Admin: Get all plays with user info for management
  app.get("/api/admin/plays", verifyAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const allPlays = await db.select({
        id: plays.id,
        name: plays.name,
        type: plays.type,
        formation: plays.formation,
        isPublic: plays.isPublic,
        createdAt: plays.createdAt,
        userId: plays.userId,
        userEmail: users.email,
        userFirstName: users.firstName
      })
        .from(plays)
        .leftJoin(users, eq(plays.userId, users.id))
        .orderBy(desc(plays.createdAt))
        .limit(limit)
        .offset(offset);

      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(plays);

      res.json({
        plays: allPlays,
        pagination: {
          page,
          limit,
          total: Number(count),
          totalPages: Math.ceil(Number(count) / limit)
        }
      });
    } catch (error: any) {
      console.error("Admin get plays error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch plays" });
    }
  });

  // Admin: Toggle isPublic flag on a play
  app.patch("/api/admin/plays/:id/toggle-public", verifyAdmin, async (req, res) => {
    try {
      const playId = parseInt(req.params.id);
      if (isNaN(playId)) {
        return res.status(400).json({ error: "Invalid play ID" });
      }

      // Find the play first
      const [existingPlay] = await db.select().from(plays).where(
        eq(plays.id, playId)
      ).limit(1);

      if (!existingPlay) {
        return res.status(404).json({ error: "Play not found" });
      }

      // Toggle the isPublic flag
      const newIsPublic = !existingPlay.isPublic;
      await db.update(plays)
        .set({ isPublic: newIsPublic })
        .where(eq(plays.id, playId));

      res.json({ 
        success: true, 
        message: `Play "${existingPlay.name}" is now ${newIsPublic ? 'public' : 'private'}`,
        isPublic: newIsPublic
      });
    } catch (error: any) {
      console.error("Admin toggle play public error:", error);
      res.status(500).json({ error: error.message || "Failed to toggle play visibility" });
    }
  });

  // ==========================================
  // Google Drive Export Routes (All Users)
  // ==========================================
  
  // Check Google Drive connection status for current user
  app.get("/api/google-drive/status", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      const { isGoogleDriveConnected } = await import("./google-drive");
      const tokens = user?.googleDriveTokens as any;
      const connected = isGoogleDriveConnected(tokens);
      res.json({ connected });
    } catch (error: any) {
      console.error("Google Drive status check error:", error);
      res.json({ connected: false, error: error.message });
    }
  });
  
  // Diagnostic endpoint: show OAuth config (admin only)
  app.get("/api/debug/oauth-config", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user?.isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const { getResolvedRedirectUri } = await import("./google-drive");
      const uriInfo = getResolvedRedirectUri();
      
      res.json({
        redirectUri: uriInfo.redirectUri,
        resolvedDomain: uriInfo.domain,
        allDomains: uriInfo.allDomains,
        isProduction: uriInfo.isProduction,
        note: "This redirect URI MUST be registered in Google Cloud Console under OAuth 2.0 Client > Authorized redirect URIs"
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Start Google Drive OAuth flow
  app.get("/api/auth/google-drive/authorize", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      
      const { getAuthorizationUrl } = await import("./google-drive");
      const crypto = await import("crypto");
      
      const randomNonce = crypto.randomBytes(32).toString('hex');
      
      // Capture the domain the user is currently browsing on so we redirect back there
      const originDomain = req.headers.host || '';
      
      // Encode userId + nonce + origin into the state parameter using HMAC signing
      // This makes the callback independent of session cookies (fixes cross-domain issues)
      const secret = process.env.SESSION_SECRET || "fallback-secret-for-dev";
      const statePayload = JSON.stringify({ userId, nonce: randomNonce, ts: Date.now(), origin: originDomain });
      const stateB64 = Buffer.from(statePayload).toString('base64url');
      const hmac = crypto.createHmac('sha256', secret).update(stateB64).digest('base64url');
      const signedState = `${stateB64}.${hmac}`;
      
      // Also store in session as a backup verification
      (req.session as any).googleDriveOAuthState = randomNonce;
      
      const authUrl = getAuthorizationUrl(signedState);
      
      req.session.save((err) => {
        if (err) {
          console.error("Failed to save OAuth state to session:", err);
        }
        console.log('OAuth state saved for user:', userId, '| nonce:', randomNonce.substring(0, 8) + '...');
        res.json({ authUrl });
      });
    } catch (error: any) {
      console.error("Google Drive authorize error:", error);
      res.status(500).json({ error: error.message || "Failed to start authorization" });
    }
  });
  
  // Google Drive OAuth callback
  app.get("/api/auth/google-drive/callback", async (req, res) => {
    try {
      const { code, state, error: authError } = req.query;
      const crypto = await import("crypto");
      
      console.log('OAuth Callback Received:', { 
        code: code ? 'present' : 'missing', 
        state: state ? 'present' : 'missing', 
        error: authError,
        sessionUserId: req.session?.userId || 'none',
        cookies: req.headers.cookie ? 'present' : 'missing',
        host: req.headers.host
      });
      
      if (authError) {
        console.error('Google Drive callback: User denied access or auth error:', authError);
        return res.redirect('/playbooks?error=auth_denied');
      }
      
      if (!code || typeof code !== 'string') {
        console.error('Google Drive callback: Missing authorization code');
        return res.redirect('/playbooks?error=no_code');
      }
      
      if (!state || typeof state !== 'string') {
        console.error('Google Drive callback: Missing state parameter');
        return res.redirect('/playbooks?error=no_state');
      }
      
      // Verify signed state parameter (contains userId, independent of session cookies)
      const secret = process.env.SESSION_SECRET || "fallback-secret-for-dev";
      const parts = (state as string).split('.');
      if (parts.length !== 2) {
        console.error('Google Drive callback: Invalid state format');
        return res.redirect('/playbooks?error=state_mismatch');
      }
      
      const [stateB64, receivedHmac] = parts;
      const expectedHmac = crypto.createHmac('sha256', secret).update(stateB64).digest('base64url');
      
      const receivedBuf = Buffer.from(receivedHmac);
      const expectedBuf = Buffer.from(expectedHmac);
      if (receivedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(receivedBuf, expectedBuf)) {
        console.error('Google Drive callback: HMAC signature verification failed');
        return res.redirect('/playbooks?error=state_mismatch');
      }
      
      let stateData: { userId: string; nonce: string; ts: number; origin?: string };
      try {
        stateData = JSON.parse(Buffer.from(stateB64, 'base64url').toString());
      } catch {
        console.error('Google Drive callback: Could not parse state payload');
        return res.redirect('/playbooks?error=state_mismatch');
      }
      
      // Build redirect base URL using the original domain the user was browsing on
      // This ensures they go back to rc-football.com (not the .replit.app domain)
      // Validate against allowlist to prevent open redirect attacks
      const originDomain = stateData.origin;
      const allowedDomains = (process.env.REPLIT_DOMAINS?.split(',') || []).concat(['localhost:5000']);
      const isAllowed = originDomain && allowedDomains.some(d => originDomain === d || originDomain === `www.${d}`);
      const redirectBase = isAllowed ? `https://${originDomain}` : '';
      
      // Check state is not too old (max 10 minutes)
      const ageMs = Date.now() - stateData.ts;
      if (ageMs > 10 * 60 * 1000) {
        console.error('Google Drive callback: State expired', { ageMinutes: Math.round(ageMs / 60000) });
        return res.redirect(`${redirectBase}/playbooks?error=state_expired`);
      }
      
      const userId = stateData.userId;
      console.log('OAuth state verified for user:', userId, '| origin:', originDomain, '| session userId:', req.session?.userId || 'none');
      
      // Exchange code for tokens
      const { exchangeCodeForTokens } = await import("./google-drive");
      let tokens;
      try {
        tokens = await exchangeCodeForTokens(code);
      } catch (tokenError: any) {
        console.error('Google Drive callback: Token exchange failed:', tokenError.message);
        return res.redirect(`${redirectBase}/playbooks?error=token_exchange`);
      }
      console.log('Token exchange successful, saving to user:', userId);
      
      // Save tokens using the userId from the signed state (not from session)
      const storageResult = await db.update(users)
        .set({ googleDriveTokens: tokens })
        .where(eq(users.id, userId));
      console.log('Token storage result:', { rowsAffected: storageResult?.rowCount ?? 'unknown' });
      
      // If we have a valid session, clean up the OAuth state
      if (req.session?.userId) {
        delete (req.session as any).googleDriveOAuthState;
        req.session.save((err) => {
          if (err) console.error("Non-critical: session save after OAuth cleanup failed:", err);
        });
      }
      
      console.log('Google Drive connected successfully, redirecting to:', `${redirectBase}/playbooks`);
      res.redirect(`${redirectBase}/playbooks?success=true`);
    } catch (error: any) {
      console.error("Google Drive callback error:", error);
      res.redirect('/playbooks?error=unknown');
    }
  });
  
  // Disconnect Google Drive
  app.post("/api/google-drive/disconnect", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      
      await db.update(users)
        .set({ googleDriveTokens: null })
        .where(eq(users.id, userId));
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Google Drive disconnect error:", error);
      res.status(500).json({ error: error.message || "Failed to disconnect" });
    }
  });

  // Export team playbook to Google Drive (for team owner)
  app.post("/api/teams/:teamId/export-to-drive", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      
      // Fetch user with tokens
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const tokens = user?.googleDriveTokens as any;
      
      if (!tokens || !tokens.access_token) {
        return res.status(400).json({ error: "Google Drive not connected. Please connect your account first." });
      }
      
      const teamId = parseInt(req.params.teamId);
      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      const { generateDoc = true, generateSlides = true, orderedItems = [], playImages = {}, blankPageImages = {}, documentName, playsPerPage = 2, slidesPlaysPerPage = 1 } = req.body;

      // Validate at least one format is selected
      if (!generateDoc && !generateSlides) {
        return res.status(400).json({ error: "Please select at least one export format" });
      }

      // Get team info - verify user owns the team
      const [team] = await db.select().from(teams).where(
        and(eq(teams.id, teamId), eq(teams.ownerId, userId))
      ).limit(1);
      
      if (!team) {
        return res.status(404).json({ error: "Team not found or you don't have access" });
      }

      // Get plays assigned to this team
      const teamPlaysData = await db.select({
        play: plays,
      })
        .from(playTeams)
        .innerJoin(plays, eq(playTeams.playId, plays.id))
        .where(eq(playTeams.teamId, teamId));

      // Build play lookup map
      const playMap = new Map(teamPlaysData.map(({ play }) => [play.id, play]));

      // Build ordered items for export, preserving the order from frontend
      interface ExportItem {
        itemType: 'play' | 'blankPage';
        id: number;
        name: string;
        type?: string;
        concept?: string | null;
        formation?: string | null;
        notes?: string | null;
        imageBase64?: string;
        imageWidth?: number;
        imageHeight?: number;
        // For roster/splits pages
        pageType?: 'blank' | 'roster' | 'splits';
        fullPage?: boolean;
      }

      const itemsForExport: ExportItem[] = [];
      let playCount = 0;
      let blankPageCount = 0;

      for (const item of orderedItems) {
        if (item.type === 'play') {
          const play = playMap.get(item.id);
          if (play) {
            const imageData = playImages[play.id];
            let imageBase64: string | undefined;
            let imageWidth: number | undefined;
            let imageHeight: number | undefined;
            
            if (imageData) {
              if (typeof imageData === 'string') {
                imageBase64 = imageData;
              } else if (typeof imageData === 'object' && imageData.base64) {
                imageBase64 = imageData.base64;
                imageWidth = imageData.width;
                imageHeight = imageData.height;
              }
            }
            
            itemsForExport.push({
              itemType: 'play',
              id: play.id,
              name: play.name,
              type: play.type,
              concept: play.concept,
              formation: play.formation,
              imageBase64,
              imageWidth,
              imageHeight
            });
            playCount++;
          }
        } else if (item.type === 'blankPage') {
          // Blank page - include title and notes from the frontend
          // For roster/splits pages, attach the rendered image
          const pageType = item.pageType || 'blank';
          const isFullPage = item.fullPage === true;
          
          let imageBase64: string | undefined;
          let imageWidth: number | undefined;
          let imageHeight: number | undefined;
          
          // Get rendered image for roster/splits pages
          if (isFullPage && blankPageImages[item.id]) {
            const imageData = blankPageImages[item.id];
            if (typeof imageData === 'object' && imageData.base64) {
              imageBase64 = imageData.base64;
              imageWidth = imageData.width;
              imageHeight = imageData.height;
            }
          }
          
          itemsForExport.push({
            itemType: 'blankPage',
            id: item.id,
            name: item.title || 'Section Divider',
            notes: item.notes,
            pageType,
            fullPage: isFullPage,
            imageBase64,
            imageWidth,
            imageHeight
          });
          blankPageCount++;
        }
      }

      if (itemsForExport.length === 0) {
        return res.status(400).json({ error: "No valid items selected for export" });
      }

      // Log export stats
      const playsWithImages = itemsForExport.filter(i => i.itemType === 'play' && i.imageBase64);
      if (generateSlides && playsWithImages.length === 0 && playCount > 0) {
        console.warn("Slides export requested but no play images were provided");
      } else if (generateSlides && playCount > 0) {
        console.log(`${playsWithImages.length}/${playCount} plays have images for slides`);
      }

      // Callback to update tokens if refreshed
      const updateTokensCallback = async (newTokens: any) => {
        await db.update(users)
          .set({ googleDriveTokens: newTokens })
          .where(eq(users.id, userId));
      };

      // Export to Google Drive
      const { exportPlaybookToGoogleDrive } = await import("./google-drive");
      
      // Use custom document name or default to team name + year
      const customDocName = documentName?.trim() || undefined;
      console.log("Exporting to Google Drive:", { customDocName, teamName: team.name, playsCount: playCount, blankPagesCount: blankPageCount, generateDoc, generateSlides });
      
      const result = await exportPlaybookToGoogleDrive(
        tokens,
        {
          id: team.id,
          name: team.name,
          year: team.year || undefined,
          coverImageUrl: team.coverImageUrl
        },
        itemsForExport,
        { generateDoc, generateSlides, customDocName, playsPerPage, slidesPlaysPerPage },
        updateTokensCallback
      );

      res.json({
        success: true,
        docUrl: result.docUrl,
        slidesUrl: result.slidesUrl,
        errors: result.errors,
        playsExported: playCount,
        blankPagesExported: blankPageCount
      });
    } catch (error: any) {
      console.error("Export to Google Drive error:", error);
      
      // Check for invalid_grant error (expired/revoked refresh token)
      // Google APIs surface this in multiple formats
      const isInvalidGrant = 
        error?.response?.data?.error === 'invalid_grant' ||
        error?.response?.data?.error_description?.includes?.('invalid_grant') ||
        error?.errors?.[0]?.reason === 'invalid_grant' ||
        error?.errors?.[0]?.message?.includes?.('invalid_grant') ||
        error?.message?.includes('invalid_grant') ||
        error?.message?.includes('Token has been expired or revoked') ||
        error?.code === 'invalid_grant';
      
      if (isInvalidGrant && req.session.userId) {
        // Clear the user's tokens - they need to reconnect
        await db.update(users)
          .set({ googleDriveTokens: null })
          .where(eq(users.id, req.session.userId));
        
        return res.status(401).json({ 
          error: "Your Google Drive session has expired. Please disconnect and reconnect your account.",
          code: "SESSION_EXPIRED"
        });
      }
      
      res.status(500).json({ error: error.message || "Failed to export to Google Drive" });
    }
  });

  // Get plays for a team (for export modal)
  app.get("/api/teams/:teamId/plays-for-export", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const teamId = parseInt(req.params.teamId);
      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      // Get team info - verify user owns the team
      const [team] = await db.select().from(teams).where(
        and(eq(teams.id, teamId), eq(teams.ownerId, userId))
      ).limit(1);
      
      if (!team) {
        return res.status(404).json({ error: "Team not found or you don't have access" });
      }

      // Get plays assigned to this team, sorted by displayOrder
      const teamPlaysData = await db.select({
        id: plays.id,
        name: plays.name,
        type: plays.type,
        concept: plays.concept,
        formation: plays.formation,
        situation: plays.situation,
        data: plays.data,
        displayOrder: playTeams.displayOrder,
      })
        .from(playTeams)
        .innerJoin(plays, eq(playTeams.playId, plays.id))
        .where(eq(playTeams.teamId, teamId))
        .orderBy(asc(playTeams.displayOrder), asc(plays.name));

      // Get blank pages for this team
      const blankPagesData = await db.select()
        .from(teamBlankPages)
        .where(eq(teamBlankPages.teamId, teamId))
        .orderBy(asc(teamBlankPages.displayOrder));

      res.json({
        team: {
          id: team.id,
          name: team.name,
          year: team.year,
          coverImageUrl: team.coverImageUrl
        },
        plays: teamPlaysData,
        blankPages: blankPagesData
      });
    } catch (error: any) {
      console.error("Get plays for export error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch plays" });
    }
  });

  // Reorder plays within a team playbook
  app.post("/api/teams/:teamId/reorder-plays", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const teamId = parseInt(req.params.teamId);
      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      const { playOrder } = req.body;
      if (!Array.isArray(playOrder)) {
        return res.status(400).json({ error: "playOrder must be an array of play IDs" });
      }

      // Verify user owns the team
      const [team] = await db.select().from(teams).where(
        and(eq(teams.id, teamId), eq(teams.ownerId, userId))
      ).limit(1);
      
      if (!team) {
        return res.status(404).json({ error: "Team not found or you don't have access" });
      }

      // Verify all playIds belong to this team
      const existingPlayTeams = await db.select({ playId: playTeams.playId })
        .from(playTeams)
        .where(eq(playTeams.teamId, teamId));
      
      const validPlayIds = new Set(existingPlayTeams.map(pt => pt.playId));
      const invalidIds = playOrder.filter((id: number) => !validPlayIds.has(id));
      
      if (invalidIds.length > 0) {
        return res.status(400).json({ error: "Some play IDs do not belong to this team" });
      }

      // Update displayOrder for each play in a transaction-like manner
      for (let i = 0; i < playOrder.length; i++) {
        const playId = playOrder[i];
        await db.update(playTeams)
          .set({ displayOrder: i })
          .where(and(
            eq(playTeams.teamId, teamId),
            eq(playTeams.playId, playId)
          ));
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Reorder plays error:", error);
      res.status(500).json({ error: error.message || "Failed to reorder plays" });
    }
  });

  // Reorder plays and blank pages (combined items) within a team playbook
  app.post("/api/teams/:teamId/reorder-items", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const teamId = parseInt(req.params.teamId);
      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      const { itemOrder } = req.body;
      if (!Array.isArray(itemOrder)) {
        return res.status(400).json({ error: "itemOrder must be an array of { type, id } objects" });
      }

      // Verify user owns the team
      const [team] = await db.select().from(teams).where(
        and(eq(teams.id, teamId), eq(teams.ownerId, userId))
      ).limit(1);
      
      if (!team) {
        return res.status(404).json({ error: "Team not found or you don't have access" });
      }

      // Update displayOrder for each item
      for (let i = 0; i < itemOrder.length; i++) {
        const item = itemOrder[i];
        if (item.type === 'play') {
          await db.update(playTeams)
            .set({ displayOrder: i })
            .where(and(
              eq(playTeams.teamId, teamId),
              eq(playTeams.playId, item.id)
            ));
        } else if (item.type === 'blankPage') {
          await db.update(teamBlankPages)
            .set({ displayOrder: i })
            .where(and(
              eq(teamBlankPages.teamId, teamId),
              eq(teamBlankPages.id, item.id)
            ));
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Reorder items error:", error);
      res.status(500).json({ error: error.message || "Failed to reorder items" });
    }
  });

  // ================== TEAM ROSTER: COACHES ==================

  // Get all coaches for a team
  app.get("/api/teams/:teamId/coaches", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const teamId = parseInt(req.params.teamId);
      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      // Verify user owns the team
      const [team] = await db.select().from(teams).where(
        and(eq(teams.id, teamId), eq(teams.ownerId, userId))
      ).limit(1);
      
      if (!team) {
        return res.status(404).json({ error: "Team not found or you don't have access" });
      }

      const coaches = await db.select()
        .from(teamCoaches)
        .where(eq(teamCoaches.teamId, teamId))
        .orderBy(asc(teamCoaches.displayOrder), asc(teamCoaches.id));

      res.json(coaches);
    } catch (error: any) {
      console.error("Get coaches error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch coaches" });
    }
  });

  // Add a coach to a team
  app.post("/api/teams/:teamId/coaches", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const teamId = parseInt(req.params.teamId);
      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      // Verify user owns the team
      const [team] = await db.select().from(teams).where(
        and(eq(teams.id, teamId), eq(teams.ownerId, userId))
      ).limit(1);
      
      if (!team) {
        return res.status(404).json({ error: "Team not found or you don't have access" });
      }

      const { firstName, lastName, role, displayOrder } = req.body;
      if (!firstName || !lastName || !role) {
        return res.status(400).json({ error: "First name, last name, and role are required" });
      }

      const [coach] = await db.insert(teamCoaches).values({
        teamId,
        firstName,
        lastName,
        role,
        displayOrder: displayOrder ?? 0,
      }).returning();

      res.status(201).json(coach);
    } catch (error: any) {
      console.error("Add coach error:", error);
      res.status(500).json({ error: error.message || "Failed to add coach" });
    }
  });

  // Update a coach
  app.patch("/api/teams/:teamId/coaches/:coachId", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const teamId = parseInt(req.params.teamId);
      const coachId = parseInt(req.params.coachId);
      if (isNaN(teamId) || isNaN(coachId)) {
        return res.status(400).json({ error: "Invalid team or coach ID" });
      }

      // Verify user owns the team
      const [team] = await db.select().from(teams).where(
        and(eq(teams.id, teamId), eq(teams.ownerId, userId))
      ).limit(1);
      
      if (!team) {
        return res.status(404).json({ error: "Team not found or you don't have access" });
      }

      const { firstName, lastName, role, displayOrder } = req.body;
      const updates: any = {};
      if (firstName !== undefined) updates.firstName = firstName;
      if (lastName !== undefined) updates.lastName = lastName;
      if (role !== undefined) updates.role = role;
      if (displayOrder !== undefined) updates.displayOrder = displayOrder;

      const [coach] = await db.update(teamCoaches)
        .set(updates)
        .where(and(eq(teamCoaches.id, coachId), eq(teamCoaches.teamId, teamId)))
        .returning();

      if (!coach) {
        return res.status(404).json({ error: "Coach not found" });
      }

      res.json(coach);
    } catch (error: any) {
      console.error("Update coach error:", error);
      res.status(500).json({ error: error.message || "Failed to update coach" });
    }
  });

  // Delete a coach
  app.delete("/api/teams/:teamId/coaches/:coachId", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const teamId = parseInt(req.params.teamId);
      const coachId = parseInt(req.params.coachId);
      if (isNaN(teamId) || isNaN(coachId)) {
        return res.status(400).json({ error: "Invalid team or coach ID" });
      }

      // Verify user owns the team
      const [team] = await db.select().from(teams).where(
        and(eq(teams.id, teamId), eq(teams.ownerId, userId))
      ).limit(1);
      
      if (!team) {
        return res.status(404).json({ error: "Team not found or you don't have access" });
      }

      await db.delete(teamCoaches)
        .where(and(eq(teamCoaches.id, coachId), eq(teamCoaches.teamId, teamId)));

      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete coach error:", error);
      res.status(500).json({ error: error.message || "Failed to delete coach" });
    }
  });

  // ================== TEAM ROSTER: PLAYERS ==================

  // Get all players for a team
  app.get("/api/teams/:teamId/players", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const teamId = parseInt(req.params.teamId);
      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      // Verify user owns the team
      const [team] = await db.select().from(teams).where(
        and(eq(teams.id, teamId), eq(teams.ownerId, userId))
      ).limit(1);
      
      if (!team) {
        return res.status(404).json({ error: "Team not found or you don't have access" });
      }

      const players = await db.select()
        .from(teamPlayers)
        .where(eq(teamPlayers.teamId, teamId))
        .orderBy(asc(teamPlayers.displayOrder), asc(teamPlayers.id));

      res.json(players);
    } catch (error: any) {
      console.error("Get players error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch players" });
    }
  });

  // Add a player to a team
  app.post("/api/teams/:teamId/players", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const teamId = parseInt(req.params.teamId);
      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      // Verify user owns the team
      const [team] = await db.select().from(teams).where(
        and(eq(teams.id, teamId), eq(teams.ownerId, userId))
      ).limit(1);
      
      if (!team) {
        return res.status(404).json({ error: "Team not found or you don't have access" });
      }

      const { firstName, lastName, position1, position2, defPosition1, mainColor, displayOrder } = req.body;
      if (!firstName || !lastName) {
        return res.status(400).json({ error: "First name and last name are required" });
      }

      const [player] = await db.insert(teamPlayers).values({
        teamId,
        firstName,
        lastName,
        position1: position1 || null,
        position2: position2 || null,
        defPosition1: defPosition1 || null,
        mainColor: mainColor || null,
        displayOrder: displayOrder ?? 0,
      }).returning();

      res.status(201).json(player);
    } catch (error: any) {
      console.error("Add player error:", error);
      res.status(500).json({ error: error.message || "Failed to add player" });
    }
  });

  // Update a player
  app.patch("/api/teams/:teamId/players/:playerId", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const teamId = parseInt(req.params.teamId);
      const playerId = parseInt(req.params.playerId);
      if (isNaN(teamId) || isNaN(playerId)) {
        return res.status(400).json({ error: "Invalid team or player ID" });
      }

      // Verify user owns the team
      const [team] = await db.select().from(teams).where(
        and(eq(teams.id, teamId), eq(teams.ownerId, userId))
      ).limit(1);
      
      if (!team) {
        return res.status(404).json({ error: "Team not found or you don't have access" });
      }

      const { firstName, lastName, position1, position2, defPosition1, mainColor, displayOrder } = req.body;
      const updates: any = {};
      if (firstName !== undefined) updates.firstName = firstName;
      if (lastName !== undefined) updates.lastName = lastName;
      if (position1 !== undefined) updates.position1 = position1;
      if (position2 !== undefined) updates.position2 = position2;
      if (defPosition1 !== undefined) updates.defPosition1 = defPosition1;
      if (mainColor !== undefined) updates.mainColor = mainColor;
      if (displayOrder !== undefined) updates.displayOrder = displayOrder;

      const [player] = await db.update(teamPlayers)
        .set(updates)
        .where(and(eq(teamPlayers.id, playerId), eq(teamPlayers.teamId, teamId)))
        .returning();

      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }

      res.json(player);
    } catch (error: any) {
      console.error("Update player error:", error);
      res.status(500).json({ error: error.message || "Failed to update player" });
    }
  });

  // Delete a player
  app.delete("/api/teams/:teamId/players/:playerId", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const teamId = parseInt(req.params.teamId);
      const playerId = parseInt(req.params.playerId);
      if (isNaN(teamId) || isNaN(playerId)) {
        return res.status(400).json({ error: "Invalid team or player ID" });
      }

      // Verify user owns the team
      const [team] = await db.select().from(teams).where(
        and(eq(teams.id, teamId), eq(teams.ownerId, userId))
      ).limit(1);
      
      if (!team) {
        return res.status(404).json({ error: "Team not found or you don't have access" });
      }

      await db.delete(teamPlayers)
        .where(and(eq(teamPlayers.id, playerId), eq(teamPlayers.teamId, teamId)));

      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete player error:", error);
      res.status(500).json({ error: error.message || "Failed to delete player" });
    }
  });

  // Bulk import coaches and players (from CSV or AI-parsed data)
  app.post("/api/teams/:teamId/roster/import", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const teamId = parseInt(req.params.teamId);
      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      // Verify user owns the team
      const [team] = await db.select().from(teams).where(
        and(eq(teams.id, teamId), eq(teams.ownerId, userId))
      ).limit(1);
      
      if (!team) {
        return res.status(404).json({ error: "Team not found or you don't have access" });
      }

      const { coaches, players } = req.body;

      // Import coaches
      if (coaches && Array.isArray(coaches)) {
        for (let i = 0; i < coaches.length; i++) {
          const { firstName, lastName, role } = coaches[i];
          if (firstName && lastName && role) {
            await db.insert(teamCoaches).values({
              teamId,
              firstName,
              lastName,
              role,
              displayOrder: i,
            });
          }
        }
      }

      // Import players
      if (players && Array.isArray(players)) {
        for (let i = 0; i < players.length; i++) {
          const { firstName, lastName, position1, position2, defPosition1, mainColor } = players[i];
          if (firstName && lastName) {
            await db.insert(teamPlayers).values({
              teamId,
              firstName,
              lastName,
              position1: position1 || null,
              position2: position2 || null,
              defPosition1: defPosition1 || null,
              mainColor: mainColor || null,
              displayOrder: i,
            });
          }
        }
      }

      res.json({ success: true, message: "Roster imported successfully" });
    } catch (error: any) {
      console.error("Roster import error:", error);
      res.status(500).json({ error: error.message || "Failed to import roster" });
    }
  });

  // Parse roster from image using AI (Gemini Vision)
  app.post("/api/teams/:teamId/roster/parse-image", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const teamId = parseInt(req.params.teamId);
      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      // Verify user owns the team
      const [team] = await db.select().from(teams).where(
        and(eq(teams.id, teamId), eq(teams.ownerId, userId))
      ).limit(1);
      
      if (!team) {
        return res.status(404).json({ error: "Team not found or you don't have access" });
      }

      const { imageData } = req.body;
      if (!imageData) {
        return res.status(400).json({ error: "Image data is required" });
      }

      // Use Gemini to parse the image
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
      
      const prompt = `Analyze this image of a team roster or player list. Extract any coach and player information you can find.

Return a JSON object with this exact structure:
{
  "coaches": [
    { "firstName": "string", "lastName": "string", "role": "string" }
  ],
  "players": [
    { "firstName": "string", "lastName": "string", "position1": "string or null", "position2": "string or null", "mainColor": "string or null" }
  ]
}

For coach roles, use one of: "Head Coach", "Assistant Coach", "Offensive Coordinator", "Defensive Coordinator", "Special Teams", "Assistant"

For player positions, use standard football positions like: QB, RB, WR, TE, OL, DL, LB, DB, K, P, etc.

If you cannot determine a value, use null or omit it. Extract as much information as possible from the image.

Return ONLY the JSON object, no markdown formatting or explanation.`;

      // Parse base64 image data
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
      
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: "image/png",
            data: base64Data,
          },
        },
      ]);

      const responseText = result.response.text();
      
      // Try to parse the JSON response
      let parsedRoster;
      try {
        // Clean up the response text
        let cleanedResponse = responseText.trim();
        if (cleanedResponse.startsWith("```json")) {
          cleanedResponse = cleanedResponse.replace(/^```json\n?/, "").replace(/\n?```$/, "");
        } else if (cleanedResponse.startsWith("```")) {
          cleanedResponse = cleanedResponse.replace(/^```\n?/, "").replace(/\n?```$/, "");
        }
        parsedRoster = JSON.parse(cleanedResponse);
      } catch (e) {
        console.error("Failed to parse AI response:", responseText);
        return res.status(500).json({ error: "Failed to parse roster from image" });
      }

      res.json(parsedRoster);
    } catch (error: any) {
      console.error("Parse roster image error:", error);
      res.status(500).json({ error: error.message || "Failed to parse roster from image" });
    }
  });

  // ============ TEAM SPLITS (SQUAD ASSIGNMENTS) ROUTES ============

  // Get all splits for a team
  app.get("/api/teams/:teamId/splits", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const teamId = parseInt(req.params.teamId);
      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      // Verify user owns the team
      const [team] = await db.select().from(teams).where(
        and(eq(teams.id, teamId), eq(teams.ownerId, userId))
      ).limit(1);
      
      if (!team) {
        return res.status(404).json({ error: "Team not found or you don't have access" });
      }

      // Get splits with player info
      const splits = await db
        .select({
          id: teamSplits.id,
          teamId: teamSplits.teamId,
          playerId: teamSplits.playerId,
          squadName: teamSplits.squadName,
          displayOrder: teamSplits.displayOrder,
          createdAt: teamSplits.createdAt,
          player: {
            id: teamPlayers.id,
            firstName: teamPlayers.firstName,
            lastName: teamPlayers.lastName,
            position1: teamPlayers.position1,
            position2: teamPlayers.position2,
            defPosition1: teamPlayers.defPosition1,
            mainColor: teamPlayers.mainColor,
          }
        })
        .from(teamSplits)
        .innerJoin(teamPlayers, eq(teamSplits.playerId, teamPlayers.id))
        .where(eq(teamSplits.teamId, teamId))
        .orderBy(asc(teamSplits.squadName), asc(teamSplits.displayOrder));

      res.json(splits);
    } catch (error: any) {
      console.error("Get splits error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch splits" });
    }
  });

  // Add a player to a squad
  app.post("/api/teams/:teamId/splits", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const teamId = parseInt(req.params.teamId);
      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      const { playerId, squadName } = req.body;
      if (!playerId || !squadName) {
        return res.status(400).json({ error: "Player ID and squad name are required" });
      }

      if (!SQUAD_NAMES.includes(squadName)) {
        return res.status(400).json({ error: "Invalid squad name" });
      }

      // Verify user owns the team
      const [team] = await db.select().from(teams).where(
        and(eq(teams.id, teamId), eq(teams.ownerId, userId))
      ).limit(1);
      
      if (!team) {
        return res.status(404).json({ error: "Team not found or you don't have access" });
      }

      // Verify player belongs to this team
      const [player] = await db.select().from(teamPlayers).where(
        and(eq(teamPlayers.id, playerId), eq(teamPlayers.teamId, teamId))
      ).limit(1);

      if (!player) {
        return res.status(404).json({ error: "Player not found in this team" });
      }

      // Check if player is already in this squad
      const [existingSplit] = await db.select().from(teamSplits).where(
        and(eq(teamSplits.playerId, playerId), eq(teamSplits.squadName, squadName))
      ).limit(1);

      if (existingSplit) {
        return res.status(400).json({ error: "Player is already in this squad" });
      }

      // Check squad capacity (max 6 per squad)
      const squadCount = await db.select({ count: sql<number>`count(*)` })
        .from(teamSplits)
        .where(and(eq(teamSplits.teamId, teamId), eq(teamSplits.squadName, squadName)));
      
      if (squadCount[0]?.count >= 6) {
        return res.status(400).json({ error: "Squad is full (maximum 6 players)" });
      }

      // Get display order for new entry
      const displayOrder = squadCount[0]?.count || 0;

      const [split] = await db.insert(teamSplits).values({
        teamId,
        playerId,
        squadName,
        displayOrder,
      }).returning();

      res.json(split);
    } catch (error: any) {
      console.error("Add split error:", error);
      res.status(500).json({ error: error.message || "Failed to add player to squad" });
    }
  });

  // Remove a player from a squad
  app.delete("/api/teams/:teamId/splits/:splitId", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const teamId = parseInt(req.params.teamId);
      const splitId = parseInt(req.params.splitId);
      if (isNaN(teamId) || isNaN(splitId)) {
        return res.status(400).json({ error: "Invalid team or split ID" });
      }

      // Verify user owns the team
      const [team] = await db.select().from(teams).where(
        and(eq(teams.id, teamId), eq(teams.ownerId, userId))
      ).limit(1);
      
      if (!team) {
        return res.status(404).json({ error: "Team not found or you don't have access" });
      }

      await db.delete(teamSplits)
        .where(and(eq(teamSplits.id, splitId), eq(teamSplits.teamId, teamId)));

      res.json({ success: true });
    } catch (error: any) {
      console.error("Remove split error:", error);
      res.status(500).json({ error: error.message || "Failed to remove player from squad" });
    }
  });

  // ================== TEAM BLANK PAGES ==================

  // Get all blank pages for a team
  app.get("/api/teams/:teamId/blank-pages", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const teamId = parseInt(req.params.teamId);
      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      // Verify user owns the team
      const [team] = await db.select().from(teams).where(
        and(eq(teams.id, teamId), eq(teams.ownerId, userId))
      ).limit(1);
      
      if (!team) {
        return res.status(404).json({ error: "Team not found or you don't have access" });
      }

      const blankPages = await db.select().from(teamBlankPages)
        .where(eq(teamBlankPages.teamId, teamId))
        .orderBy(asc(teamBlankPages.displayOrder));

      res.json(blankPages);
    } catch (error: any) {
      console.error("Get blank pages error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch blank pages" });
    }
  });

  // Create a new page (blank, roster, or splits)
  app.post("/api/teams/:teamId/blank-pages", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const teamId = parseInt(req.params.teamId);
      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      // Verify user owns the team
      const [team] = await db.select().from(teams).where(
        and(eq(teams.id, teamId), eq(teams.ownerId, userId))
      ).limit(1);
      
      if (!team) {
        return res.status(404).json({ error: "Team not found or you don't have access" });
      }

      const { pageType = 'blank', pageData } = req.body;
      
      // Validate pageType
      if (!['blank', 'roster', 'splits'].includes(pageType)) {
        return res.status(400).json({ error: "Invalid page type. Must be 'blank', 'roster', or 'splits'" });
      }

      // Count existing pages of this type to create unique title
      const existingPages = await db.select({ count: sql<number>`count(*)` })
        .from(teamBlankPages)
        .where(and(
          eq(teamBlankPages.teamId, teamId),
          eq(teamBlankPages.pageType, pageType)
        ));
      
      const pageNumber = (existingPages[0]?.count || 0) + 1;
      
      // Create title based on page type
      let title: string;
      if (pageType === 'roster') {
        title = pageNumber === 1 ? 'Team Roster' : `Team Roster ${pageNumber}`;
      } else if (pageType === 'splits') {
        title = pageNumber === 1 ? 'Team Splits' : `Team Splits ${pageNumber}`;
      } else {
        title = `Blank Page ${pageNumber}`;
      }

      // Get max display order from both plays and blank pages
      const [maxPlayOrder] = await db.select({ maxOrder: sql<number>`COALESCE(MAX(display_order), 0)` })
        .from(playTeams)
        .where(eq(playTeams.teamId, teamId));
      
      const [maxBlankOrder] = await db.select({ maxOrder: sql<number>`COALESCE(MAX(display_order), 0)` })
        .from(teamBlankPages)
        .where(eq(teamBlankPages.teamId, teamId));
      
      const displayOrder = Math.max(maxPlayOrder?.maxOrder || 0, maxBlankOrder?.maxOrder || 0) + 1;

      // Initialize pageData for splits pages if not provided
      let initialPageData = pageData;
      if (pageType === 'splits' && !pageData) {
        initialPageData = {
          formations: [],
          situations: [],
          custom: []
        };
      }

      const [blankPage] = await db.insert(teamBlankPages).values({
        teamId,
        title,
        displayOrder,
        pageType,
        pageData: initialPageData,
      }).returning();

      res.json(blankPage);
    } catch (error: any) {
      console.error("Create page error:", error);
      res.status(500).json({ error: error.message || "Failed to create page" });
    }
  });

  // Update a page (blank, roster, or splits)
  app.patch("/api/teams/:teamId/blank-pages/:pageId", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const teamId = parseInt(req.params.teamId);
      const pageId = parseInt(req.params.pageId);
      if (isNaN(teamId) || isNaN(pageId)) {
        return res.status(400).json({ error: "Invalid team or page ID" });
      }

      // Verify user owns the team
      const [team] = await db.select().from(teams).where(
        and(eq(teams.id, teamId), eq(teams.ownerId, userId))
      ).limit(1);
      
      if (!team) {
        return res.status(404).json({ error: "Team not found or you don't have access" });
      }

      const { title, customContent, displayOrder, pageData } = req.body;
      const updateData: Partial<{ title: string; customContent: string | null; displayOrder: number; pageData: any }> = {};
      
      if (title !== undefined) updateData.title = title;
      if (customContent !== undefined) updateData.customContent = customContent;
      if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
      if (pageData !== undefined) updateData.pageData = pageData;

      const [updated] = await db.update(teamBlankPages)
        .set(updateData)
        .where(and(eq(teamBlankPages.id, pageId), eq(teamBlankPages.teamId, teamId)))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Page not found" });
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Update page error:", error);
      res.status(500).json({ error: error.message || "Failed to update page" });
    }
  });

  // Delete a blank page
  app.delete("/api/teams/:teamId/blank-pages/:pageId", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const teamId = parseInt(req.params.teamId);
      const pageId = parseInt(req.params.pageId);
      if (isNaN(teamId) || isNaN(pageId)) {
        return res.status(400).json({ error: "Invalid team or page ID" });
      }

      // Verify user owns the team
      const [team] = await db.select().from(teams).where(
        and(eq(teams.id, teamId), eq(teams.ownerId, userId))
      ).limit(1);
      
      if (!team) {
        return res.status(404).json({ error: "Team not found or you don't have access" });
      }

      await db.delete(teamBlankPages)
        .where(and(eq(teamBlankPages.id, pageId), eq(teamBlankPages.teamId, teamId)));

      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete blank page error:", error);
      res.status(500).json({ error: error.message || "Failed to delete blank page" });
    }
  });

  // ================== SINGLE PLAY GOOGLE DRIVE EXPORT ==================

  // Export a single play image to Google Drive
  app.post("/api/plays/export-single-to-drive", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { imageBase64, playName } = req.body;
      
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return res.status(400).json({ error: "imageBase64 is required" });
      }
      
      if (!playName || typeof playName !== 'string') {
        return res.status(400).json({ error: "playName is required" });
      }
      
      // Fetch user with tokens
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Check Google Drive connection
      const { isGoogleDriveConnected, uploadSinglePlayImage } = await import("./google-drive");
      
      if (!isGoogleDriveConnected(user.googleDriveTokens as any)) {
        return res.status(403).json({ 
          error: "Google Drive not connected", 
          code: "DRIVE_NOT_CONNECTED" 
        });
      }
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 10);
      const sanitizedName = playName.replace(/[^a-zA-Z0-9\s-]/g, '').slice(0, 50);
      const fileName = `${sanitizedName}_${timestamp}.png`;
      
      // Update tokens callback
      const updateTokens = async (newTokens: any) => {
        await db.update(users)
          .set({ googleDriveTokens: newTokens })
          .where(eq(users.id, userId));
      };
      
      // Upload to Google Drive
      const result = await uploadSinglePlayImage(
        user.googleDriveTokens as any,
        imageBase64,
        fileName,
        updateTokens
      );
      
      res.json({ 
        success: true, 
        fileUrl: result.fileUrl,
        fileId: result.fileId,
        fileName 
      });
    } catch (error: any) {
      console.error("Export single play to Drive error:", error);
      
      // Check for invalid_grant error (expired/revoked refresh token)
      // Google APIs surface this in multiple formats
      const isInvalidGrant = 
        error?.response?.data?.error === 'invalid_grant' ||
        error?.response?.data?.error_description?.includes?.('invalid_grant') ||
        error?.errors?.[0]?.reason === 'invalid_grant' ||
        error?.errors?.[0]?.message?.includes?.('invalid_grant') ||
        error?.message?.includes('invalid_grant') ||
        error?.message?.includes('Token has been expired or revoked') ||
        error?.code === 'invalid_grant';
      
      if (isInvalidGrant && req.session.userId) {
        // Clear the user's tokens - they need to reconnect
        await db.update(users)
          .set({ googleDriveTokens: null })
          .where(eq(users.id, req.session.userId));
        
        return res.status(401).json({ 
          error: "Your Google Drive session has expired. Please disconnect and reconnect your account.",
          code: "SESSION_EXPIRED"
        });
      }
      
      res.status(500).json({ error: error.message || "Failed to export play to Google Drive" });
    }
  });

  // Return 404 for ghost sitemap URLs that crawlers probe by default
  const ghostSitemaps = [
    "/sitemap_index.xml", "/sitemap-index.xml", "/sitemaps.xml",
    "/sitemap1.xml", "/post-sitemap.xml", "/page-sitemap.xml",
    "/category-sitemap.xml", "/tag-sitemap.xml", "/news-sitemap.xml",
  ];
  ghostSitemaps.forEach((p) => {
    app.get(p, (_req, res) => res.status(404).send("Not found"));
  });

  const httpServer = createServer(app);

  return httpServer;
}
