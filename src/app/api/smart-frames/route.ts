import { NextRequest, NextResponse } from "next/server";
import { getGeminiClient } from "@/lib/gemini";
import { fal } from "@fal-ai/client";
import { StoryboardPanel, ExtractedAssets } from "@/lib/types";
import { buildSmartFrameStrategyPrompt, buildPanelImagePrompt } from "@/lib/prompts";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

export const maxDuration = 180;

fal.config({ credentials: process.env.FAL_KEY });

interface FrameStrategy {
  strategy: "extract" | "generate";
  timestamp?: number;
  reason: string;
}

export async function POST(req: NextRequest) {
  try {
    const { panels, assets, videoPath, branchId } = (await req.json()) as {
      panels: StoryboardPanel[];
      assets: ExtractedAssets;
      videoPath: string;
      branchId: string;
    };

    const ai = getGeminiClient();
    const absVideoPath = path.join(process.cwd(), "public", videoPath);

    if (!fs.existsSync(absVideoPath)) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const outputDir = path.join(process.cwd(), "public", "branches", "images", branchId);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Step 1: Ask Gemini to analyze the video and decide strategy per frame
    console.log("[smart-frames] Asking Gemini for frame strategy...");
    const videoBuffer = fs.readFileSync(absVideoPath);
    const base64Video = videoBuffer.toString("base64");

    const panelDescriptions = panels
      .map(
        (p) =>
          `Panel ${p.order} (id: ${p.id}): ${p.sceneDescription}. Camera: ${p.cameraAngle}. Mood: ${p.mood}. Characters: ${p.characters.join(", ")}.`
      )
      .join("\n");

    const strategyPrompt = buildSmartFrameStrategyPrompt(panelDescriptions);

    const strategyResponse = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: "video/mp4", data: base64Video } },
            { text: strategyPrompt },
          ],
        },
      ],
    });

    const strategyText = strategyResponse.text || "";
    const jsonMatch = strategyText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse strategy", raw: strategyText }, { status: 500 });
    }

    const strategies = JSON.parse(jsonMatch[0]) as {
      panelId: string;
      startFrame: FrameStrategy;
      endFrame: FrameStrategy;
    }[];

    console.log("[smart-frames] Strategy:", JSON.stringify(strategies, null, 2));

    // Step 2: Execute the strategy for each panel
    const results: Record<string, {
      startImage?: string;
      endImage?: string;
      startStrategy?: string;
      endStrategy?: string;
      startReason?: string;
      endReason?: string;
    }> = {};

    for (const panel of panels) {
      const strategy = strategies.find((s) => s.panelId === panel.id);
      if (!strategy) continue;

      const panelResult: typeof results[string] = {};

      // Process start frame
      if (strategy.startFrame.strategy === "extract" && strategy.startFrame.timestamp) {
        const ts = Math.max(3, strategy.startFrame.timestamp);
        const filename = `${panel.id}-start.jpg`;
        const framePath = path.join(outputDir, filename);
        try {
          execSync(
            `ffmpeg -y -ss ${ts} -i "${absVideoPath}" -frames:v 1 -q:v 2 "${framePath}" 2>/dev/null`,
            { timeout: 10000 }
          );
          panelResult.startImage = `/branches/images/${branchId}/${filename}`;
          console.log(`[${panel.id}] Extracted start frame from source @${ts}s`);
        } catch (e) {
          console.error(`[${panel.id}] Failed to extract start frame, falling back to generate`);
          strategy.startFrame.strategy = "generate";
        }
      }

      if (strategy.startFrame.strategy === "generate") {
        const referenceDescriptions = buildReferenceDescriptions(panel, assets);
        const prompt = buildPanelImagePrompt(panel, assets, referenceDescriptions, "start");
        console.log(`[${panel.id}] Generating start frame with Nano Banana 2...`);

        const result = await fal.subscribe("fal-ai/nano-banana-2", {
          input: {
            prompt,
            num_images: 1,
            aspect_ratio: "16:9",
            output_format: "png",
            resolution: "1K",
          },
        });

        const imgUrl = (result.data as any)?.images?.[0]?.url;
        if (imgUrl) {
          const imgResponse = await fetch(imgUrl);
          const buffer = Buffer.from(await imgResponse.arrayBuffer());
          const filename = `${panel.id}-start.png`;
          fs.writeFileSync(path.join(outputDir, filename), buffer);
          panelResult.startImage = `/branches/images/${branchId}/${filename}`;
          console.log(`[${panel.id}] Generated start frame`);
        }
      }

      panelResult.startStrategy = strategy.startFrame.strategy;
      panelResult.startReason = strategy.startFrame.reason;

      // Process end frame
      if (strategy.endFrame.strategy === "extract" && strategy.endFrame.timestamp) {
        const ts = Math.max(3, strategy.endFrame.timestamp);
        const filename = `${panel.id}-end.jpg`;
        const framePath = path.join(outputDir, filename);
        try {
          execSync(
            `ffmpeg -y -ss ${ts} -i "${absVideoPath}" -frames:v 1 -q:v 2 "${framePath}" 2>/dev/null`,
            { timeout: 10000 }
          );
          panelResult.endImage = `/branches/images/${branchId}/${filename}`;
          console.log(`[${panel.id}] Extracted end frame from source @${ts}s`);
        } catch (e) {
          console.error(`[${panel.id}] Failed to extract end frame, falling back to generate`);
          strategy.endFrame.strategy = "generate";
        }
      }

      if (strategy.endFrame.strategy === "generate") {
        const referenceDescriptions = buildReferenceDescriptions(panel, assets);
        const prompt = buildPanelImagePrompt(panel, assets, referenceDescriptions, "end");
        console.log(`[${panel.id}] Generating end frame with Nano Banana 2...`);

        const result = await fal.subscribe("fal-ai/nano-banana-2", {
          input: {
            prompt,
            num_images: 1,
            aspect_ratio: "16:9",
            output_format: "png",
            resolution: "1K",
          },
        });

        const imgUrl = (result.data as any)?.images?.[0]?.url;
        if (imgUrl) {
          const imgResponse = await fetch(imgUrl);
          const buffer = Buffer.from(await imgResponse.arrayBuffer());
          const filename = `${panel.id}-end.png`;
          fs.writeFileSync(path.join(outputDir, filename), buffer);
          panelResult.endImage = `/branches/images/${branchId}/${filename}`;
          console.log(`[${panel.id}] Generated end frame`);
        }
      }

      panelResult.endStrategy = strategy.endFrame.strategy;
      panelResult.endReason = strategy.endFrame.reason;

      results[panel.id] = panelResult;
    }

    return NextResponse.json({ images: results, strategies });
  } catch (error: unknown) {
    console.error("Smart frames error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildReferenceDescriptions(panel: StoryboardPanel, assets: ExtractedAssets): string[] {
  const descriptions: string[] = [];

  for (const charName of panel.characters) {
    const charAsset = assets.characters.find(
      (c) => c.name.toLowerCase() === charName.toLowerCase()
    );
    if (charAsset) {
      descriptions.push(
        `CHARACTER "${charAsset.name}": ${charAsset.description}. Traits: ${charAsset.keyTraits.join(", ")}. Multi-view: ${charAsset.multiviewDescription}`
      );
    }
  }

  for (const env of assets.environments) {
    if (panel.environment.toLowerCase().includes(env.name.toLowerCase().split(",")[0])) {
      descriptions.push(
        `ENVIRONMENT "${env.name}": ${env.description}. Lighting: ${env.lighting}. Mood: ${env.mood}`
      );
      break;
    }
  }

  return descriptions;
}
