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
    const { panel, assets, videoPath, branchId, useOriginalFrames, numVariants = 2 } = (await req.json()) as {
      panel: StoryboardPanel;
      assets: ExtractedAssets;
      videoPath?: string;
      branchId: string;
      useOriginalFrames?: boolean;
      numVariants?: number;
    };

    const outputDir = path.join(process.cwd(), "public", "branches", "images", branchId);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Use original video frames if Gemini told us to
    if (useOriginalFrames && videoPath) {
      const absVideoPath = path.join(process.cwd(), "public", videoPath);
      if (fs.existsSync(absVideoPath)) {
        const startFramePath = path.join(outputDir, `${panel.id}-start-ref.jpg`);
        const endFramePath = path.join(outputDir, `${panel.id}-end-ref.jpg`);
        try {
          execSync(`ffmpeg -y -ss 3 -i "${absVideoPath}" -frames:v 1 -q:v 2 "${startFramePath}" 2>/dev/null`, { timeout: 10000 });
          execSync(`ffmpeg -y -ss 5 -i "${absVideoPath}" -frames:v 1 -q:v 2 "${endFramePath}" 2>/dev/null`, { timeout: 10000 });

          const results: { startImage?: string; endImage?: string } = {};
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

    const variantCount = Math.min(Math.max(numVariants, 1), 4);

    // Use panel's own prompts if available, fall back to buildPanelImagePrompt
    const startPrompt = panel.startFramePrompt || buildPanelImagePrompt(panel, assets, referenceDescriptions, "start");
    console.log(`[${panel.id}] Generating ${variantCount} start frame variant(s) with Nano Banana 2...`);

    const startResult = await fal.subscribe("fal-ai/nano-banana-2", {
      input: {
        prompt: startPrompt,
        num_images: variantCount,
        aspect_ratio: "16:9",
        output_format: "png",
        resolution: "1K",
      },
    });

    const startImages = (startResult.data as any)?.images || [];
    const startVariants: string[] = [];
    for (let v = 0; v < startImages.length; v++) {
      const imgUrl = startImages[v]?.url;
      if (!imgUrl) continue;
      const imgResponse = await fetch(imgUrl);
      const buffer = Buffer.from(await imgResponse.arrayBuffer());
      const suffix = variantCount > 1 ? `-v${v + 1}` : "";
      const filename = `${panel.id}-start${suffix}.png`;
      fs.writeFileSync(path.join(outputDir, filename), buffer);
      startVariants.push(`/branches/images/${branchId}/${filename}`);
      console.log(`[${panel.id}] Start frame saved: ${filename}`);
    }

    const endPrompt = panel.endFramePrompt || buildPanelImagePrompt(panel, assets, referenceDescriptions, "end");
    console.log(`[${panel.id}] Generating ${variantCount} end frame variant(s) with Nano Banana 2...`);

    const endResult = await fal.subscribe("fal-ai/nano-banana-2", {
      input: {
        prompt: endPrompt,
        num_images: variantCount,
        aspect_ratio: "16:9",
        output_format: "png",
        resolution: "1K",
      },
    });

    const endImages = (endResult.data as any)?.images || [];
    const endVariants: string[] = [];
    for (let v = 0; v < endImages.length; v++) {
      const imgUrl = endImages[v]?.url;
      if (!imgUrl) continue;
      const imgResponse = await fetch(imgUrl);
      const buffer = Buffer.from(await imgResponse.arrayBuffer());
      const suffix = variantCount > 1 ? `-v${v + 1}` : "";
      const filename = `${panel.id}-end${suffix}.png`;
      fs.writeFileSync(path.join(outputDir, filename), buffer);
      endVariants.push(`/branches/images/${branchId}/${filename}`);
      console.log(`[${panel.id}] End frame saved: ${filename}`);
    }

    return NextResponse.json({
      panelId: panel.id,
      // Default selected (first variant)
      startImage: startVariants[0],
      endImage: endVariants[0],
      // All variants for choosing
      startVariants,
      endVariants,
      source: "generated",
    });
  } catch (error: unknown) {
    console.error("Panel image generation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
