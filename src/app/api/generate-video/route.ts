import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

export const maxDuration = 300;

fal.config({ credentials: process.env.FAL_KEY });

type VideoModel = "grok" | "kling";

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

function logQueue(panelId: string) {
  return {
    logs: true as const,
    onQueueUpdate: (update: any) => {
      console.log(`[${panelId}] Queue: ${update.status}`);
      if (update.status === "IN_PROGRESS" && update.logs) {
        update.logs.map((log: any) => log.message).forEach((msg: string) => console.log(`[${panelId}] ${msg}`));
      }
    },
  };
}

// ── Grok Imagine Video ──
async function generateWithGrok(
  panelId: string,
  visualPrompt: string,
  duration: number,
  firstFrameUrl: string | null,
) {
  if (firstFrameUrl) {
    console.log(`[${panelId}] Grok Imagine: image-to-video (start frame only)`);
    return await fal.subscribe("xai/grok-imagine-video/image-to-video", {
      input: {
        prompt: visualPrompt,
        image_url: firstFrameUrl,
        duration: Math.min(duration, 10),
        aspect_ratio: "16:9",
        resolution: "720p",
      },
      ...logQueue(panelId),
    });
  }

  console.log(`[${panelId}] Grok Imagine: text-to-video`);
  return await fal.subscribe("xai/grok-imagine-video/text-to-video", {
    input: {
      prompt: visualPrompt,
      duration: Math.min(duration, 10),
      aspect_ratio: "16:9",
      resolution: "720p",
    },
    ...logQueue(panelId),
  });
}

// ── Kling 3.0 (supports start + end frames, 3-15s) ──
async function generateWithKling(
  panelId: string,
  visualPrompt: string,
  duration: number,
  firstFrameUrl: string | null,
  lastFrameUrl: string | null,
) {
  const clampedDuration = String(Math.max(3, Math.min(duration, 15)));

  if (firstFrameUrl && lastFrameUrl) {
    console.log(`[${panelId}] Kling 3.0: start+end frame interpolation (${clampedDuration}s)`);
    return await fal.subscribe("fal-ai/kling-video/v3/standard/image-to-video", {
      input: {
        prompt: visualPrompt,
        start_image_url: firstFrameUrl,
        end_image_url: lastFrameUrl,
        duration: clampedDuration,
        aspect_ratio: "16:9",
      },
      ...logQueue(panelId),
    });
  }

  if (firstFrameUrl) {
    console.log(`[${panelId}] Kling 3.0: start frame only (${clampedDuration}s)`);
    return await fal.subscribe("fal-ai/kling-video/v3/standard/image-to-video", {
      input: {
        prompt: visualPrompt,
        start_image_url: firstFrameUrl,
        duration: clampedDuration,
        aspect_ratio: "16:9",
      },
      ...logQueue(panelId),
    });
  }

  // No frames, fall back to Grok text-to-video
  console.log(`[${panelId}] No frames provided, falling back to Grok text-to-video`);
  return await generateWithGrok(panelId, visualPrompt, duration, null);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    panelId,
    visualPrompt,
    duration,
    firstFramePath,
    lastFramePath,
    model = "grok",
  } = body as {
    panelId: string;
    visualPrompt: string;
    duration: number;
    firstFramePath?: string;
    lastFramePath?: string;
    model?: VideoModel;
  };

  try {
    const outputDir = path.join(process.cwd(), "public", "generated");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Upload frames in parallel
    const [firstFrameUrl, lastFrameUrl] = await Promise.all([
      firstFramePath ? uploadImageToFal(firstFramePath) : null,
      lastFramePath ? uploadImageToFal(lastFramePath) : null,
    ]);

    let result;
    if (model === "kling") {
      result = await generateWithKling(panelId, visualPrompt, duration, firstFrameUrl, lastFrameUrl);
    } else {
      result = await generateWithGrok(panelId, visualPrompt, duration, firstFrameUrl);
    }

    console.log(`[${panelId}] ${model} result:`, JSON.stringify(result.data, null, 2));
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
