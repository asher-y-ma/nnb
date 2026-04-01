import type { Content as SdkContent, Part as SdkPart } from "@google/genai";
import {
  EnvHttpProxyAgent,
  fetch as undiciFetch,
  type Dispatcher,
  type Response as UndiciResponse,
} from "undici";

import {
  DEFAULT_GEMINI_BASE_URL,
  isBudgetStudioImageModel,
} from "@/config/studio";

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
  /** 閮ㄥ垎缃戝叧鍦?1K 绛夊垎杈ㄧ巼涓嬭繑鍥炲彲涓嬭浇鍦板潃鑰岄潪 base64 */
  url?: string;
}

export interface GeminiResponsePart {
  text?: string;
  thought?: boolean;
  inlineData?: GeminiInlineData;
  inline_data?: {
    mime_type?: string;
    data?: string;
    url?: string;
  };
  fileData?: {
    fileUri?: string;
    file_uri?: string;
    mimeType?: string;
    mime_type?: string;
  };
  file_data?: {
    fileUri?: string;
    file_uri?: string;
    mimeType?: string;
    mime_type?: string;
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

export interface GeminiTraceContext {
  requestId?: string;
  operation?: string;
}

function logGemini(
  level: "info" | "warn" | "error",
  trace: GeminiTraceContext | undefined,
  message: string,
  payload?: Record<string, unknown>,
) {
  const prefix = `[gemini:${trace?.requestId ?? "no-trace"}] ${trace?.operation ?? "request"} ${message}`;
  const logger =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : console.info;

  if (payload) {
    logger(prefix, payload);
    return;
  }

  logger(prefix);
}

function summarizeGeminiRequest(body: GeminiGenerateContentRequest) {
  let textParts = 0;
  let inlineImageParts = 0;

  for (const content of body.contents) {
    for (const part of content.parts) {
      if ("text" in part && typeof part.text === "string" && part.text.trim()) {
        textParts += 1;
      }

      if ("inline_data" in part && part.inline_data?.data) {
        inlineImageParts += 1;
      }
    }
  }

  return {
    contentCount: body.contents.length,
    textParts,
    inlineImageParts,
    candidateCount: body.generationConfig?.candidateCount ?? 1,
    responseMimeType: body.generationConfig?.responseMimeType,
    responseModalities: body.generationConfig?.responseModalities ?? [],
    imageConfig: body.generationConfig?.imageConfig ?? null,
    hasTools: Boolean(body.tools?.length),
    hasSystemInstruction: Boolean(body.systemInstruction),
  };
}

function summarizeGeminiResponse(response: GeminiGenerateContentResponse) {
  const parts = response.candidates?.flatMap((candidate) => candidate.content?.parts ?? []) ?? [];

  return {
    candidates: response.candidates?.length ?? 0,
    finishReasons: response.candidates?.map((candidate) => candidate.finishReason ?? "unknown") ?? [],
    partCount: parts.length,
    textParts: parts.filter((part) => Boolean(part.text?.trim()) && !part.thought).length,
    thoughtParts: parts.filter((part) => Boolean(part.thought)).length,
    inlineImageParts: parts.filter((part) => Boolean(part.inlineData?.data || part.inline_data?.data)).length,
    inlineUrlParts: parts.filter((part) => Boolean(part.inlineData?.url || part.inline_data?.url)).length,
    fileParts: parts.filter((part) => Boolean(part.fileData || part.file_data)).length,
    blockReason: response.promptFeedback?.blockReason,
    usageMetadata: response.usageMetadata ?? null,
  };
}

function summarizeImageUrl(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.slice(0, 160);
  }
}

function shouldPreferStreamGenerateContent(model: string, body: GeminiGenerateContentRequest) {
  const wantsImage =
    body.generationConfig?.responseModalities?.includes("IMAGE") ?? false;

  return isBudgetStudioImageModel(model) && wantsImage;
}

function buildGeminiEndpoint({
  baseUrl,
  model,
  apiKey,
  stream,
}: {
  baseUrl?: string;
  model: string;
  apiKey: string;
  stream: boolean;
}) {
  const action = stream ? "streamGenerateContent" : "generateContent";
  const endpoint = `${normalizeGeminiBaseUrl(baseUrl)}/models/${encodeURIComponent(model)}:${action}?key=${encodeURIComponent(apiKey)}`;
  return stream ? `${endpoint}&alt=sse` : endpoint;
}

function parseSsePayload(rawText: string) {
  const events: string[] = [];
  let current = "";

  for (const line of rawText.split(/\r?\n/)) {
    if (!line.trim()) {
      if (current.trim()) {
        events.push(current.trim());
        current = "";
      }
      continue;
    }

    if (line.startsWith("data:")) {
      current += line.slice(5).trimStart();
    }
  }

  if (current.trim()) {
    events.push(current.trim());
  }

  return events
    .map((entry) => entry.trim())
    .filter((entry) => entry && entry !== "[DONE]");
}

function mergeStreamResponses(
  chunks: GeminiGenerateContentResponse[],
): GeminiGenerateContentResponse {
  const candidates = new Map<
    number,
    NonNullable<GeminiGenerateContentResponse["candidates"]>[number]
  >();

  for (const chunk of chunks) {
    chunk.candidates?.forEach((candidate, index) => {
      const existing = candidates.get(index);
      if (!existing) {
        candidates.set(index, {
          ...candidate,
          content: {
            ...candidate.content,
            parts: [...(candidate.content?.parts ?? [])],
          },
        });
        return;
      }

      existing.finishReason = candidate.finishReason ?? existing.finishReason;
      existing.content = {
        ...existing.content,
        ...candidate.content,
        parts: [
          ...(existing.content?.parts ?? []),
          ...(candidate.content?.parts ?? []),
        ],
      };
    });
  }

  const lastChunk = chunks[chunks.length - 1];

  return {
    candidates: [...candidates.values()],
    promptFeedback: lastChunk?.promptFeedback,
    usageMetadata: lastChunk?.usageMetadata,
  };
}

function shouldFallbackFromSdkStream(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  return (
    normalized.includes("failed to exchange jwt for access token") ||
    normalized.includes("failed to get access token") ||
    normalized.includes("invalid_grant") ||
    normalized.includes("account not found")
  );
}

function normalizeGeminiSdkBaseUrl(input?: string) {
  const trimmed = (input || DEFAULT_GEMINI_BASE_URL).trim();
  if (!trimmed) {
    return DEFAULT_GEMINI_BASE_URL.replace(/\/+$/, "");
  }

  return trimmed
    .replace(/\/+$/, "")
    .replace(/\/v\d+(beta)?$/i, "");
}

function toSdkPart(part: GeminiRequestPart): SdkPart {
  if ("text" in part) {
    return { text: part.text };
  }

  return {
    inlineData: {
      mimeType: part.inline_data.mime_type,
      data: part.inline_data.data,
    },
  };
}

function toSdkContent(content: GeminiContent): SdkContent {
  return {
    role: content.role,
    parts: content.parts.map(toSdkPart),
  };
}

function toGeminiResponsePart(part: SdkPart): GeminiResponsePart {
  if (part.text !== undefined) {
    return {
      text: part.text,
      thought: Boolean((part as { thought?: boolean }).thought),
    };
  }

  if ((part as { inlineData?: { mimeType?: string; data?: string } }).inlineData) {
    const inline = (part as { inlineData?: { mimeType?: string; data?: string } }).inlineData;
    return {
      inlineData: {
        mimeType: inline?.mimeType,
        data: inline?.data,
      },
      thought: Boolean((part as { thought?: boolean }).thought),
    };
  }

  if ((part as { fileData?: { mimeType?: string; fileUri?: string } }).fileData?.fileUri) {
    const file = (part as { fileData?: { mimeType?: string; fileUri?: string } }).fileData;
    return {
      fileData: {
        mimeType: file?.mimeType,
        fileUri: file?.fileUri,
      },
      thought: Boolean((part as { thought?: boolean }).thought),
    };
  }

  return {};
}

async function geminiGenerateContentViaSdk({
  baseUrl,
  apiKey,
  model,
  body,
  trace,
}: {
  baseUrl?: string;
  apiKey: string;
  model: string;
  body: GeminiGenerateContentRequest;
  trace?: GeminiTraceContext;
}): Promise<GeminiGenerateContentResponse> {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      baseUrl: normalizeGeminiSdkBaseUrl(baseUrl),
    },
  });

  const sdkRequest = {
    model,
    contents: body.contents.map(toSdkContent),
    config: body.generationConfig,
    tools: body.tools,
    systemInstruction: body.systemInstruction
      ? toSdkContent(body.systemInstruction)
      : undefined,
  };

  const startedAt = Date.now();
  logGemini("info", trace, "sdk-stream:start", {
    model,
    endpointBaseUrl: normalizeGeminiSdkBaseUrl(baseUrl),
    request: summarizeGeminiRequest(body),
  });

  try {
    const responseStream = await ai.models.generateContentStream(
      sdkRequest as Parameters<typeof ai.models.generateContentStream>[0],
    );
    const chunks: GeminiGenerateContentResponse[] = [];

    for await (const chunk of responseStream) {
      chunks.push({
        candidates:
          chunk.candidates?.map((candidate) => ({
            finishReason: candidate.finishReason,
            content: {
              parts: candidate.content?.parts?.map(toGeminiResponsePart) ?? [],
            },
          })) ?? [],
        promptFeedback: chunk.promptFeedback
          ? {
              blockReason: chunk.promptFeedback.blockReason,
            }
          : undefined,
        usageMetadata: chunk.usageMetadata as Record<string, unknown> | undefined,
      });
    }

    const merged = mergeStreamResponses(chunks);

    logGemini("info", trace, "sdk-stream:success", {
      model,
      durationMs: Date.now() - startedAt,
      response: summarizeGeminiResponse(merged),
    });

    return merged;
  } catch (error) {
    logGemini("error", trace, "sdk-stream:error", {
      model,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

const URL_IN_TEXT_RE = /https?:\/\/[^\s<>"']+/gi;

function trimTrailingUrlPunctuation(url: string) {
  return url.replace(/[)\].,;]+$/g, "");
}

function isLikelyDirectImageUrl(url: string) {
  const normalized = trimTrailingUrlPunctuation(url).toLowerCase();
  if (!normalized.startsWith("http")) {
    return false;
  }

  if (
    normalized.includes("storage.googleapis.com") ||
    normalized.includes("googleusercontent.com") ||
    normalized.includes("gstatic.com") ||
    normalized.includes("generativelanguage.googleapis.com") ||
    normalized.includes("ai-sandbox") ||
    normalized.includes("/image/") ||
    /\.(png|jpe?g|webp|gif|bmp)(\?|$)/i.test(normalized)
  ) {
    return true;
  }

  return false;
}

function extractImageUrlsFromText(text: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(URL_IN_TEXT_RE)) {
    const raw = match[0];
    const normalized = trimTrailingUrlPunctuation(raw);
    if (!isLikelyDirectImageUrl(normalized) || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    urls.push(normalized);
  }

  return urls;
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

function formatGeminiHttpError(status: number, payload: unknown) {
  const rawMessage = extractErrorMessage(
    payload,
    `Gemini API request failed (HTTP ${status}).`,
  );

  switch (status) {
    case 400:
      return `Gemini request parameters are invalid. ${rawMessage}`;
    case 401:
      return `Gemini API key is invalid or expired. ${rawMessage}`;
    case 403:
      return `Gemini access was denied. Check the gateway, account status, or model permissions. ${rawMessage}`;
    case 404:
      return `The requested Gemini model or API path was not found. ${rawMessage}`;
    case 429:
      return `Gemini rate limit was reached. Please retry a bit later. ${rawMessage}`;
    case 500:
      return `Gemini server encountered an internal error. ${rawMessage}`;
    case 503:
      return `Gemini service is temporarily unavailable. ${rawMessage}`;
    default:
      return rawMessage;
  }
}

function normalizeGeminiImageParts(parts: GeminiResponsePart[]) {
  const existingUris = new Set(
    parts
      .map((part) => {
        const fileRef = extractGeminiFileUriPart(part);
        return fileRef ? trimTrailingUrlPunctuation(fileRef.uri) : null;
      })
      .filter((value): value is string => Boolean(value)),
  );

  const withPromotedTextUrls: GeminiResponsePart[] = [];

  for (const part of parts) {
    if (part.thought || !part.text) {
      withPromotedTextUrls.push(part);
      continue;
    }

    const urls = extractImageUrlsFromText(part.text);
    if (urls.length === 0) {
      withPromotedTextUrls.push(part);
      continue;
    }

    let cleanedText = part.text;
    for (const url of urls) {
      cleanedText = cleanedText.replace(url, " ");
    }
    cleanedText = cleanedText.replace(/\s{2,}/g, " ").trim();

    if (cleanedText) {
      withPromotedTextUrls.push({
        ...part,
        text: cleanedText,
      });
    }

    for (const url of urls) {
      const normalized = trimTrailingUrlPunctuation(url);
      if (existingUris.has(normalized)) {
        continue;
      }

      existingUris.add(normalized);
      withPromotedTextUrls.push({
        fileData: {
          fileUri: normalized,
          mimeType: "image/png",
        },
      });
    }
  }

  const duplicateTextFiltered = withPromotedTextUrls.filter((part) => {
    if (!part.text?.trim()) {
      return true;
    }

    const text = trimTrailingUrlPunctuation(part.text.trim());
    return !existingUris.has(text);
  });

  const hasInlineImageData = duplicateTextFiltered.some(
    (part) => !part.thought && Boolean(extractGeminiInlineData(part)?.data),
  );

  if (!hasInlineImageData) {
    return duplicateTextFiltered;
  }

  return duplicateTextFiltered.filter((part) => {
    if (part.thought) {
      return true;
    }

    if (extractGeminiInlineData(part)?.data) {
      return true;
    }

    if (extractGeminiInlineImageUrl(part) || extractGeminiFileUriPart(part)) {
      return false;
    }

    return true;
  });
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
  trace,
}: {
  baseUrl?: string;
  apiKey: string;
  model: string;
  body: GeminiGenerateContentRequest;
  trace?: GeminiTraceContext;
}) {
  const useStreamEndpoint = shouldPreferStreamGenerateContent(model, body);
  if (useStreamEndpoint) {
    try {
      return await geminiGenerateContentViaSdk({
        baseUrl,
        apiKey,
        model,
        body,
        trace,
      });
    } catch (error) {
      if (!shouldFallbackFromSdkStream(error)) {
        throw error;
      }

      logGemini("warn", trace, "sdk-stream:fallback-to-http-stream", {
        model,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const endpoint = buildGeminiEndpoint({
    baseUrl,
    model,
    apiKey,
    stream: useStreamEndpoint,
  });
  const startedAt = Date.now();

  logGemini("info", trace, "request:start", {
    model,
    endpointType: useStreamEndpoint ? "streamGenerateContent" : "generateContent",
    endpoint: endpoint.replace(/([?&]key=)[^&]+/, "$1***"),
    request: summarizeGeminiRequest(body),
  });

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
    logGemini("error", trace, "request:network-error", {
      model,
      endpoint: endpoint.replace(/([?&]key=)[^&]+/, "$1***"),
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new GeminiApiError("Unable to reach the Gemini API endpoint. Please check the network, proxy, or API base URL.", {
      cause: error,
    });
  }

  const rawText = await response.text();
  let payload: unknown = null;

  if (rawText) {
    try {
      if (useStreamEndpoint) {
        const chunks = parseSsePayload(rawText).map((entry) =>
          JSON.parse(entry) as GeminiGenerateContentResponse,
        );
        payload = chunks.length > 0 ? mergeStreamResponses(chunks) : null;
      } else {
        payload = JSON.parse(rawText);
      }
    } catch {
      payload = rawText;
    }
  }

  if (!response.ok) {
    logGemini("warn", trace, "request:http-error", {
      model,
      status: response.status,
      durationMs: Date.now() - startedAt,
      details: payload,
    });
    throw new GeminiApiError(
      formatGeminiHttpError(response.status, payload),
      {
        status: response.status,
        details: payload,
      },
    );
  }

  if (!payload || typeof payload !== "object") {
    logGemini("warn", trace, "request:empty-response", {
      model,
      durationMs: Date.now() - startedAt,
    });
    throw new GeminiApiError("Gemini returned an empty response.");
  }

  const responsePayload = payload as GeminiGenerateContentResponse;

  if (responsePayload.promptFeedback?.blockReason) {
    logGemini("warn", trace, "request:blocked", {
      model,
      durationMs: Date.now() - startedAt,
      response: summarizeGeminiResponse(responsePayload),
    });
    throw new GeminiApiError(
      `Gemini blocked the request because of safety policy: ${responsePayload.promptFeedback.blockReason}`,
      {
        details: responsePayload,
      },
    );
  }

  logGemini("info", trace, "request:success", {
    model,
    durationMs: Date.now() - startedAt,
    response: summarizeGeminiResponse(responsePayload),
  });

  return responsePayload;
}

export function extractGeminiParts(response: GeminiGenerateContentResponse) {
  return normalizeGeminiImageParts(
    response.candidates?.flatMap((candidate) => candidate.content?.parts ?? []) ?? [],
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

export function extractGeminiFileUriPart(
  part: GeminiResponsePart,
): { uri: string; mimeType?: string } | null {
  const raw = part.fileData ?? part.file_data;
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const uri = raw.fileUri ?? raw.file_uri;
  if (!uri || typeof uri !== "string") {
    return null;
  }

  const mimeType = raw.mimeType ?? raw.mime_type;
  return { uri: uri.trim(), mimeType: typeof mimeType === "string" ? mimeType : undefined };
}

function extractGeminiInlineImageUrl(part: GeminiResponsePart): { url: string; mimeType?: string } | null {
  if (part.inlineData?.url && typeof part.inlineData.url === "string" && !part.inlineData.data) {
    return {
      url: part.inlineData.url.trim(),
      mimeType: part.inlineData.mimeType,
    };
  }

  const snake = part.inline_data;
  if (snake?.url && typeof snake.url === "string" && !snake.data) {
    return {
      url: snake.url.trim(),
      mimeType: snake.mime_type,
    };
  }

  return null;
}

function extractGeminiTextImageUrl(part: GeminiResponsePart): string | null {
  if (!part.text?.trim() || part.thought) {
    return null;
  }

  return extractImageUrlsFromText(part.text)[0] ?? null;
}

/**
 * 灏嗗搷搴斾腑鐨勫浘鐗?URL 鎷夊彇涓?base64锛圙oogle Files / generativelanguage 绛夐渶鍦?query 涓婂甫 key锛夈€? */
export async function fetchGeminiImageUrlToBase64(
  url: string,
  options?: { apiKey?: string; mimeTypeHint?: string; trace?: GeminiTraceContext },
): Promise<{ mimeType: string; data: string } | null> {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  let fetchUrl = trimmed;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    const looksGoogle =
      host.includes("googleapis.com") || host.includes("googleusercontent.com");
    if (looksGoogle && options?.apiKey && !parsed.searchParams.has("key")) {
      parsed.searchParams.set("key", options.apiKey);
      fetchUrl = parsed.toString();
    }
  } catch {
    // 闈炵粷瀵?URL 鏃朵粛灏濊瘯鐩存帴璇锋眰
  }

  let response: UndiciResponse;
  try {
    response = await undiciFetch(fetchUrl, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      dispatcher: geminiDispatcher,
    });
  } catch {
    logGemini("warn", options?.trace, "image-url:network-error", {
      url: summarizeImageUrl(fetchUrl),
    });
    return null;
  }

  if (!response.ok) {
    logGemini("warn", options?.trace, "image-url:http-error", {
      url: summarizeImageUrl(fetchUrl),
      status: response.status,
    });
    return null;
  }

  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim();
  if (
    contentType &&
    !contentType.startsWith("image/") &&
    contentType !== "application/octet-stream"
  ) {
    logGemini("warn", options?.trace, "image-url:unexpected-content-type", {
      url: summarizeImageUrl(fetchUrl),
      contentType,
    });
    return null;
  }

  const buf = Buffer.from(await response.arrayBuffer());
  if (buf.length === 0) {
    logGemini("warn", options?.trace, "image-url:empty-body", {
      url: summarizeImageUrl(fetchUrl),
    });
    return null;
  }

  logGemini("info", options?.trace, "image-url:resolved", {
    url: summarizeImageUrl(fetchUrl),
    mimeType: contentType ?? options?.mimeTypeHint ?? "image/png",
    bytes: buf.length,
  });

  return {
    mimeType: options?.mimeTypeHint || (contentType?.startsWith("image/") ? contentType : "image/png"),
    data: buf.toString("base64"),
  };
}

export async function resolveGeminiPartToBase64Image(
  part: GeminiResponsePart,
  apiKey: string,
  trace?: GeminiTraceContext,
): Promise<{ mimeType: string; data: string } | null> {
  const inline = extractGeminiInlineData(part);
  if (inline?.data) {
    return { mimeType: inline.mimeType, data: inline.data };
  }

  const inlineUrl = extractGeminiInlineImageUrl(part);
  if (inlineUrl) {
    return fetchGeminiImageUrlToBase64(inlineUrl.url, {
      apiKey,
      mimeTypeHint: inlineUrl.mimeType,
      trace,
    });
  }

  const fileRef = extractGeminiFileUriPart(part);
  if (fileRef) {
    return fetchGeminiImageUrlToBase64(fileRef.uri, {
      apiKey,
      mimeTypeHint: fileRef.mimeType,
      trace,
    });
  }

  const textImageUrl = extractGeminiTextImageUrl(part);
  if (textImageUrl) {
    return fetchGeminiImageUrlToBase64(textImageUrl, {
      apiKey,
      trace,
    });
  }

  return null;
}

