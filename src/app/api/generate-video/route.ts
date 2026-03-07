import { NextRequest, NextResponse } from "next/server";
import { getGeminiClient } from "@/lib/gemini";
import { ExtractedAssets } from "@/lib/types";
import { buildVideoPrompt } from "@/lib/prompts";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    panelId,
    visualPrompt: rawVisualPrompt,
    panel,
    assets,
    duration,
    previousVideoPath,
    firstFramePath,
    lastFramePath,
    referenceImagePaths,
  } = body as {
    panelId: string;
    visualPrompt: string;
    panel?: { visualPrompt: string; sceneDescription: string; cameraAngle: string; cameraMovement: string; mood: string; characters: string[]; environment: string; dialogue: string; duration: number; id: string; order: number };
    assets?: ExtractedAssets;
    duration: number;
    previousVideoPath?: string;
    firstFramePath?: string;
    lastFramePath?: string;
    referenceImagePaths?: string[];
  };

  // Use enriched prompt if assets are provided, otherwise fall back to raw prompt
  const visualPrompt = (panel && assets)
    ? buildVideoPrompt(panel, assets)
    : rawVisualPrompt;

  try {
    const ai = getGeminiClient();

    function loadImage(relativePath: string) {
      const absPath = path.join(process.cwd(), "public", relativePath);
      if (!fs.existsSync(absPath)) return null;
      const data = fs.readFileSync(absPath);
      const ext = path.extname(absPath).toLowerCase();
      const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
      return { imageBytes: data.toString("base64"), mimeType };
    }

    // Mode 1: Video extension (chain from previous panel using file URI)
    if (previousVideoPath) {
      console.log(`[${panelId}] Veo: extending previous video via file upload`);
      // Upload the previous video as a file first, then reference it
      const absVideoPath = path.join(process.cwd(), "public", previousVideoPath);
      if (fs.existsSync(absVideoPath)) {
        const videoData = fs.readFileSync(absVideoPath);
        // Upload to Gemini files API
        const uploadedFile = await ai.files.upload({
          file: new Blob([videoData], { type: "video/mp4" }),
          config: { mimeType: "video/mp4" },
        });
        console.log(`[${panelId}] Uploaded previous video: ${uploadedFile.name}`);

        const operation = await ai.models.generateVideos({
          model: "veo-3.1-generate-preview",
          prompt: visualPrompt,
          video: { uri: uploadedFile.uri, mimeType: "video/mp4" },
          config: {
            numberOfVideos: 1,
            durationSeconds: Math.min(duration, 8),
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        return await pollAndDownload(ai, operation, panelId);
      }
    }

    // Mode 2: Image-to-video with first frame
    const firstImg = firstFramePath ? loadImage(firstFramePath) : null;
    const lastImg = lastFramePath ? loadImage(lastFramePath) : null;
    if (firstImg && lastImg) {
      console.log(`[${panelId}] Veo: image-to-video`);
      const operation = await ai.models.generateVideos({
        model: "veo-3.1-generate-preview",
        prompt: visualPrompt,
        image: { imageBytes: firstImg.imageBytes, mimeType: firstImg.mimeType },
        config: {
          numberOfVideos: 1,
          durationSeconds: Math.min(duration, 8),
          lastFrame: { imageBytes: lastImg?.imageBytes, mimeType: lastImg?.mimeType },
        },
      });
      return await pollAndDownload(ai, operation, panelId);
    }

    // Mode 3: Text-to-video
    console.log(`[${panelId}] Veo: text-to-video`);
    const operation = await ai.models.generateVideos({
      model: "veo-3.1-generate-preview",
      prompt: visualPrompt,
      config: {
        aspectRatio: "16:9",
        numberOfVideos: 1,
        durationSeconds: Math.min(duration, 8),
      },
    });
    return await pollAndDownload(ai, operation, panelId);
  } catch (error: unknown) {
    console.error("Video generation error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message, panelId }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pollAndDownload(ai: any, operation: any, panelId: string) {
  while (!operation.done) {
    console.log(`[${panelId}] Waiting for video generation...`);
    await new Promise((r) => setTimeout(r, 10000));
    operation = await ai.operations.getVideosOperation({ operation });
  }

  const generatedVideos = operation.response?.generatedVideos || [];
  if (generatedVideos.length === 0) {
    return NextResponse.json({ error: "No video generated", panelId }, { status: 500 });
  }

  const video = generatedVideos[0];
  const outputDir = path.join(process.cwd(), "public", "generated");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filename = `${panelId}-${crypto.randomBytes(4).toString("hex")}.mp4`;
  const downloadPath = path.join(outputDir, filename);

  await ai.files.download({ file: video.video!, downloadPath });

  const fileBuffer = fs.readFileSync(downloadPath);
  const base64Video = fileBuffer.toString("base64");

  return NextResponse.json({
    panelId,
    videoData: base64Video,
    videoUrl: `/generated/${filename}`,
    mimeType: "video/mp4",
    status: "done",
  });
}
