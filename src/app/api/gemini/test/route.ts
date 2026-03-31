import { z } from "zod";

import {
  createTextPart,
  createUserContent,
  extractGeminiText,
  geminiGenerateContent,
} from "@/lib/gemini/rest-client";

export const runtime = "nodejs";

const schema = z.object({
  baseUrl: z.string().min(1),
  apiKey: z.string().min(1),
  model: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());

    const response = await geminiGenerateContent({
      baseUrl: body.baseUrl,
      apiKey: body.apiKey,
      model: body.model,
      body: {
        contents: [createUserContent([createTextPart("Reply with exactly: Gemini connection ok")])],
        generationConfig: {
          maxOutputTokens: 24,
        },
      },
    });

    return Response.json({
      ok: true,
      text: extractGeminiText(response),
    });
  } catch (error) {
    const status =
      error instanceof z.ZodError ? 400 : (error as { status?: number })?.status ?? 500;

    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "测试失败",
      },
      { status },
    );
  }
}
