import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { StoryboardPanel, ExtractedAssets } from "@/lib/types";
import { buildPanelImagePrompt } from "@/lib/prompts";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

export const maxDuration = 120;

fal.config({ credentials: process.env.FAL_KEY });

export async function POST(req: NextRequest) {
  try {
    const { panel, assets, videoPath, branchId } = (await req.json()) as {
      panel: StoryboardPanel;
      assets: ExtractedAssets;
      videoPath?: string;
      branchId: string;
    };

    const outputDir = path.join(process.cwd(), "public", "branches", "images", branchId);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const results: { startImage?: string; endImage?: string } = {};

    // Check if this panel modifies an existing scene (has source video + is a small change)
    const isMinorChange = panel.sceneDescription.toLowerCase().includes("same scene") ||
      panel.sceneDescription.toLowerCase().includes("original") ||
      panel.cameraAngle.toLowerCase().includes("match");

    if (isMinorChange && videoPath) {
      const absVideoPath = path.join(process.cwd(), "public", videoPath);
      if (fs.existsSync(absVideoPath)) {
        const startFramePath = path.join(outputDir, `${panel.id}-start-ref.jpg`);
        const endFramePath = path.join(outputDir, `${panel.id}-end-ref.jpg`);
        try {
          execSync(`ffmpeg -y -ss 3 -i "${absVideoPath}" -frames:v 1 -q:v 2 "${startFramePath}" 2>/dev/null`, { timeout: 10000 });
          execSync(`ffmpeg -y -ss 5 -i "${absVideoPath}" -frames:v 1 -q:v 2 "${endFramePath}" 2>/dev/null`, { timeout: 10000 });

          if (fs.existsSync(startFramePath)) {
            results.startImage = `/branches/images/${branchId}/${panel.id}-start-ref.jpg`;
          }
          if (fs.existsSync(endFramePath)) {
            results.endImage = `/branches/images/${branchId}/${panel.id}-end-ref.jpg`;
          }

          return NextResponse.json({ panelId: panel.id, ...results, source: "video" });
        } catch {
          // Fall through to AI generation
        }
      }
    }

    // Build reference descriptions from assets
    const referenceDescriptions: string[] = [];

    for (const charName of panel.characters) {
      const charAsset = assets.characters.find(
        (c) => c.name.toLowerCase() === charName.toLowerCase()
      );
      if (charAsset) {
        referenceDescriptions.push(
          `CHARACTER "${charAsset.name}": ${charAsset.description}. Traits: ${charAsset.keyTraits.join(", ")}. Multi-view: ${charAsset.multiviewDescription}`
        );
      }
    }

    for (const env of assets.environments) {
      if (panel.environment.toLowerCase().includes(env.name.toLowerCase().split(",")[0])) {
        referenceDescriptions.push(
          `ENVIRONMENT "${env.name}": ${env.description}. Lighting: ${env.lighting}. Mood: ${env.mood}`
        );
        break;
      }
    }

    // Generate start frame with Grok Imagine
    const startPrompt = buildPanelImagePrompt(panel, assets, referenceDescriptions, "start");
    console.log(`[${panel.id}] Generating start frame with Grok Imagine...`);

    const startResult = await fal.subscribe("xai/grok-imagine-image", {
      input: {
        prompt: startPrompt,
        num_images: 1,
        aspect_ratio: "16:9",
        output_format: "png",
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const startImageUrl = (startResult.data as any)?.images?.[0]?.url;
    if (startImageUrl) {
      const imgResponse = await fetch(startImageUrl);
      const buffer = Buffer.from(await imgResponse.arrayBuffer());
      const filename = `${panel.id}-start.png`;
      fs.writeFileSync(path.join(outputDir, filename), buffer);
      results.startImage = `/branches/images/${branchId}/${filename}`;
      console.log(`[${panel.id}] Start frame saved: ${filename}`);
    }

    // Generate end frame with Grok Imagine
    const endPrompt = buildPanelImagePrompt(panel, assets, referenceDescriptions, "end");
    console.log(`[${panel.id}] Generating end frame with Grok Imagine...`);

    const endResult = await fal.subscribe("xai/grok-imagine-image", {
      input: {
        prompt: endPrompt,
        num_images: 1,
        aspect_ratio: "16:9",
        output_format: "png",
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const endImageUrl = (endResult.data as any)?.images?.[0]?.url;
    if (endImageUrl) {
      const imgResponse = await fetch(endImageUrl);
      const buffer = Buffer.from(await imgResponse.arrayBuffer());
      const filename = `${panel.id}-end.png`;
      fs.writeFileSync(path.join(outputDir, filename), buffer);
      results.endImage = `/branches/images/${branchId}/${filename}`;
      console.log(`[${panel.id}] End frame saved: ${filename}`);
    }

    return NextResponse.json({ panelId: panel.id, ...results, source: "generated" });
  } catch (error: unknown) {
    console.error("Panel image generation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
