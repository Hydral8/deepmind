import { NextRequest, NextResponse } from "next/server";
import { getGeminiClient } from "@/lib/gemini";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { panelId, visualPrompt, duration } = body as {
    panelId: string;
    visualPrompt: string;
    duration: number;
  };

  try {
    const ai = getGeminiClient();

    // Generate video using Veo via Gemini API
    const response = await ai.models.generateVideos({
      model: "veo-2.0-generate-001",
      prompt: visualPrompt,
      config: {
        aspectRatio: "16:9",
        numberOfVideos: 1,
        durationSeconds: Math.min(duration, 8),
      },
    });

    // Poll for completion
    let operation = response;
    while (!operation.done) {
      await new Promise((r) => setTimeout(r, 5000));
      operation = await ai.operations.get({ operation });
    }

    // Get the generated video
    const generatedVideos = operation.response?.generatedVideos || [];
    if (generatedVideos.length === 0) {
      return NextResponse.json(
        { error: "No video generated", panelId },
        { status: 500 }
      );
    }

    const video = generatedVideos[0];

    // Download to a temp file in public/generated
    const outputDir = path.join(process.cwd(), "public", "generated");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `${panelId}-${crypto.randomBytes(4).toString("hex")}.mp4`;
    const downloadPath = path.join(outputDir, filename);

    await ai.files.download({
      file: video.video!,
      downloadPath,
    });

    // Read the file and convert to base64 for inline playback
    const fileBuffer = fs.readFileSync(downloadPath);
    const base64Video = fileBuffer.toString("base64");

    return NextResponse.json({
      panelId,
      videoData: base64Video,
      videoUrl: `/generated/${filename}`,
      mimeType: "video/mp4",
      status: "done",
    });
  } catch (error: unknown) {
    console.error("Video generation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message, panelId },
      { status: 500 }
    );
  }
}
