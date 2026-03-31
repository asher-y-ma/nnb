import type { PlatformTarget, StudioModule } from "@/types/studio";

interface PromptContext {
  module: StudioModule;
  prompt: string;
  extraNotes?: string;
  productFacts?: string;
  platform: PlatformTarget;
  aspectRatio: string;
  garmentCategory?: string;
  workflowMode?: string;
  hasModelImage?: boolean;
  hasInnerLayerImage?: boolean;
}

const moduleNames: Record<StudioModule, string> = {
  main: "主图",
  detail: "详情图",
  "style-clone": "风格复刻",
  retouch: "图片精修",
  fashion: "服装试穿与换装",
  commerce: "带货创意",
};

export function buildImagePrompt(context: PromptContext) {
  const sections = [
    `你是一名顶级中文电商视觉导演，现在要完成「${moduleNames[context.module]}」任务。`,
    `目标平台：${context.platform}。`,
    `输出比例：${context.aspectRatio}。`,
    context.workflowMode ? `当前工作模式：${context.workflowMode}。` : "",
    "必须严格保留商品或服装的核心外观特征，不要随意篡改主体材质、logo、印花、颜色和关键结构。",
    "输出应该适合电商使用，画面干净、聚焦明确、主体完整、可直接用于投放或内容制作。",
  ];

  if (context.module === "main") {
    sections.push(
      "请把输入产品图作为主参考，生成高转化商品主图。",
      "优先让画面具有平台首图感、商品清晰度、层次和氛围感。",
    );
  }

  if (context.module === "detail") {
    sections.push(
      "请围绕卖点生成适合详情页使用的功能说明图或场景说明图。",
      "输出要有明确卖点表达、构图层级和商业展示感。",
    );
  }

  if (context.module === "style-clone") {
    sections.push(
      "输入中同时包含产品图和参考风格图。",
      "参考图只用于借鉴风格、布光、镜头语言和情绪，不要把参考图里的主体直接搬过来。",
    );
  }

  if (context.module === "retouch") {
    sections.push(
      "这是精修任务，请优先在现有图像基础上完成精细编辑，而不是完全重做主体。",
      "如果用户只要求局部改动，就保持其余区域稳定。",
    );
  }

  if (context.module === "fashion") {
    sections.push(
      `服装类别：${context.garmentCategory ?? "未指定"}。`,
      context.hasModelImage
        ? "已提供模特图，请优先执行上身试穿或换装，并尽量保持人物姿态自然。"
        : "未提供模特图，如果用户未要求模特上身，请优先输出服装平铺或陈列式画面。",
      context.hasInnerLayerImage
        ? "已提供内搭图，请处理好服装层次与遮挡关系。"
        : "如果未提供内搭图，不要凭空生成不合理的叠穿关系。",
      "请尽可能保持版型、衣长、花纹和印花位置稳定。",
    );
  }

  if (context.module === "commerce") {
    sections.push(
      "请生成适合带货场景的商业视觉，重点突出成交氛围、吸睛构图和平台传播性。",
      "该图会与平台标题、文案和标签一起使用，画面应适合后续视频扩展。",
    );
  }

  if (context.productFacts?.trim()) {
    sections.push(`商品事实：${context.productFacts.trim()}`);
  }

  if (context.prompt.trim()) {
    sections.push(`核心要求：${context.prompt.trim()}`);
  }

  if (context.extraNotes?.trim()) {
    sections.push(`额外要求：${context.extraNotes.trim()}`);
  }

  sections.push(
    "请只输出最终可用结果，不要在图片里加入多余水印、参数说明或无关文字，除非用户明确要求。",
  );

  return sections.join("\n");
}

export function buildCommerceCopyPrompt({
  platform,
  tone,
  productFacts,
  prompt,
  variantIndex,
  workflowMode,
}: {
  platform: PlatformTarget;
  tone: string;
  productFacts?: string;
  prompt?: string;
  variantIndex: number;
  workflowMode?: string;
}) {
  return [
    `你是资深中文电商带货策划，现在为 ${platform} 生成第 ${variantIndex} 套带货文案。`,
    `语气要求：${tone}。`,
    workflowMode ? `工作模式：${workflowMode}。` : "",
    productFacts?.trim() ? `商品事实：${productFacts.trim()}` : "",
    prompt?.trim() ? `创意要求：${prompt.trim()}` : "",
    "请输出 JSON，包含以下字段：title、body、tags、cta、openingLine、sellingPoints、shotList。",
    "title 要适合平台发布；body 要适合带货文案；tags 是 4-8 个中文短标签数组；cta 要简短有行动感。",
    "openingLine 是视频或直播开场钩子；sellingPoints 是 3-5 条卖点数组；shotList 是 4-6 条分镜或镜头描述数组。",
    "只返回 JSON，不要返回 Markdown，不要包裹代码块。",
  ]
    .filter(Boolean)
    .join("\n");
}
