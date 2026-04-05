import {
  getImageTextLanguageLabel,
  DEFAULT_IMAGE_TEXT_LANGUAGE,
} from "@/lib/studio/image-text-languages";
import {
  COMMERCE_PLATFORM_GUIDES,
  DETAIL_FOCUS_PRESETS,
  type DetailFocusPreset,
} from "@/lib/studio/workflow-presets";
import type { ImageTextLanguage, PlatformTarget, StudioModule } from "@/types/studio";

export interface StyleReferenceBrief {
  summary: string;
  palette: string[];
  lighting: string;
  composition: string;
  background: string;
  mood: string;
  typography?: string;
  preserve: string[];
  avoid: string[];
}

export interface GarmentReferenceBrief {
  category: string;
  silhouette: string;
  fabric: string;
  styling: string;
  preserve: string[];
}

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
  detailFocus?: DetailFocusPreset;
  styleBrief?: StyleReferenceBrief | null;
  garmentBrief?: GarmentReferenceBrief | null;
  /** 画面中若出现用户要求的新增可读文字时应使用的书写语言。 */
  imageTextLanguage?: ImageTextLanguage;
}

const moduleNames: Record<StudioModule, string> = {
  main: "主图",
  detail: "详情图",
  "style-clone": "风格复刻",
  retouch: "图片精修",
  fashion: "服装试穿与换装",
  commerce: "带货创意",
};

function joinList(items?: string[]) {
  if (!items?.length) {
    return "";
  }

  return items.join("、");
}

function buildImageTextLanguageRules(imageTextLanguage?: ImageTextLanguage) {
  const code = imageTextLanguage ?? DEFAULT_IMAGE_TEXT_LANGUAGE;
  const label = getImageTextLanguageLabel(code);

  return [
    "【画面可读文字规则（硬性）】",
    `用户为「当画面需要出现可读文字时」指定的书写语言为：${label}（${code}）。`,
    "仅当用户在「核心要求」「额外要求」或商品事实等输入中明确要求在画面里加入标题、卖点字、标签、口号、装饰文案、价格条、促销字、水印式文案等可读内容时，才允许在图像中绘制这类新增文字。",
    "若用户没有明确要求在画面中加入任何可读文字，则严禁擅自添加标语、卖点字、假水印、参数说明、无关装饰字等。产品/包装上原有的 logo、洗标、吊牌印字等如在参考图中已存在，应如实保留，不视为「新增画面文字」。",
    `当且仅当需要绘制上述「新增画面文字」时，必须使用 ${label}，拼写与语法须正确、自然，并符合该语言常见排版习惯；不要擅自改用其他语言，除非用户明确要求双语或多语。`,
  ].join("\n");
}

function getMainWorkflowPrompt(workflowMode?: string) {
  switch (workflowMode) {
    case "自然种草":
      return "画面要更像真实生活方式内容，减少重棚拍感，增强自然种草氛围。";
    case "高级棚拍":
      return "画面要更像品牌静物棚拍，布光干净克制，高级感强，适合高客单价视觉。";
    case "节日营销":
      return "加入节日或活动氛围，但产品仍必须是绝对主角，不要让装饰元素压过商品本身。";
    default:
      return "把输入产品图作为主参考，生成高转化商品主图，优先体现首图感、清晰度和成交氛围。";
  }
}

function getRetouchWorkflowPrompt(workflowMode?: string) {
  switch (workflowMode) {
    case "去背景":
      return "这是精修任务，请优先完成背景清理、边缘优化和主体提亮，而不是彻底重做场景。";
    case "补光修瑕":
      return "重点处理局部瑕疵、脏污、反光和光感，让结果更干净但仍保持原图真实感。";
    case "换背景":
      return "重点替换背景环境并保持主体不跑偏，边缘过渡自然，不出现明显抠图痕迹。";
    default:
      return "保持原图主体尽量稳定，只对用户点名的区域做精修、补光或局部重绘。";
  }
}

function getStyleCloneWorkflowPrompt(workflowMode?: string) {
  switch (workflowMode) {
    case "轻复刻":
      return "轻量借鉴参考图的布光、色温和镜头语言，产品主体必须更稳、更保守。";
    case "强风格复刻":
      return "更积极吸收参考图的背景、镜头、色调和视觉情绪，但不能直接复制参考图主体。";
    default:
      return "当前为单产品复刻，重点是拆解参考图风格并迁移到当前商品上，做出同系列感。";
  }
}

