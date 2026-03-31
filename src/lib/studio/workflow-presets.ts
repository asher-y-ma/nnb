import type {
  DetailFocusId,
  PlatformTarget,
  StudioModule,
} from "@/types/studio";

export interface PromptTemplatePreset {
  label: string;
  prompt: string;
}

export interface DetailFocusPreset {
  id: DetailFocusId;
  label: string;
  shortLabel: string;
  description: string;
  hiddenPrompt: string;
}

export interface FashionGarmentPreset {
  id: "top" | "bottom";
  label: string;
  description: string;
  hiddenPrompt: string;
}

export interface InspirationCard {
  title: string;
  subtitle: string;
  eyebrow?: string;
}

export const MODULE_WORKFLOW_OPTIONS: Record<StudioModule, string[]> = {
  main: ["主图转化", "自然种草", "高级棚拍", "节日营销"],
  detail: ["详情套图", "卖点讲解", "材质细节", "参数说明"],
  "style-clone": ["单产品复刻", "轻复刻", "强风格复刻"],
  retouch: ["去背景", "补光修瑕", "换背景", "局部重绘"],
  fashion: ["上身试穿", "一键换装", "服装平铺", "换姿势"],
  commerce: ["图文带货", "批量文案", "视频预备"],
};

export function getDefaultWorkflowMode(module: StudioModule) {
  return MODULE_WORKFLOW_OPTIONS[module][0];
}

export const MODULE_PROMPT_TEMPLATES: Record<StudioModule, PromptTemplatePreset[]> = {
  main: [
    {
      label: "高级棚拍主图",
      prompt: "强调产品主体完整、背景克制、品牌感明确，适合电商首页首图投放。",
    },
    {
      label: "自然场景种草",
      prompt: "做出真实生活化场景，让产品更容易被用户代入和种草。",
    },
    {
      label: "白底高转化",
      prompt: "适合平台主图的高转化白底视觉，主体突出、边缘干净、信息直给。",
    },
    {
      label: "节日促销氛围",
      prompt: "保留产品识别度，加入节日营销氛围和促销感，但不要喧宾夺主。",
    },
  ],
  detail: [
    {
      label: "卖点总览",
      prompt: "适合详情页第一屏的卖点总览图，突出核心优势和信任感。",
    },
    {
      label: "材质细节",
      prompt: "突出材质、纹理、做工和触感，让用户看得见产品品质。",
    },
    {
      label: "参数信息",
      prompt: "适合参数说明图，结构清晰，预留信息排版空间。",
    },
    {
      label: "使用场景",
      prompt: "在真实场景里展示产品使用方式和价值感，帮助用户理解用途。",
    },
  ],
  "style-clone": [
    {
      label: "贴近布光",
      prompt: "优先复刻参考图的布光、色调和镜头语言，不要直接复制参考主体。",
    },
    {
      label: "统一品牌调性",
      prompt: "让结果更像同一组品牌视觉系列，适合批量上新统一风格。",
    },
    {
      label: "保守复刻",
      prompt: "优先保护产品自身识别度，只借鉴参考图的视觉氛围。",
    },
    {
      label: "强化风格",
      prompt: "更积极吸收参考图的氛围、构图和背景设计，但仍要保留商品特征。",
    },
  ],
  retouch: [
    {
      label: "去背景补光",
      prompt: "把主体抠干净并提升光感，适合做更专业的商品图。",
    },
    {
      label: "统一色温",
      prompt: "统一整张图的光线和色温，让产品更高级、更耐看。",
    },
    {
      label: "包装反光优化",
      prompt: "处理包装、瓶身或塑封反光，同时保留材质真实感。",
    },
    {
      label: "局部修瑕",
      prompt: "只改需要优化的位置，主体其他区域尽量不变。",
    },
  ],
  fashion: [
    {
      label: "自然试穿",
      prompt: "让模特上身效果自然可信，重点保留版型、印花和服装层次。",
    },
    {
      label: "店铺挂拍",
      prompt: "生成适合电商服装页的平铺或挂拍展示，干净、规整、好看。",
    },
    {
      label: "显身材换装",
      prompt: "在保证真实比例的前提下，突出服装上身效果和穿搭完成度。",
    },
    {
      label: "换姿势",
      prompt: "改变模特姿势和镜头感，同时保持服装核心信息稳定。",
    },
  ],
  commerce: [
    {
      label: "小红书图文包",
      prompt: "适合小红书图文发布，强调种草氛围、情绪价值和生活方式表达。",
    },
    {
      label: "抖音带货图",
      prompt: "适合抖音挂车和短视频封面，第一眼抓人、强调成交氛围。",
    },
    {
      label: "平台标题标签",
      prompt: "批量生成标题、标签和行动号召，方便直接分发到不同平台。",
    },
    {
      label: "视频分镜预备",
      prompt: "围绕产品卖点生成视频开场钩子、镜头分镜和后续视觉提示。",
    },
  ],
};

