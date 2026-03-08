import { NextRequest, NextResponse } from "next/server";
import { getGeminiClient } from "@/lib/gemini";
import * as fs from "fs";
import * as path from "path";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { videoPath, description, showTitle, episodeTitle } = await req.json();

    if (!videoPath || !description) {
      return NextResponse.json({ error: "videoPath and description required" }, { status: 400 });
    }

    const ai = getGeminiClient();
    const absolutePath = path.join(process.cwd(), "public", videoPath);

    if (!fs.existsSync(absolutePath)) {
      return NextResponse.json({ error: `Video not found at ${videoPath}` }, { status: 404 });
    }

    // Upload video to Gemini
    const videoFile = await ai.files.upload({
      file: absolutePath,
      config: { mimeType: "video/mp4" },
    });

    let file = await ai.files.get({ name: videoFile.name! });
    while (file.state === "PROCESSING") {
      await new Promise((r) => setTimeout(r, 2000));
      file = await ai.files.get({ name: file.name! });
    }

    if (file.state === "FAILED") {
      return NextResponse.json({ error: "Video processing failed" }, { status: 500 });
    }

    const prompt = `You are analyzing a video clip from "${showTitle}" — episode "${episodeTitle}".

The user wants to REPLACE a specific segment of this video. They described what they want to change as:
"${description}"

Find the EXACT segment in this video that matches their description. Return the precise start and end timestamps.

RULES:
- Timestamps must be total seconds (NUMBER), not MM:SS
- Minimum timestamp is 1
- The segment should be a coherent scene or beat — don't cut mid-sentence or mid-action
- Include a brief description of what happens in the identified segment
- If the description is vague, pick the most likely matching segment
- Prefer clean cut points: scene transitions, pauses in dialogue, shot changes

Return ONLY valid JSON:
{
  "startTime": 10.0,
  "endTime": 25.0,
  "description": "brief description of what happens in this segment",
  "confidence": "high/medium/low"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { fileData: { fileUri: file.uri!, mimeType: "video/mp4" } },
            { text: prompt },
          ],
        },
      ],
    });

    const text = response.text?.trim() || "";
    const cleaned = text.replace(/^```json?\s*/, "").replace(/\s*```$/, "");
    const result = JSON.parse(cleaned);

    // Clean up
    await ai.files.delete({ name: file.name! }).catch(() => {});

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Find segment error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
