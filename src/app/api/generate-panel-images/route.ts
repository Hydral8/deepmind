import { NextRequest, NextResponse } from "next/server";
import { StoryboardPanel, ExtractedAssets } from "@/lib/types";
import { getGeminiClient } from "@/lib/gemini";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

export const maxDuration = 120;

// Gather relevant asset images for a panel as Gemini-compatible inline parts
function gatherAssetParts(
  panel: StoryboardPanel,
  assets: ExtractedAssets
): { labels: string[]; parts: Array<{ inlineData: { data: string; mimeType: string } }> } {
  const labels: string[] = [];
  const parts: Array<{ inlineData: { data: string; mimeType: string } }> = [];

  for (const charName of panel.characters) {
    const charAsset = assets.characters.find(
      (c) => c.name.toLowerCase() === charName.toLowerCase()
    );
    if (charAsset?.imagePath) {
      const absPath = path.join(process.cwd(), "public", charAsset.imagePath);
      if (fs.existsSync(absPath)) {
        const data = fs.readFileSync(absPath).toString("base64");
        labels.push(`Character: ${charAsset.name} — ${charAsset.description}. Traits: ${charAsset.keyTraits.join(", ")}`);
        parts.push({ inlineData: { data, mimeType: "image/jpeg" } });
      }
    }
  }

  for (const env of assets.environments) {
    if (panel.environment.toLowerCase().includes(env.name.toLowerCase().split(",")[0])) {
      if (env.imagePath) {
        const absPath = path.join(process.cwd(), "public", env.imagePath);
        if (fs.existsSync(absPath)) {
          const data = fs.readFileSync(absPath).toString("base64");
          labels.push(`Environment: ${env.name} — ${env.description}. Lighting: ${env.lighting}. Mood: ${env.mood}`);
          parts.push({ inlineData: { data, mimeType: "image/jpeg" } });
        }
      }
      break;
    }
  }

  return { labels, parts };
}

function buildImageGenPrompt(
  framePrompt: string,
  position: "start" | "end",
  panel: StoryboardPanel,
  assets: ExtractedAssets,
  assetLabels: string[]
): string {
  const assetRef = assetLabels.length > 0
    ? `\n\nREFERENCE ASSETS (images provided above — match these EXACTLY):\n${assetLabels.map((l, i) => `[Image ${i + 1}] ${l}`).join("\n")}`
    : "";

  return `Generate a photorealistic cinematic film frame for the ${position} of this scene.

SCENE: ${panel.sceneDescription}
FRAME DESCRIPTION: ${framePrompt}
ENVIRONMENT: ${panel.environment}
MOOD: ${panel.mood}
${assetRef}

REQUIREMENTS:
- The generated image must look like a frame from a high-end TV production, not AI art
- Characters must match the reference images EXACTLY — same face, same hair, same clothing, same skin tone. Do NOT alter their appearance.
- Environment must match the reference — same materials, same lighting quality, same color palette
- Camera: ${assets.cameraStyle.colorGrading}. ${assets.cameraStyle.visualTone}
- Each character appears at most once — no duplicates or reflections
- 16:9 aspect ratio. No watermarks, no text overlays, no borders
- Hyperrealistic, photorealistic. Film grain, natural depth of field.`;
}

// Generate image using Gemini's native image generation with reference assets
async function generateWithGemini(
  framePrompt: string,
  position: "start" | "end",
  panel: StoryboardPanel,
  assets: ExtractedAssets,
  numVariants: number
): Promise<Buffer[]> {
  const ai = getGeminiClient();
  const { labels, parts: assetParts } = gatherAssetParts(panel, assets);
  const prompt = buildImageGenPrompt(framePrompt, position, panel, assets, labels);

  const buffers: Buffer[] = [];

  // Gemini image gen returns 1 image per call, so we parallelize for variants
  const promises = Array.from({ length: numVariants }, async () => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-preview-image-generation",
        contents: [
          {
            role: "user",
            parts: [
              ...assetParts,
              { text: prompt },
            ],
          },
        ],
        config: {
          responseModalities: ["IMAGE", "TEXT"],
        },
      });

      // Extract image from response parts
      const candidates = (response as any).candidates || [];
      for (const candidate of candidates) {
        for (const part of candidate.content?.parts || []) {
          if (part.inlineData?.data) {
            return Buffer.from(part.inlineData.data, "base64");
          }
        }
      }
    } catch (err) {
      console.error(`[${panel.id}] Gemini image gen failed for ${position}:`, err);
    }
    return null;
  });

  const results = await Promise.all(promises);
  for (const buf of results) {
    if (buf) buffers.push(buf);
  }

  return buffers;
}

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

    // Use original video frames if strategy says extract
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

    const variantCount = Math.min(Math.max(numVariants, 1), 4);

    const rawStartPrompt = panel.startFramePrompt || panel.sceneDescription;
    const rawEndPrompt = panel.endFramePrompt || panel.sceneDescription;

    console.log(`[${panel.id}] Generating ${variantCount} start + end frame variant(s) with Gemini native image gen...`);

    // Generate start and end frames in parallel, each with reference assets
    const [startBuffers, endBuffers] = await Promise.all([
      generateWithGemini(rawStartPrompt, "start", panel, assets, variantCount),
      generateWithGemini(rawEndPrompt, "end", panel, assets, variantCount),
    ]);

    const startVariants: string[] = [];
    for (let v = 0; v < startBuffers.length; v++) {
      const suffix = variantCount > 1 ? `-v${v + 1}` : "";
      const filename = `${panel.id}-start${suffix}.png`;
      fs.writeFileSync(path.join(outputDir, filename), startBuffers[v]);
      startVariants.push(`/branches/images/${branchId}/${filename}`);
      console.log(`[${panel.id}] Start frame saved: ${filename}`);
    }

    const endVariants: string[] = [];
    for (let v = 0; v < endBuffers.length; v++) {
      const suffix = variantCount > 1 ? `-v${v + 1}` : "";
      const filename = `${panel.id}-end${suffix}.png`;
      fs.writeFileSync(path.join(outputDir, filename), endBuffers[v]);
      endVariants.push(`/branches/images/${branchId}/${filename}`);
      console.log(`[${panel.id}] End frame saved: ${filename}`);
    }

    return NextResponse.json({
      panelId: panel.id,
      startImage: startVariants[0],
      endImage: endVariants[0],
      startVariants,
      endVariants,
      source: "gemini",
    });
  } catch (error: unknown) {
    console.error("Panel image generation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
