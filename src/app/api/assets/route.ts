import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

const ASSETS_DIR = path.join(process.cwd(), "public", "assets");

// GET: list all cached assets
export async function GET() {
  try {
    if (!fs.existsSync(ASSETS_DIR)) {
      return NextResponse.json({ assets: [] });
    }

    const files = fs.readdirSync(ASSETS_DIR).filter((f) => f.endsWith(".json"));
    const assets = files.map((filename) => {
      const content = JSON.parse(
        fs.readFileSync(path.join(ASSETS_DIR, filename), "utf-8")
      );
      // Derive video path from filename: "movies--got--got_daenaerys_dies.json" -> "/movies/got/got_daenaerys_dies.mp4"
      const videoPath =
        "/" + filename.replace(".json", "").replace(/--/g, "/") + ".mp4";
      return {
        filename,
        videoPath,
        data: content,
      };
    });

    return NextResponse.json({ assets });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT: update a cached asset file
export async function PUT(req: NextRequest) {
  try {
    const { filename, data } = await req.json();

    if (!filename || !data) {
      return NextResponse.json(
        { error: "filename and data required" },
        { status: 400 }
      );
    }

    const filePath = path.join(ASSETS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: "Asset file not found" },
        { status: 404 }
      );
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE: remove a cached asset
export async function DELETE(req: NextRequest) {
  try {
    const { filename } = await req.json();
    const filePath = path.join(ASSETS_DIR, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
