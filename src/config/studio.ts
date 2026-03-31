import type { StudioModuleDefinition } from "@/types/studio";

export const DEFAULT_GEMINI_BASE_URL = "https://mccum.com/";
export const DEFAULT_IMAGE_MODEL = "gemini-3.1-flash-image-preview";
export const DEFAULT_HQ_IMAGE_MODEL = "gemini-3-pro-image-preview";
export const DEFAULT_TEXT_MODEL = "gemini-3-flash-preview";

export const STUDIO_NAV_ITEMS: StudioModuleDefinition[] = [
  {
    id: "main",
    label: "主图",
    shortLabel: "主图",
    badge: "核心",
    description: "生成适合电商平台投放的商品主图、首图与场景图。",
    helper: "上传产品图后，选择比例、画面方向和平台语气，快速生成商品主视觉。",
  },
  {
    id: "detail",
    label: "详情图",
    shortLabel: "详情",
    description: "围绕卖点、材质、参数与场景生成详情页素材。",
    helper: "适合做 4-6 张详情图连续产出，强调卖点解释和信息层次。",
  },
  {
    id: "style-clone",
    label: "风格复刻",
    shortLabel: "复刻",
    description: "参考目标视觉风格，生成统一调性的商品创意。",
    helper: "上传产品图和参考图，让画面靠近目标风格，同时尽量保留产品特征。",
  },
  {
    id: "retouch",
    label: "精修",
    shortLabel: "精修",
    description: "对已有图片进行补光、换背景、改质感、去瑕疵与局部修改。",
    helper: "适合小修改、高保真编辑和二次加工。",
  },
  {
    id: "fashion",
    label: "服装",
    shortLabel: "服装",
    badge: "试穿",
    description: "做模特上身试穿、一键换装、服装平铺和换姿势。",
    helper: "上传服装图与模特图，尽量明确服装类型、姿势要求与版型重点。",
  },
  {
    id: "commerce",
    label: "带货",
    shortLabel: "带货",
    badge: "批量",
    description: "生成带货图片，并批量生成平台标题、文案、标签与 CTA。",
    helper: "同时为视频扩展预留分镜与脚本能力，当前版本支持并发 5 的批量文案生成。",
  },
];
