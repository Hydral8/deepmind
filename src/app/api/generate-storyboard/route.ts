import { NextRequest, NextResponse } from "next/server";
import { getGeminiClient } from "@/lib/gemini";
import { ChatMessage, ExtractedAssets, Storyboard } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { messages, assets, branchType } = (await req.json()) as {
      messages: ChatMessage[];
      assets: ExtractedAssets;
      branchType: string;
    };

    const ai = getGeminiClient();

    const conversationSummary = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const prompt = `Based on the following conversation about creating an alternate ${branchType}, generate a detailed storyboard.

CONVERSATION:
${conversationSummary}

AVAILABLE ASSETS:
Characters: ${JSON.stringify(assets.characters.map((c) => ({ name: c.name, description: c.description, multiview: c.multiviewDescription })))}
Environments: ${JSON.stringify(assets.environments)}
Camera style: ${JSON.stringify(assets.cameraStyle)}
Series tone: ${assets.seriesContext.tone}
Genre: ${assets.seriesContext.genre}

Generate a storyboard as JSON with 3-6 panels. Each panel should have a detailed visual prompt suitable for a video generation model like Veo. The visual prompt must describe the exact visual content WITHOUT referencing character names - instead describe their appearance.

{
  "title": "title for this alternate branch",
  "panels": [
    {
      "id": "panel-1",
      "order": 1,
      "sceneDescription": "what happens in this panel narratively",
      "cameraAngle": "specific camera angle (e.g. close-up, wide shot, over-the-shoulder)",
      "cameraMovement": "camera movement (e.g. slow push in, static, tracking left)",
      "characters": ["character names present"],
      "dialogue": "any dialogue in this panel",
      "environment": "setting description",
      "mood": "emotional tone",
      "duration": 5,
      "visualPrompt": "A highly detailed prompt for video generation. Describe the visual scene completely: character appearances (not names), actions, environment, lighting, camera angle, movement, color grading. Match the style: ${assets.cameraStyle.colorGrading}, ${assets.cameraStyle.visualTone}. Do NOT use character names, describe them by appearance."
    }
  ],
  "musicPrompt": "description of the background music mood and style",
  "totalDuration": 20
}

Return ONLY valid JSON, no markdown fences.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const text = response.text?.trim() || "";
    const cleaned = text.replace(/^```json?\s*/, "").replace(/\s*```$/, "");
    const storyboard: Storyboard = JSON.parse(cleaned);

    // Ensure IDs exist
    storyboard.panels = storyboard.panels.map((p, i) => ({
      ...p,
      id: p.id || `panel-${i + 1}`,
      order: i + 1,
    }));

    return NextResponse.json({ storyboard });
  } catch (error: unknown) {
    console.error("Storyboard error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
