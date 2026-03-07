import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
export const maxDuration = 300;

fal.config({ credentials: process.env.FAL_KEY });

async function uploadImageToFal(relativePath: string): Promise<string | null> {
  const absPath = path.join(process.cwd(), "public", relativePath);
  if (!fs.existsSync(absPath)) {
    console.log(`[upload] File not found: ${absPath}`);
    return null;
  }

  const data = fs.readFileSync(absPath);
  const ext = path.extname(absPath).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
  const blob = new Blob([data], { type: mimeType });
  const url = await fal.storage.upload(blob);
  console.log(`[upload] Uploaded ${relativePath} -> ${url}`);
  return url;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    panelId,
    visualPrompt,
    duration,
    firstFramePath,
    lastFramePath,
  } = body as {
    panelId: string;
    visualPrompt: string;
    duration: number;
    firstFramePath?: string;
    lastFramePath?: string;
  };

  try {
    const outputDir = path.join(process.cwd(), "public", "generated");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Mode 1: Image-to-video with start frame via Grok Imagine Video
    if (firstFramePath) {
      const imageUrl = await uploadImageToFal(firstFramePath);

      if (imageUrl) {
        console.log(`[${panelId}] Grok Imagine Video: image-to-video`);
        const result = await fal.subscribe("xai/grok-imagine-video/image-to-video", {
          input: {
            prompt: visualPrompt,
            image_url: imageUrl,
            duration: Math.min(duration, 10),
            aspect_ratio: "16:9",
            resolution: "720p",
          },
          logs: true,
          onQueueUpdate: (update) => {
            console.log(`[${panelId}] Queue: ${update.status}`);
            if (update.status === "IN_PROGRESS" && update.logs) {
              update.logs.map((log) => log.message).forEach((msg) => console.log(`[${panelId}] ${msg}`));
            }
          },
        });

        console.log(`[${panelId}] Grok result:`, JSON.stringify(result.data, null, 2));
        return await downloadAndSave(result.data, panelId, outputDir);
      }
      console.log(`[${panelId}] Failed to upload frame, falling back to text-to-video`);
    }

    // Mode 2: Text-to-video fallback via Grok Imagine Video
    console.log(`[${panelId}] Grok Imagine Video: text-to-video`);
    const result = await fal.subscribe("xai/grok-imagine-video/text-to-video", {
      input: {
        prompt: visualPrompt,
        duration: Math.min(duration, 10),
        aspect_ratio: "16:9",
        resolution: "720p",
      },
      logs: true,
      onQueueUpdate: (update) => {
        console.log(`[${panelId}] Queue: ${update.status}`);
        if (update.status === "IN_PROGRESS" && update.logs) {
          update.logs.map((log) => log.message).forEach((msg) => console.log(`[${panelId}] ${msg}`));
        }
      },
    });

    console.log(`[${panelId}] Grok result:`, JSON.stringify(result.data, null, 2));
    return await downloadAndSave(result.data, panelId, outputDir);
  } catch (error: unknown) {
    const errObj = error as any;
    console.error(`[${panelId}] Video generation error:`, JSON.stringify({
      message: errObj?.message,
      status: errObj?.status,
      body: errObj?.body,
      detail: errObj?.detail,
      name: errObj?.name,
      raw: String(error),
    }, null, 2));
    const message = errObj?.body?.detail || errObj?.message || String(error);
    return NextResponse.json({ error: message, panelId }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function downloadAndSave(data: any, panelId: string, outputDir: string) {
  const videoUrl = data?.video?.url;
  if (!videoUrl) {
    console.error(`[${panelId}] No video URL in response. Data:`, JSON.stringify(data, null, 2));
    return NextResponse.json({ error: "No video URL in response", panelId }, { status: 500 });
  }

  const response = await fetch(videoUrl);
  if (!response.ok) {
    return NextResponse.json({ error: `Failed to download video: ${response.status}`, panelId }, { status: 500 });
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const filename = `${panelId}-${crypto.randomBytes(4).toString("hex")}.mp4`;
  const downloadPath = path.join(outputDir, filename);
  fs.writeFileSync(downloadPath, buffer);

  const base64Video = buffer.toString("base64");
  console.log(`[${panelId}] Saved video: ${filename} (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);

  return NextResponse.json({
    panelId,
    videoData: base64Video,
    videoUrl: `/generated/${filename}`,
    mimeType: "video/mp4",
    status: "done",
  });
}
