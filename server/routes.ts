import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { FOOTBALL_CONFIG, FORMATIONS, resolveColorKey } from "../shared/football-config";
import { LOGIC_DICTIONARY } from "../shared/logic-dictionary";
import { db } from "./db";
import { aiGenerationLogs, users, teams, plays, passwordResetTokens, featureRequests, insertUserSchema, insertTeamSchema, insertPlaySchema, insertFeatureRequestSchema } from "@shared/schema";
import { desc, eq, and, gt, asc, sql, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendWelcomeEmail, sendPasswordResetEmail, sendFeatureRequestEmail } from "./resend";

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
6. Only return the JSON object, no markdown or explanation`;
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
10. Match player labels to their colors as defined in LABEL MAPPINGS`;
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
      res.json({ id: user.id, email: user.email, firstName: user.firstName, isAdmin: user.isAdmin });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
      let parsedTags = tags;
      if (typeof parsedTags === "string") {
        try {
          parsedTags = JSON.parse(parsedTags);
        } catch {
          // Try splitting by comma as fallback for legacy data
          parsedTags = parsedTags.split(",").map((t: string) => t.trim()).filter(Boolean);
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
  app.get("/api/public/templates", async (req, res) => {
    try {
      const publicPlays = await db.select().from(plays).where(
        eq(plays.isPublic, true)
      ).orderBy(desc(plays.createdAt));

      res.json(publicPlays);
    } catch (error: any) {
      console.error("Get public templates error:", error);
      res.status(500).json({ error: error.message || "Failed to get templates" });
    }
  });

  // Get user's plays (with optional teamId filter)
  app.get("/api/plays", requireAuth, async (req, res) => {
    try {
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : null;

      let userPlays;
      if (teamId) {
        // Filter by both userId and teamId
        userPlays = await db.select().from(plays).where(
          and(
            eq(plays.userId, req.session.userId!),
            eq(plays.teamId, teamId)
          )
        ).orderBy(desc(plays.createdAt));
      } else {
        // Return all plays for the user (excluding public plays they don't own)
        userPlays = await db.select().from(plays).where(
          and(
            eq(plays.userId, req.session.userId!),
            eq(plays.isPublic, false)
          )
        ).orderBy(desc(plays.createdAt));
      }

      // Also fetch public plays (Global Templates) - separate from user's plays
      const publicPlays = await db.select().from(plays).where(
        eq(plays.isPublic, true)
      ).orderBy(desc(plays.createdAt));

      res.json({ userPlays, publicPlays });
    } catch (error: any) {
      console.error("Get plays error:", error);
      res.status(500).json({ error: error.message || "Failed to get plays" });
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

      // Security check for public plays - only admins can edit
      if (existingPlay.isPublic) {
        const [currentUser] = await db.select({ isAdmin: users.isAdmin })
          .from(users)
          .where(eq(users.id, req.session.userId!))
          .limit(1);
        
        if (!currentUser?.isAdmin) {
          return res.status(403).json({ error: "Public plays can only be edited by admins. Clone this play to your library first." });
        }
      } else {
        // For non-public plays, verify ownership
        if (existingPlay.userId !== req.session.userId) {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      // Build update object with only provided fields
      const updateData: Partial<{ isFavorite: boolean; tags: string[]; isPublic: boolean; concept: string }> = {};
      
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
      // Allow admins to toggle isPublic
      if (typeof req.body.isPublic === "boolean") {
        // Double-check admin status for isPublic changes
        const [currentUser] = await db.select({ isAdmin: users.isAdmin })
          .from(users)
          .where(eq(users.id, req.session.userId!))
          .limit(1);
        
        if (currentUser?.isAdmin) {
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

  const httpServer = createServer(app);

  return httpServer;
}
