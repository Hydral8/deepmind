import { NextRequest, NextResponse } from "next/server";
import { getGeminiClient } from "@/lib/gemini";
import { ChatMessage, ExtractedAssets } from "@/lib/types";
import { buildChatSystemPrompt } from "@/lib/prompts";

export async function POST(req: NextRequest) {
  try {
    const { messages, assets, branchType } = (await req.json()) as {
      messages: ChatMessage[];
      assets: ExtractedAssets;
      branchType: string;
    };

    const ai = getGeminiClient();

    const systemPrompt = buildChatSystemPrompt(assets, branchType);

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
