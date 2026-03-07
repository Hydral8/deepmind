import { NextRequest, NextResponse } from "next/server";
import { getGeminiClient } from "@/lib/gemini";
import { StoryboardPanel } from "@/lib/types";
import { buildFramePlanningPrompt } from "@/lib/prompts";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { panels, videoPath, branchId } = (await req.json()) as {
      panels: StoryboardPanel[];
      videoPath: string;
      branchId: string;
    };

    const ai = getGeminiClient();
    const absVideoPath = path.join(process.cwd(), "public", videoPath);

    if (!fs.existsSync(absVideoPath)) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Upload video to Gemini for analysis
    const videoBuffer = fs.readFileSync(absVideoPath);
    const base64Video = videoBuffer.toString("base64");

    const panelDescriptions = panels
      .map(
        (p) =>
          `Panel ${p.order} (id: ${p.id}): ${p.sceneDescription}. Camera: ${p.cameraAngle}. Mood: ${p.mood}. Characters: ${p.characters.join(", ")}.`
      )
      .join("\n");

    const prompt = buildFramePlanningPrompt(panelDescriptions);

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "video/mp4",
                data: base64Video,
              },
            },
            { text: prompt },
          ],
        },
      ],
    });

    const text = response.text || "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse frame plan", raw: text }, { status: 500 });
    }

    const framePlan = JSON.parse(jsonMatch[0]) as {
      panelId: string;
      startTimestamp: number;
      endTimestamp: number;
    }[];

    // Extract the actual frames using ffmpeg
    const outputDir = path.join(process.cwd(), "public", "branches", "frames", branchId);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const results: Record<string, { startFrame: string; endFrame: string; startTimestamp: number; endTimestamp: number }> = {};

    for (const plan of framePlan) {
      const startTs = Math.max(3, plan.startTimestamp);
      const endTs = Math.max(3, plan.endTimestamp);

      const startFile = `${plan.panelId}-start.jpg`;
      const endFile = `${plan.panelId}-end.jpg`;
      const startPath = path.join(outputDir, startFile);
      const endPath = path.join(outputDir, endFile);

      try {
        execSync(
          `ffmpeg -y -ss ${startTs} -i "${absVideoPath}" -frames:v 1 -q:v 2 "${startPath}" 2>/dev/null`,
          { timeout: 10000 }
        );
        execSync(
          `ffmpeg -y -ss ${endTs} -i "${absVideoPath}" -frames:v 1 -q:v 2 "${endPath}" 2>/dev/null`,
          { timeout: 10000 }
        );
      } catch (e) {
        console.error(`Failed to extract frames for ${plan.panelId}:`, e);
        continue;
      }

      results[plan.panelId] = {
        startFrame: `/branches/frames/${branchId}/${startFile}`,
        endFrame: `/branches/frames/${branchId}/${endFile}`,
        startTimestamp: startTs,
        endTimestamp: endTs,
      };
    }

    return NextResponse.json({ framePlan: results });
  } catch (error: unknown) {
    console.error("Frame planning error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
