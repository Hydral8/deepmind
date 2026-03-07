import { NextRequest, NextResponse } from "next/server";
import { getGeminiClient } from "@/lib/gemini";
import { ExtractedAssets } from "@/lib/types";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

function getAssetKey(videoPath: string): string {
  return videoPath.replace(/^\//, "").replace(/\//g, "--").replace(/\.mp4$/, "");
}

function getCachePath(videoPath: string): string {
  return path.join(process.cwd(), "public", "assets", `${getAssetKey(videoPath)}.json`);
}

function extractFrame(videoAbsPath: string, timestamp: number, outputPath: string) {
  // Never use 0 - first frames are often black/fades
  const ts = Math.max(2, timestamp);
  try {
    execSync(
      `ffmpeg -y -ss ${ts} -i "${videoAbsPath}" -frames:v 1 -q:v 2 "${outputPath}" 2>/dev/null`,
      { timeout: 15000 }
    );
  } catch {
    // If exact timestamp fails, try 3s in as safe fallback
    try {
      execSync(
        `ffmpeg -y -ss 3 -i "${videoAbsPath}" -frames:v 1 -q:v 2 "${outputPath}" 2>/dev/null`,
        { timeout: 15000 }
      );
    } catch {
      // Give up silently
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { videoPath, showTitle, episodeTitle } = await req.json();

    if (!videoPath) {
      return NextResponse.json({ error: "videoPath required" }, { status: 400 });
    }

    // Check local cache first
    const cachePath = getCachePath(videoPath);
    if (fs.existsSync(cachePath)) {
      const cached = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
      return NextResponse.json({ assets: cached, cached: true });
    }

    const ai = getGeminiClient();
    const assetKey = getAssetKey(videoPath);

    // Resolve the video file from public directory
    const absolutePath = path.join(process.cwd(), "public", videoPath);
    if (!fs.existsSync(absolutePath)) {
      return NextResponse.json(
        { error: `Video not found at ${videoPath}` },
        { status: 404 }
      );
    }

    // Upload the video file to Gemini
    const videoFile = await ai.files.upload({
      file: absolutePath,
      config: { mimeType: "video/mp4" },
    });

    // Wait for file processing
    let file = await ai.files.get({ name: videoFile.name! });
    while (file.state === "PROCESSING") {
      await new Promise((r) => setTimeout(r, 2000));
      file = await ai.files.get({ name: file.name! });
    }

    if (file.state === "FAILED") {
      return NextResponse.json(
        { error: "Video processing failed" },
        { status: 500 }
      );
    }

    // Extract assets using Gemini - now including timestamps for frame extraction
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [
        {
          role: "user",
          parts: [
            {
              fileData: {
                fileUri: file.uri!,
                mimeType: "video/mp4",
              },
            },
            {
              text: `You are analyzing a video clip from "${showTitle}" - episode "${episodeTitle}".

Extract ALL of the following information as a JSON object. Be extremely detailed and specific.

IMPORTANT TIMESTAMP RULES:
- For each character, environment, and object, include a "bestTimestamp" field — this must be a NUMBER representing TOTAL SECONDS into the video (e.g. 45 means 45 seconds in, 90 means 1 minute 30 seconds in). Do NOT use MM:SS or MM.SS format.
- Pick the moment where the character's face is most clearly shown, or the environment is seen in its widest/best shot.
- NEVER use a timestamp less than 3. The first few seconds of a video are often black screens, title cards, or fades. Always pick a timestamp at least 3 seconds in.
- Double-check your timestamps: the frame at that time must show actual visible content — not a black screen, not a fade transition, not a dark/obscured frame. Choose a well-lit, clear moment.
- For characters, prefer a close-up or medium shot where their face and features are clearly visible. Cross-reference against your knowledge of the show to make sure you pick a frame that actually shows THAT character, not a different one.
- For environments, prefer a wide establishing shot with good visibility of the location.

{
  "characters": [
    {
      "name": "character name (use actual character name if recognizable, otherwise descriptive name)",
      "description": "detailed visual appearance - clothing, hair, skin tone, build, distinguishing features",
      "role": "protagonist/antagonist/supporting/background",
      "keyTraits": ["trait1", "trait2"],
      "multiviewDescription": "describe how this character looks from different angles shown in the video - front, side, back views if available. Include posture, gait, silhouette details",
      "bestTimestamp": 12.5
    }
  ],
  "environments": [
    {
      "name": "location name",
      "description": "detailed description of the setting",
      "lighting": "lighting conditions and style",
      "timeOfDay": "time of day",
      "mood": "atmospheric mood",
      "bestTimestamp": 5.0
    }
  ],
  "objects": [
    {
      "name": "notable object",
      "description": "visual description",
      "significance": "narrative significance",
      "bestTimestamp": 8.0
    }
  ],
  "plot": {
    "summary": "what happens in this clip",
    "currentArc": "where this falls in the story arc",
    "keyEvents": ["event1", "event2"],
    "themes": ["theme1", "theme2"]
  },
  "seriesContext": {
    "genre": "genre classification",
    "era": "time period/setting era",
    "worldRules": "rules of this world - magic, technology, social norms etc",
    "tone": "overall tone of the series"
  },
  "cameraStyle": {
    "commonAngles": ["angle1", "angle2"],
    "movementStyle": "how the camera moves - handheld, steady, tracking, etc",
    "colorGrading": "describe the color palette and grading style",
    "visualTone": "visual mood - gritty, clean, dreamy, etc",
    "aspectRatio": "estimated aspect ratio"
  }
}

Return ONLY valid JSON, no markdown fences.`,
            },
          ],
        },
      ],
    });

    const text = response.text?.trim() || "";
    const cleaned = text.replace(/^```json?\s*/, "").replace(/\s*```$/, "");
    const assets: ExtractedAssets = JSON.parse(cleaned);

    // Extract frames using ffmpeg
    const imagesDir = path.join(process.cwd(), "public", "assets", "images", assetKey);
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    // Extract character frames
    for (let i = 0; i < assets.characters.length; i++) {
      const c = assets.characters[i];
      const filename = `char-${i}.jpg`;
      const outputPath = path.join(imagesDir, filename);
      extractFrame(absolutePath, c.bestTimestamp || 2, outputPath);
      if (fs.existsSync(outputPath)) {
        assets.characters[i].imagePath = `/assets/images/${assetKey}/${filename}`;
      }
    }

    // Extract environment frames
    for (let i = 0; i < assets.environments.length; i++) {
      const e = assets.environments[i];
      const filename = `env-${i}.jpg`;
      const outputPath = path.join(imagesDir, filename);
      extractFrame(absolutePath, e.bestTimestamp || 2, outputPath);
      if (fs.existsSync(outputPath)) {
        assets.environments[i].imagePath = `/assets/images/${assetKey}/${filename}`;
      }
    }

    // Extract object frames
    for (let i = 0; i < assets.objects.length; i++) {
      const o = assets.objects[i];
      const filename = `obj-${i}.jpg`;
      const outputPath = path.join(imagesDir, filename);
      extractFrame(absolutePath, o.bestTimestamp || 2, outputPath);
      if (fs.existsSync(outputPath)) {
        assets.objects[i].imagePath = `/assets/images/${assetKey}/${filename}`;
      }
    }

    // ── Verification pass: use the video to verify character timestamps ──
    // Re-use the already-uploaded video file to ask Gemini to verify
    const charSummary = assets.characters.map((c, i) => (
      `[${i}] "${c.name}" at ${c.bestTimestamp}s — expected: ${c.description}`
    )).join("\n");

    const verifyResponse = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [
        {
          role: "user",
          parts: [
            {
              fileData: {
                fileUri: file.uri!,
                mimeType: "video/mp4",
              },
            },
            {
              text: `You previously identified these characters in this video from "${showTitle}":

${charSummary}

Now VERIFY each one by checking the actual frame at the given timestamp:
1. Go to each timestamp and check: does that frame clearly show the named character's FACE?
2. Cross-reference against your knowledge of "${showTitle}" — is this actually that character? Does their appearance (hair color, clothing, features) match?
3. Is the frame well-lit and not black/dark/obscured/a transition?
4. If the character is only shown from behind or their face is hidden, that's NOT a good frame.

For any that fail verification, suggest a BETTER timestamp (in TOTAL SECONDS, e.g. 45 means 45 seconds in) where that character's face is clearly visible in a close-up or medium shot. The suggested timestamp must be at least 3.

Return a JSON array:
[
  { "index": 0, "correct": true },
  { "index": 1, "correct": false, "reason": "frame is too dark", "suggestedTimestamp": 45 }
]

Return ONLY valid JSON, no markdown.`,
            },
          ],
        },
      ],
    });

    const verifyText = (verifyResponse.text?.trim() || "")
      .replace(/^```json?\s*/, "")
      .replace(/\s*```$/, "");

    try {
      const fixes: Array<{ index: number; correct: boolean; reason?: string; suggestedTimestamp?: number }> = JSON.parse(verifyText);

      for (const fix of fixes) {
        if (!fix.correct && fix.suggestedTimestamp && fix.index < assets.characters.length) {
          const i = fix.index;
          const filename = `char-${i}.jpg`;
          const outputPath = path.join(imagesDir, filename);
          console.log(`Re-extracting char ${i} (${assets.characters[i].name}): ${fix.reason} -> trying ${fix.suggestedTimestamp}s`);
          extractFrame(absolutePath, fix.suggestedTimestamp, outputPath);
          assets.characters[i].bestTimestamp = fix.suggestedTimestamp;
        }
      }
    } catch {
      // Verification parse failed, keep original frames
    }

    // Cache locally
    const assetsDir = path.dirname(cachePath);
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }
    fs.writeFileSync(cachePath, JSON.stringify(assets, null, 2));

    // Clean up uploaded file
    await ai.files.delete({ name: file.name! }).catch(() => {});

    return NextResponse.json({ assets });
  } catch (error: unknown) {
    console.error("Asset extraction error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