export const DETAIL_FOCUS_PRESETS: DetailFocusPreset[] = [
  {
    id: "selling-point",
    label: "核心卖点图",
    shortLabel: "卖点",
    description: "适合详情页前半段，直给产品优势和购买理由。",
    hiddenPrompt:
      "把这张图做成详情页的核心卖点图，突出产品最值得购买的 1-2 个优势，画面信息层次清晰，并预留文案排版空间。",
  },
  {
    id: "material",
    label: "材质细节图",
    shortLabel: "材质",
    description: "展示纹理、材质、做工、触感和品质感。",
    hiddenPrompt:
      "聚焦材质、表面纹理、工艺细节或质感表现，适合详情页中段用于放大品质感，画面更近、更细、更真实。",
  },
  {
    id: "parameters",
    label: "参数说明图",
    shortLabel: "参数",
    description: "适合尺寸、规格、结构、容量等信息表达。",
    hiddenPrompt:
      "做成结构清晰的参数说明图，构图规整，便于后续叠加尺寸、规格、容量或功能说明，不要把主体遮挡。",
  },
  {
    id: "scene",
    label: "场景应用图",
    shortLabel: "场景",
    description: "让用户快速理解产品的使用方式和应用场景。",
    hiddenPrompt:
      "在真实自然的使用场景里展示产品，让用户看懂产品适合什么人、什么环境、怎样使用，提升代入感。",
  },
  {
    id: "comparison",
    label: "对比强化图",
    shortLabel: "对比",
    description: "强调前后差异、性能优势或功能提升。",
    hiddenPrompt:
      "突出产品相较普通方案的优势，可以用对比感构图或层次表达，但不要破坏主产品的真实结构。",
  },
  {
    id: "craft",
    label: "工艺细节图",
    shortLabel: "工艺",
    description: "更适合复杂工艺、缝线、接口、结构细节。",
    hiddenPrompt:
      "聚焦工艺、做工、拼接、缝线、接口或关键结构，强调专业度和细节可信度，适合用于高客单产品详情图。",
  },
  {
    id: "package",
    label: "包装配件图",
    shortLabel: "包装",
    description: "展示包装、赠品、配件和开箱完整感。",
    hiddenPrompt:
      "展示包装、配件、赠品或开箱完整内容，让用户一眼知道买到手会包含什么，构图干净、信息明确。",
  },
  {
    id: "usage",
    label: "使用步骤图",
    shortLabel: "步骤",
    description: "适合清晰表现使用动作、穿戴步骤或操作流程。",
    hiddenPrompt:
      "用更易懂的步骤感或动作感展示产品使用方式，方便后续叠加步骤说明，画面节奏清楚、导向明确。",
  },
];