function getFashionWorkflowPrompt(workflowMode?: string, hasModelImage?: boolean) {
  switch (workflowMode) {
    case "一键换装":
      return hasModelImage
        ? "这是换装任务：保留人物身份、面部、姿态和镜头氛围，只替换目标服装。"
        : "这是换装任务，但用户未上传模特图；请优先输出更可信的服装展示图，而不是凭空伪造人体。";
    case "服装平铺":
      return "这是服装平铺/挂拍任务：请输出干净规整的服装展示，不要强行做人台或真人试穿。";
    case "换姿势":
      return hasModelImage
        ? "这是换姿势任务：保留人物身份和服装本身，只改变动作、镜头角度或站姿。"
        : "这是换姿势任务，但未提供模特图；请退化为更可用的服装展示图。";
    default:
      return hasModelImage
        ? "这是上身试穿任务：让服装自然穿在模特身上，人物比例和遮挡关系必须可信。"
        : "未提供模特图，请优先输出可用于服装页的展示图，不要凭空生成不合理的人体关系。";
  }
}

function getCommerceWorkflowPrompt(platform: PlatformTarget, workflowMode?: string) {
  const platformGuide = COMMERCE_PLATFORM_GUIDES[platform];

  switch (workflowMode) {
    case "批量文案":
      return `${platformGuide} 当前更偏向批量文案和包装角度测试，因此文案结构需要更丰富，可用于 A/B 测试。`;
    case "视频预备":
      return `${platformGuide} 当前要为后续短视频或直播生成分镜和视觉脚本，结果需要有明显镜头节奏感。`;
    default:
      return `${platformGuide} 当前需要图文带货成套交付，画面要能和标题、文案、标签一起配套使用。`;
  }
}

