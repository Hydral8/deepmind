import { NextRequest, NextResponse } from "next/server";
import { getGeminiClient } from "@/lib/gemini";
import { StoryboardPanel, ExtractedAssets } from "@/lib/types";
import { buildPanelImagePrompt } from "@/lib/prompts";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

export const maxDuration = 120;

// Load an image file as a Gemini inline data part
function loadImagePart(relativePath: string) {
  const absPath = path.join(process.cwd(), "public", relativePath);
  if (!fs.existsSync(absPath)) return null;
  const data = fs.readFileSync(absPath);
  const ext = path.extname(absPath).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
  return {
    inlineData: {
      mimeType,
      data: data.toString("base64"),
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const { panel, assets, videoPath, branchId } = (await req.json()) as {
      panel: StoryboardPanel;
      assets: ExtractedAssets;
      videoPath?: string;
      branchId: string;
    };

    const ai = getGeminiClient();

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

    // Collect reference image parts from extracted assets
    const referenceImageParts: { inlineData: { mimeType: string; data: string } }[] = [];
    const referenceDescriptions: string[] = [];

    // Characters in this panel
    for (const charName of panel.characters) {
      const charAsset = assets.characters.find(
        (c) => c.name.toLowerCase() === charName.toLowerCase()
      );
      if (charAsset?.imagePath) {
        const part = loadImagePart(charAsset.imagePath);
        if (part) {
          referenceImageParts.push(part);
          referenceDescriptions.push(
            `CHARACTER "${charAsset.name}": ${charAsset.description}. Traits: ${charAsset.keyTraits.join(", ")}. Multi-view: ${charAsset.multiviewDescription}`
          );
        }
      }
    }

    // Environment
    for (const env of assets.environments) {
      if (panel.environment.toLowerCase().includes(env.name.toLowerCase().split(",")[0]) && env.imagePath) {
        const part = loadImagePart(env.imagePath);
        if (part) {
          referenceImageParts.push(part);
          referenceDescriptions.push(
            `ENVIRONMENT "${env.name}": ${env.description}. Lighting: ${env.lighting}. Mood: ${env.mood}`
          );
        }
        break;
      }
    }

    // Objects
    for (const obj of assets.objects) {
      if (obj.imagePath) {
        const part = loadImagePart(obj.imagePath);
        if (part) {
          referenceImageParts.push(part);
          referenceDescriptions.push(
            `OBJECT "${obj.name}": ${obj.description}. Significance: ${obj.significance}`
          );
        }
      }
    }

    const startPrompt = buildPanelImagePrompt(panel, assets, referenceDescriptions, "start");

    const startParts = [
      ...referenceImageParts,
      { text: startPrompt },
    ];

    const startResponse = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: [{ role: "user", parts: startParts }],
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    if (startResponse.candidates?.[0]?.content?.parts) {
      for (const part of startResponse.candidates[0].content.parts) {
        if (part.inlineData) {
          const buffer = Buffer.from(part.inlineData.data!, "base64");
          const filename = `${panel.id}-start.png`;
          fs.writeFileSync(path.join(outputDir, filename), buffer);
          results.startImage = `/branches/images/${branchId}/${filename}`;
          break;
        }
      }
    }

    const endPrompt = buildPanelImagePrompt(panel, assets, referenceDescriptions, "end");

    const endParts = [
      ...referenceImageParts,
      { text: endPrompt },
    ];

    const endResponse = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: [{ role: "user", parts: endParts }],
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    if (endResponse.candidates?.[0]?.content?.parts) {
      for (const part of endResponse.candidates[0].content.parts) {
        if (part.inlineData) {
          const buffer = Buffer.from(part.inlineData.data!, "base64");
          const filename = `${panel.id}-end.png`;
          fs.writeFileSync(path.join(outputDir, filename), buffer);
          results.endImage = `/branches/images/${branchId}/${filename}`;
          break;
        }
      }
    }

    return NextResponse.json({ panelId: panel.id, ...results, source: "generated" });
  } catch (error: unknown) {
    console.error("Panel image generation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