export const FASHION_GARMENT_PRESETS: FashionGarmentPreset[] = [
  {
    id: "top",
    label: "上衣",
    description: "适用于 T 恤、衬衫、卫衣、外套等上半身服装。",
    hiddenPrompt:
      "重点保护领口、肩线、袖长、衣长、版型、印花、logo 和面料褶皱规律。下装和人物肢体比例应自然稳定。",
  },
  {
    id: "bottom",
    label: "下装",
    description: "适用于裤装、短裤、半裙、长裙等下半身服装。",
    hiddenPrompt:
      "重点保护腰线、裤长或裙长、裤脚或裙摆、褶皱走向、版型和印花。上半身和人物身份应保持稳定自然。",
  },
];

export const COMMERCE_PLATFORM_GUIDES: Record<PlatformTarget, string> = {
  通用电商: "强调成交导向、主图转化和信息直给，适合电商通用场景。",
  小红书: "强调种草感、生活方式表达、真实分享口吻和收藏欲。",
  抖音: "强调第一眼抓人、短视频封面感、节奏强和成交转化。",
  淘宝: "强调清晰卖点、平台搜索感和详情转化效率。",
  拼多多: "强调价格心智、价值感和信息明确直给。",
  视频号: "强调信任感、讲解感和直播/短视频延展性。",
};

export const MODULE_INSPIRATION_CARDS: Record<StudioModule, InspirationCard[]> = {
  main: [
    { eyebrow: "主图", title: "白底爆款首图", subtitle: "主体完整、边缘干净、适合首页投放。" },
    { eyebrow: "场景", title: "自然生活场景", subtitle: "真实使用氛围，增强用户代入感。" },
    { eyebrow: "品牌", title: "高级棚拍", subtitle: "适合高客单价品牌商品的静物表达。" },
    { eyebrow: "营销", title: "节日促销封面", subtitle: "保留产品识别度，同时加入营销氛围。" },
  ],
  detail: [
    { eyebrow: "详情", title: "卖点总览", subtitle: "一张图说明为什么值得买。" },
    { eyebrow: "材质", title: "做工特写", subtitle: "把质感和细节放大给用户看。" },
    { eyebrow: "参数", title: "结构参数图", subtitle: "预留尺寸、规格和结构说明空间。" },
    { eyebrow: "场景", title: "使用演示图", subtitle: "帮助用户快速理解实际用途。" },
  ],
  "style-clone": [
    { eyebrow: "复刻", title: "统一品牌调性", subtitle: "自动拆解参考图的布光、构图、色调和背景。" },
    { eyebrow: "保护", title: "商品主体保真", subtitle: "借鉴风格，不直接照搬参考主体。" },
    { eyebrow: "系列", title: "单产品复刻", subtitle: "先把单品视觉做稳，再扩展到系列化输出。" },
  ],
  retouch: [
    { eyebrow: "精修", title: "去背景提亮", subtitle: "适合快速把现有素材做成更可投放版本。" },
    { eyebrow: "修瑕", title: "局部重绘", subtitle: "只改问题区域，避免整图重做。" },
    { eyebrow: "统一", title: "色温和光感", subtitle: "让图片成套看起来更专业。" },
  ],
  fashion: [
    { eyebrow: "服装", title: "上衣试穿", subtitle: "保护领口、袖长、衣长和印花位置。" },
    { eyebrow: "服装", title: "下装试穿", subtitle: "保护腰线、裤长或裙摆，保持人体比例自然。" },
    { eyebrow: "平铺", title: "电商挂拍", subtitle: "适合详情页和平铺展示场景。" },
  ],
  commerce: [
    { eyebrow: "带货", title: "平台图文包", subtitle: "图、标题、标签、CTA 成套输出。" },
    { eyebrow: "视频", title: "分镜预备", subtitle: "开场钩子、镜头节奏、视觉提示一起准备。" },
    { eyebrow: "批量", title: "并发 5 组文案", subtitle: "同一商品批量试多套卖点角度。" },
  ],
};
