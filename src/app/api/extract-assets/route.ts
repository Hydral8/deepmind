import { NextRequest, NextResponse } from "next/server";
import { getGeminiClient } from "@/lib/gemini";
import { ExtractedAssets } from "@/lib/types";
import { buildAssetExtractionPrompt, buildAssetVerificationPrompt } from "@/lib/prompts";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

function getAssetKey(videoPath: string): string {
  return videoPath.replace(/^\//, "").replace(/\//g, "--").replace(/\.mp4$/, "");
}

function getCachePath(videoPath: string): string {
  return path.join(process.cwd(), "public", "assets", `${getAssetKey(videoPath)}.json`);
}

function extractFrame(videoAbsPath: string, timestamp: number, outputPath: string) {
  // Never use 0 - first frames are often black/fades
  const ts = Math.max(2, timestamp);
  try {
    execSync(
      `ffmpeg -y -ss ${ts} -i "${videoAbsPath}" -frames:v 1 -q:v 2 "${outputPath}" 2>/dev/null`,
      { timeout: 15000 }
    );
  } catch {
    // If exact timestamp fails, try 3s in as safe fallback
    try {
      execSync(
        `ffmpeg -y -ss 3 -i "${videoAbsPath}" -frames:v 1 -q:v 2 "${outputPath}" 2>/dev/null`,
        { timeout: 15000 }
      );
    } catch {
      // Give up silently
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { videoPath, showTitle, episodeTitle } = await req.json();

    if (!videoPath) {
      return NextResponse.json({ error: "videoPath required" }, { status: 400 });
    }

    // Check local cache first
    const cachePath = getCachePath(videoPath);
    if (fs.existsSync(cachePath)) {
      const cached = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
      return NextResponse.json({ assets: cached, cached: true });
    }

    const ai = getGeminiClient();
    const assetKey = getAssetKey(videoPath);

    // Resolve the video file from public directory
    const absolutePath = path.join(process.cwd(), "public", videoPath);
    if (!fs.existsSync(absolutePath)) {
      return NextResponse.json(
        { error: `Video not found at ${videoPath}` },
        { status: 404 }
      );
    }

    // Upload the video file to Gemini
    const videoFile = await ai.files.upload({
      file: absolutePath,
      config: { mimeType: "video/mp4" },
    });

    // Wait for file processing
    let file = await ai.files.get({ name: videoFile.name! });
    while (file.state === "PROCESSING") {
      await new Promise((r) => setTimeout(r, 2000));
      file = await ai.files.get({ name: file.name! });
    }

    if (file.state === "FAILED") {
      return NextResponse.json(
        { error: "Video processing failed" },
        { status: 500 }
      );
    }

    // Extract assets using Gemini - now including timestamps for frame extraction
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [
        {
          role: "user",
          parts: [
            {
              fileData: {
                fileUri: file.uri!,
                mimeType: "video/mp4",
              },
            },
            {
              text: buildAssetExtractionPrompt(showTitle, episodeTitle),
            },
          ],
        },
      ],
    });

    const text = response.text?.trim() || "";
    const cleaned = text.replace(/^```json?\s*/, "").replace(/\s*```$/, "");
    const assets: ExtractedAssets = JSON.parse(cleaned);

    // Extract frames using ffmpeg
    const imagesDir = path.join(process.cwd(), "public", "assets", "images", assetKey);
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    // Extract character frames
    for (let i = 0; i < assets.characters.length; i++) {
      const c = assets.characters[i];
      const filename = `char-${i}.jpg`;
      const outputPath = path.join(imagesDir, filename);
      extractFrame(absolutePath, c.bestTimestamp || 2, outputPath);
      if (fs.existsSync(outputPath)) {
        assets.characters[i].imagePath = `/assets/images/${assetKey}/${filename}`;
      }
    }

    // Extract environment frames
    for (let i = 0; i < assets.environments.length; i++) {
      const e = assets.environments[i];
      const filename = `env-${i}.jpg`;
      const outputPath = path.join(imagesDir, filename);
      extractFrame(absolutePath, e.bestTimestamp || 2, outputPath);
      if (fs.existsSync(outputPath)) {
        assets.environments[i].imagePath = `/assets/images/${assetKey}/${filename}`;
      }
    }

    // Extract object frames
    for (let i = 0; i < assets.objects.length; i++) {
      const o = assets.objects[i];
      const filename = `obj-${i}.jpg`;
      const outputPath = path.join(imagesDir, filename);
      extractFrame(absolutePath, o.bestTimestamp || 2, outputPath);
      if (fs.existsSync(outputPath)) {
        assets.objects[i].imagePath = `/assets/images/${assetKey}/${filename}`;
      }
    }

    // ── Verification pass: use the video to verify character timestamps ──
    // Re-use the already-uploaded video file to ask Gemini to verify
    const charSummary = assets.characters.map((c, i) => (
      `[${i}] "${c.name}" at ${c.bestTimestamp}s — expected: ${c.description}`
    )).join("\n");

    const verifyResponse = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [
        {
          role: "user",
          parts: [
            {
              fileData: {
                fileUri: file.uri!,
                mimeType: "video/mp4",
              },
            },
            {
              text: buildAssetVerificationPrompt(showTitle, charSummary),
            },
          ],
        },
      ],
    });

    const verifyText = (verifyResponse.text?.trim() || "")
      .replace(/^```json?\s*/, "")
      .replace(/\s*```$/, "");

    try {
      const fixes: Array<{ index: number; correct: boolean; reason?: string; suggestedTimestamp?: number }> = JSON.parse(verifyText);

      for (const fix of fixes) {
        if (!fix.correct && fix.suggestedTimestamp && fix.index < assets.characters.length) {
          const i = fix.index;
          const filename = `char-${i}.jpg`;
          const outputPath = path.join(imagesDir, filename);
          console.log(`Re-extracting char ${i} (${assets.characters[i].name}): ${fix.reason} -> trying ${fix.suggestedTimestamp}s`);
          extractFrame(absolutePath, fix.suggestedTimestamp, outputPath);
          assets.characters[i].bestTimestamp = fix.suggestedTimestamp;
        }
      }
    } catch {
      // Verification parse failed, keep original frames
    }

    // Cache locally
    const assetsDir = path.dirname(cachePath);
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }
    fs.writeFileSync(cachePath, JSON.stringify(assets, null, 2));

    // Clean up uploaded file
    await ai.files.delete({ name: file.name! }).catch(() => {});

    return NextResponse.json({ assets });
  } catch (error: unknown) {
    console.error("Asset extraction error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
