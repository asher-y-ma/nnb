import {
  EnvHttpProxyAgent,
  fetch as undiciFetch,
  type Dispatcher,
  type Response as UndiciResponse,
} from "undici";

import { DEFAULT_GEMINI_BASE_URL } from "@/config/studio";

const geminiDispatcher: Dispatcher | undefined =
  process.env.HTTP_PROXY ||
  process.env.HTTPS_PROXY ||
  process.env.http_proxy ||
  process.env.https_proxy
    ? new EnvHttpProxyAgent()
    : undefined;

type GeminiRequestTextPart = {
  text: string;
};

type GeminiRequestInlineDataPart = {
  inline_data: {
    mime_type: string;
    data: string;
  };
};

export type GeminiRequestPart = GeminiRequestTextPart | GeminiRequestInlineDataPart;

export interface GeminiContent {
  role?: "user" | "model";
  parts: GeminiRequestPart[];
}

export interface GeminiGenerationConfig {
  candidateCount?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
  responseJsonSchema?: unknown;
  responseModalities?: string[];
  imageConfig?: {
    aspectRatio?: string;
    imageSize?: string;
  };
  thinkingConfig?: {
    thinkingLevel?: "minimal" | "high" | "Minimal" | "High";
    includeThoughts?: boolean;
  };
}

export interface GeminiGenerateContentRequest {
  contents: GeminiContent[];
  generationConfig?: GeminiGenerationConfig;
  tools?: unknown[];
  systemInstruction?: GeminiContent;
  store?: boolean;
}

export interface GeminiInlineData {
  mimeType?: string;
  data?: string;
}

export interface GeminiResponsePart {
  text?: string;
  thought?: boolean;
  inlineData?: GeminiInlineData;
  inline_data?: {
    mime_type?: string;
    data?: string;
  };
}

export interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiResponsePart[];
    };
    finishReason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
  usageMetadata?: Record<string, unknown>;
}

export class GeminiApiError extends Error {
  status?: number;
  details?: unknown;

  constructor(message: string, options?: { status?: number; details?: unknown; cause?: unknown }) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "GeminiApiError";
    this.status = options?.status;
    this.details = options?.details;
  }
}

export function createTextPart(text: string): GeminiRequestTextPart {
  return { text };
}

export function createInlineDataPart({
  mimeType,
  data,
}: {
  mimeType: string;
  data: string;
}): GeminiRequestInlineDataPart {
  return {
    inline_data: {
      mime_type: mimeType,
      data,
    },
  };
}

export function createUserContent(parts: GeminiRequestPart[]): GeminiContent {
  return {
    role: "user",
    parts,
  };
}

function extractErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const apiError = (payload as { error?: { message?: string; status?: string } }).error;
  if (apiError?.message) {
    return apiError.status
      ? `${apiError.message} (${apiError.status})`
      : apiError.message;
  }

  return fallback;
}

export function normalizeGeminiBaseUrl(input?: string) {
  const trimmed = (input || DEFAULT_GEMINI_BASE_URL).trim();
  if (!trimmed) {
    return `${DEFAULT_GEMINI_BASE_URL.replace(/\/+$/, "")}/v1beta`;
  }

  const normalized = trimmed.replace(/\/+$/, "");
  if (/\/v\d+(beta)?$/i.test(normalized)) {
    return normalized;
  }

  return `${normalized}/v1beta`;
}

export async function geminiGenerateContent({
  baseUrl,
  apiKey,
  model,
  body,
}: {
  baseUrl?: string;
  apiKey: string;
  model: string;
  body: GeminiGenerateContentRequest;
}) {
  const endpoint = `${normalizeGeminiBaseUrl(baseUrl)}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  let response: UndiciResponse;

  try {
    response = await undiciFetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      dispatcher: geminiDispatcher,
    });
  } catch (error) {
    throw new GeminiApiError("无法连接 Gemini 官方接口，请检查网络、代理或 API 域名访问。", {
      cause: error,
    });
  }

  const rawText = await response.text();
  let payload: unknown = null;

  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = rawText;
    }
  }

  if (!response.ok) {
    throw new GeminiApiError(
      extractErrorMessage(payload, `Gemini API 请求失败（HTTP ${response.status}）`),
      {
        status: response.status,
        details: payload,
      },
    );
  }

  if (!payload || typeof payload !== "object") {
    throw new GeminiApiError("Gemini 官方接口返回了空响应。");
  }

  return payload as GeminiGenerateContentResponse;
}

export function extractGeminiParts(response: GeminiGenerateContentResponse) {
  return (
    response.candidates?.flatMap((candidate) => candidate.content?.parts ?? []) ?? []
  );
}

export function extractGeminiText(response: GeminiGenerateContentResponse) {
  return extractGeminiParts(response)
    .filter((part) => !part.thought && part.text?.trim())
    .map((part) => part.text?.trim())
    .join("\n\n");
}

export function extractGeminiInlineData(part: GeminiResponsePart) {
  if (part.inlineData?.data) {
    return {
      mimeType: part.inlineData.mimeType ?? "image/png",
      data: part.inlineData.data,
    };
  }

  if (part.inline_data?.data) {
    return {
      mimeType: part.inline_data.mime_type ?? "image/png",
      data: part.inline_data.data,
    };
  }

  return null;
}
