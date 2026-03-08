import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

export async function POST(req: NextRequest) {
  try {
    const { videoPath, timestamp, branchId, panelId, position } = (await req.json()) as {
      videoPath: string;
      timestamp: number;
      branchId: string;
      panelId: string;
      position: "start" | "end";
    };

    const absVideoPath = path.join(process.cwd(), "public", videoPath);
    if (!fs.existsSync(absVideoPath)) {
      return NextResponse.json({ error: "Video file not found" }, { status: 404 });
    }

    const outputDir = path.join(process.cwd(), "public", "branches", "images", branchId);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `${panelId}-${position}-extracted.jpg`;
    const outputPath = path.join(outputDir, filename);

    execSync(
      `ffmpeg -y -ss ${timestamp} -i "${absVideoPath}" -frames:v 1 -q:v 2 "${outputPath}" 2>/dev/null`,
      { timeout: 10000 }
    );

    if (!fs.existsSync(outputPath)) {
      return NextResponse.json({ error: "Frame extraction failed" }, { status: 500 });
    }

    const imagePath = `/branches/images/${branchId}/${filename}`;
    return NextResponse.json({ imagePath, timestamp });
  } catch (error: unknown) {
    console.error("Frame extraction error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
