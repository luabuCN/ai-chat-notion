import {
  ImagePlus,
  Palette,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import type { PromptLibraryGroup } from "./types";

export const MODELS = [
  {
    id: "Tongyi-MAI/Z-Image-Turbo",
    name: "Z-Image-Turbo",
    badge: "快速出图",
  },
  {
    id: "MusePublic/489_ckpt_FLUX_1",
    name: "Flux 1",
    badge: "插画风格",
  },
  {
    id: "MAILAND/majicflus_v1",
    name: "Majicflux v1",
    badge: "质感写实",
  },
  {
    id: "krea/Krea-2-Turbo",
    name: "Krea-2-Turbo",
    badge: "高质量",
  },
];

export const SIZES = [
  {
    id: "1024x1024",
    name: "1:1",
    description: "头像 / 封面",
  },
  {
    id: "768x1024",
    name: "3:4",
    description: "人物 / 竖版",
  },
  {
    id: "1024x768",
    name: "4:3",
    description: "海报 / 产品",
  },
  {
    id: "1536x864",
    name: "16:9",
    description: "横版视觉",
  },
  {
    id: "864x1536",
    name: "9:16",
    description: "竖版视频",
  },
  {
    id: "682x1024",
    name: "2:3",
    description: "杂志 / 竖版",
  },
  {
    id: "1024x682",
    name: "3:2",
    description: "摄影 / 横版",
  },
  {
    id: "1344x576",
    name: "21:9",
    description: "超宽 / 电影",
  },
];

export const PROMPT_LIBRARY: PromptLibraryGroup[] = [
  {
    key: "styles",
    title: "风格",
    icon: Palette,
    items: [
      "电影感",
      "国风插画",
      "赛博朋克",
      "3D 渲染",
      "极简海报",
      "日系动漫",
    ],
  },
  {
    key: "scenes",
    title: "场景",
    icon: ImagePlus,
    items: [
      "城市夜景",
      "产品摄影棚",
      "云海浮岛",
      "未来实验室",
      "高级展厅",
      "咖啡馆窗口",
    ],
  },
  {
    key: "lighting",
    title: "光线",
    icon: Sparkles,
    items: [
      "柔和晨光",
      "霓虹边缘光",
      "体积光",
      "逆光剪影",
      "电影补光",
      "自然漫反射",
    ],
  },
  {
    key: "camera",
    title: "镜头",
    icon: WandSparkles,
    items: [
      "85mm 人像",
      "超广角",
      "俯视构图",
      "微距细节",
      "中心对称",
      "特写镜头",
    ],
  },
  {
    key: "quality",
    title: "质量",
    icon: ShieldCheck,
    items: [
      "超高细节",
      "商业级质感",
      "高对比层次",
      "干净背景",
      "构图稳定",
      "高清纹理",
    ],
  },
];

export const NEGATIVE_OPTIONS = [
  "模糊",
  "低清晰度",
  "畸形手指",
  "多余肢体",
  "文字水印",
  "杂乱背景",
  "曝光过度",
  "面部崩坏",
];

export const PROMPT_TEMPLATES = [
  "电商产品海报，产品主体居中构图，极简干净高级纯色渐变背景，专业商业品牌级柔光布光，明暗层次细腻柔和，产品材质纹理细节锐利清晰，8K超高清，商业摄影质感，无多余杂物干扰，画面干净留白充足，适合商品宣传主图",
  "二次元角色全身立绘，完整标准立绘构图，人物比例协调，服饰配饰纹样细节丰富精致，通透柔和漫反射光影，明暗对比舒适，纯色统一低饱和背景，边缘干净无杂乱元素，赛璐璐上色，线条流畅清晰，高完成度原画",
  "国风古风人物插画，半身雅致构图，传统水墨淡彩质感，飘逸古风衣袂纹样精细，柔和云雾漫光，淡墨山水极简背景，笔触温润写意，色彩素雅雅致，古风氛围感浓厚，高清精致国风原画"
];
