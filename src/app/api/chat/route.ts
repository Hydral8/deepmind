import { NextRequest, NextResponse } from "next/server";
import { getGeminiClient } from "@/lib/gemini";
import { ChatMessage, ExtractedAssets } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { messages, assets, branchType } = (await req.json()) as {
      messages: ChatMessage[];
      assets: ExtractedAssets;
      branchType: string;
    };

    const ai = getGeminiClient();

    const characterList = assets.characters
      .map((c) => `- ${c.name}: ${c.description} (${c.role})`)
      .join("\n");
    const envList = assets.environments
      .map((e) => `- ${e.name}: ${e.description}`)
      .join("\n");

    const systemPrompt = `You are a creative writing assistant helping a user create an alternate ${branchType} for a TV show/movie scene.

Here are the extracted assets from the original scene:

CHARACTERS:
${characterList}

ENVIRONMENTS:
${envList}

PLOT CONTEXT:
${assets.plot.summary}
Current arc: ${assets.plot.currentArc}
Themes: ${assets.plot.themes.join(", ")}

SERIES CONTEXT:
Genre: ${assets.seriesContext.genre}
Era: ${assets.seriesContext.era}
World rules: ${assets.seriesContext.worldRules}
Tone: ${assets.seriesContext.tone}

CAMERA STYLE:
Angles: ${assets.cameraStyle.commonAngles.join(", ")}
Movement: ${assets.cameraStyle.movementStyle}
Color grading: ${assets.cameraStyle.colorGrading}
Visual tone: ${assets.cameraStyle.visualTone}

Your job is to have a multi-turn conversation with the user to understand exactly what alternate scene they want to create. Ask clarifying questions about:
1. What they want to change and why
2. Which characters should be involved
3. The tone and mood they're going for
4. Key moments or dialogue they envision
5. How it should end

Keep responses concise (2-4 sentences + a focused question). After 2-3 exchanges when you have enough detail, tell the user you have enough information and suggest they proceed to storyboard generation. End that message with: "[READY_FOR_STORYBOARD]"

Stay in character with the series' tone. Reference specific characters and plot points from the assets.`;

    const contents = [
      { role: "user" as const, parts: [{ text: systemPrompt }] },
      {
        role: "model" as const,
        parts: [
          {
            text: "Understood. I'll help the user create their alternate scene based on these assets. I'll ask focused questions to flesh out their vision.",
          },
        ],
      },
      ...messages.map((m) => ({
        role: (m.role === "user" ? "user" : "model") as "user" | "model",
        parts: [{ text: m.content }],
      })),
    ];

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents,
    });

    const text = response.text || "";
    const readyForStoryboard = text.includes("[READY_FOR_STORYBOARD]");
    const cleanText = text.replace("[READY_FOR_STORYBOARD]", "").trim();

    return NextResponse.json({
      message: cleanText,
      readyForStoryboard,
    });
  } catch (error: unknown) {
    console.error("Chat error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