export function buildImagePrompt(context: PromptContext) {
  const sections = [
    `你是一名资深中文电商视觉导演，现在要完成「${moduleNames[context.module]}」任务。`,
    `目标平台：${context.platform}。`,
    `输出比例：${context.aspectRatio}。`,
    context.workflowMode ? `当前工作模式：${context.workflowMode}。` : "",
    "必须严格保留商品或服装的核心外观特征，不要随意篡改主体材质、logo、印花、颜色和关键结构。",
    "输出应该适合电商使用，画面干净、主体完整、焦点明确，可直接用于投放、详情页或内容制作。",
  ];

  if (context.module === "main") {
    sections.push(getMainWorkflowPrompt(context.workflowMode));
  }

  if (context.module === "detail") {
    sections.push(
      "这是详情页套图任务，画面除了美观，还要承担解释卖点、展示材质或说明参数的职责。",
      context.detailFocus
        ? `本张详情图主题：${context.detailFocus.label}。${context.detailFocus.hiddenPrompt}`
        : "如果用户没有指定详情图主题，请优先输出最适合详情页前半段的卖点总览图。",
    );
  }

  if (context.module === "style-clone") {
    sections.push(
      "输入中同时包含商品图和参考风格图。",
      "产品图是唯一的主体来源，最终画面里的商品必须来自产品图，而不是参考图。",
      "参考图只用于借鉴风格、布光、背景、镜头语言和情绪，绝对不要把参考图里的主体、道具、排版主体或人物直接搬过来。",
      "如果产品主体和参考风格发生冲突，优先保护产品主体，宁可少复刻一点风格，也不要换成参考图里的主体。",
      "生成前先识别产品图里的主体形态、结构、材质、印花和 logo，再把参考图风格迁移到这个主体上。",
      getStyleCloneWorkflowPrompt(context.workflowMode),
    );

    if (context.styleBrief) {
      sections.push(
        `参考风格总结：${context.styleBrief.summary}`,
        context.styleBrief.palette.length
          ? `推荐色调：${context.styleBrief.palette.join("、")}。`
          : "",
        context.styleBrief.lighting
          ? `布光方式：${context.styleBrief.lighting}。`
          : "",
        context.styleBrief.composition
          ? `构图方式：${context.styleBrief.composition}。`
          : "",
        context.styleBrief.background
          ? `背景处理：${context.styleBrief.background}。`
          : "",
        context.styleBrief.typography
          ? `文字/版式倾向：${context.styleBrief.typography}。`
          : "",
        context.styleBrief.mood ? `视觉情绪：${context.styleBrief.mood}。` : "",
        context.styleBrief.preserve.length
          ? `生成时必须保留：${joinList(context.styleBrief.preserve)}。`
          : "",
        context.styleBrief.avoid.length
          ? `生成时必须避免：${joinList(context.styleBrief.avoid)}。`
          : "",
      );
    }
  }

  if (context.module === "retouch") {
    sections.push(getRetouchWorkflowPrompt(context.workflowMode));
  }

  if (context.module === "fashion") {
    sections.push(
      `服装类别：${context.garmentCategory ?? "未指定"}。`,
      getFashionWorkflowPrompt(context.workflowMode, context.hasModelImage),
      context.hasInnerLayerImage
        ? "已提供内搭图，请处理好服装层次与遮挡关系，避免穿模。"
        : "如果没有内搭图，不要凭空生成不合理的叠穿关系。",
    );

    if (context.garmentBrief) {
      sections.push(
        context.garmentBrief.category
          ? `服装分析：${context.garmentBrief.category}，${context.garmentBrief.silhouette}。`
          : "",
        context.garmentBrief.fabric
          ? `面料/表面特征：${context.garmentBrief.fabric}。`
          : "",
        context.garmentBrief.styling
          ? `整体穿搭重点：${context.garmentBrief.styling}。`
          : "",
        context.garmentBrief.preserve.length
          ? `必须保护的服装信息：${joinList(context.garmentBrief.preserve)}。`
          : "",
      );
    }
  }

  if (context.module === "commerce") {
    sections.push(getCommerceWorkflowPrompt(context.platform, context.workflowMode));
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

  sections.push(buildImageTextLanguageRules(context.imageTextLanguage));

  return sections.filter(Boolean).join("\n");
}

export function buildStyleAnalysisPrompt(workflowMode?: string) {
  return [
    "你是一名电商视觉分析师，请分析参考图的视觉风格，并把结论整理成 JSON。",
    "只关注风格迁移需要的信息，不要复述参考图主体是什么商品。",
    workflowMode ? `当前复刻模式：${workflowMode}。` : "",
    "请输出字段：summary、palette、lighting、composition、background、mood、typography、preserve、avoid。",
    "summary 用一句中文总结参考图的视觉策略；palette 为 3-6 个中文短语；preserve 和 avoid 各输出 3-6 条。",
    "如果参考图有明显的留白、文字区、镜头角度、品牌质感，也写进相应字段。",
    "只返回 JSON，不要返回 Markdown。",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildStyleAnalysisSummary(brief: StyleReferenceBrief) {
  const sections = [
    `参考风格：${brief.summary}`,
    brief.palette.length ? `色调关键词：${brief.palette.join("、")}` : "",
    brief.lighting ? `布光：${brief.lighting}` : "",
    brief.composition ? `构图：${brief.composition}` : "",
    brief.background ? `背景：${brief.background}` : "",
    brief.mood ? `情绪：${brief.mood}` : "",
    brief.typography ? `版式：${brief.typography}` : "",
    brief.preserve.length ? `应保留：${brief.preserve.join("、")}` : "",
    brief.avoid.length ? `应避免：${brief.avoid.join("、")}` : "",
  ];

  return sections.filter(Boolean).join("\n");
}

export function buildFashionAnalysisPrompt(garmentCategory?: string, workflowMode?: string) {
  return [
    "你是一名服装电商视觉分析师，请根据服装图提炼出生成试穿图时必须保护的服装特征，并输出 JSON。",
    garmentCategory ? `目标服装类别：${garmentCategory}。` : "",
    workflowMode ? `工作模式：${workflowMode}。` : "",
    "请输出字段：category、silhouette、fabric、styling、preserve。",
    "preserve 请输出 4-8 条中文短语，强调版型、长度、印花、logo、开口、扣子、褶皱等不可跑偏的元素。",
    "只返回 JSON，不要返回 Markdown。",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildFashionAnalysisSummary(brief: GarmentReferenceBrief) {
  const sections = [
    brief.category ? `服装识别：${brief.category}` : "",
    brief.silhouette ? `版型轮廓：${brief.silhouette}` : "",
    brief.fabric ? `面料特征：${brief.fabric}` : "",
    brief.styling ? `穿搭重点：${brief.styling}` : "",
    brief.preserve.length ? `保护要点：${brief.preserve.join("、")}` : "",
  ];

  return sections.filter(Boolean).join("\n");
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
    `你是一名资深中文电商带货策划，现在为 ${platform} 生成第 ${variantIndex} 套带货内容。`,
    `语气要求：${tone}。`,
    workflowMode ? `工作模式：${workflowMode}。` : "",
    `平台提示：${COMMERCE_PLATFORM_GUIDES[platform]}`,
    productFacts?.trim() ? `商品事实：${productFacts.trim()}` : "",
    prompt?.trim() ? `创意要求：${prompt.trim()}` : "",
    "请输出 JSON，包含以下字段：title、body、tags、cta、openingLine、coverText、sellingPoints、shotList、storyboard。",
    "title 适合平台发布；body 为完整带货正文；tags 为 4-8 个中文短标签数组；cta 要简短有行动感；coverText 为图文或短视频封面文案。",
    "openingLine 是短视频或直播开场钩子；sellingPoints 为 3-5 条卖点；shotList 为 4-6 条镜头顺序说明。",
    "storyboard 为 4-6 个对象数组，每个对象字段为 title、direction、visualPrompt、overlayText。",
    "只返回 JSON，不要返回 Markdown，不要包代码块。",
  ]
    .filter(Boolean)
    .join("\n");
}

export function getDetailFocusPresetById(id: string) {
  return DETAIL_FOCUS_PRESETS.find((preset) => preset.id === id);
}
