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
    helper: "上传商品图后，选择平台、比例和创意方向，快速生成高转化主视觉。",
  },
  {
    id: "detail",
    label: "详情图",
    shortLabel: "详情",
    description: "围绕卖点、材质、参数和场景，生成可直接用于详情页的整套图片。",
    helper: "可多选详情主题，系统会按已选主题分别生成对应图片。",
  },
  {
    id: "style-clone",
    label: "风格复刻",
    shortLabel: "复刻",
    description: "上传商品图与参考图，先分析参考图风格，再生成更统一的商品视觉。",
    helper: "当前优先支持单产品复刻，重点保护商品主体，同时借鉴参考图的布光、构图和情绪。",
  },
  {
    id: "retouch",
    label: "精修",
    shortLabel: "精修",
    description: "对已有图片做去背景、补光、修瑕、换背景和局部重绘。",
    helper: "适合把现有素材修成更可投放、更整洁、更高级的版本。",
  },
  {
    id: "fashion",
    label: "服装",
    shortLabel: "服装",
    badge: "试穿",
    description: "支持服装上身试穿、一键换装、服装平铺和换姿势。",
    helper: "当前优先把上衣和下装试穿做稳，自动提炼版型保护点后再生成。",
  },
  {
    id: "commerce",
    label: "带货",
    shortLabel: "带货",
    badge: "批量",
    description: "生成带货图片，并配套批量输出标题、文案、标签、CTA 和视频分镜。",
    helper: "同一商品可以同时测试多套平台角度，当前批量文案并发限制为 5。",
  },
];
