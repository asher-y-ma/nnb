# NNB Studio

一个参考 Shopix 风格重构的电商 AI 工作站，当前版本基于官方 Gemini API、Next.js 16 和 Supabase 搭建。

## 当前范围

- `主图`：商品首图、场景图、白底图
- `详情图`：卖点图、材质图、参数图、场景图
- `风格复刻`：商品图 + 参考图做视觉复刻
- `精修`：补光、换背景、局部修改、提高清晰度
- `服装`：模特试穿、一键换装、服装平铺、换姿势
- `带货`：图文带货、批量文案、视频预备分镜
- `设置`：本地保存 Gemini Key、模型、比例、尺寸
- `历史`：浏览器本地历史，支持结果包导出、文案包导出、恢复参数和本地素材

## 技术说明

- 只接 `标准 Gemini 官方方式`
- 当前不接 `OpenAI 兼容层`
- 当前不接 `Imagen`
- 图片结果暂不做长期云端存储
- Supabase 只承担登录、配置同步、任务元数据同步的基础设施

## 本地存储策略

- 生成结果图保存在浏览器 `IndexedDB`
- 输入素材也会随任务一起保存在浏览器 `IndexedDB`
- 同一浏览器/同一设备下，可以从历史页恢复参数和本地素材继续生成
- 如果浏览器缓存被清理，图片和输入素材可能丢失，所以界面会反复提醒用户下载

## 目录结构

- [architecture.md](D:\Projects\NNB\docs\architecture.md)：产品与技术架构规划
- [schema.sql](D:\Projects\NNB\supabase\schema.sql)：Supabase 表结构与 RLS
- [studio-workspace.tsx](D:\Projects\NNB\src\components\studio\studio-workspace.tsx)：主工作台
- [history-screen.tsx](D:\Projects\NNB\src\components\history\history-screen.tsx)：本地历史页
- [settings-form.tsx](D:\Projects\NNB\src\components\settings\settings-form.tsx)：设置与密钥管理
- [route.ts](D:\Projects\NNB\src\app\api\generate\route.ts)：生成接口
- [client.ts](D:\Projects\NNB\src\lib\gemini\client.ts)：Gemini 调用封装

## 环境变量

复制 `.env.example` 为 `.env.local` 后填写：

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_NAME=NNB
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

说明：

- Gemini API Key 不放在 `.env.local`
- 当前产品设计是用户在设置页自行输入 Gemini Key，本地持久化
- 如果不配置 Supabase，这个项目也能以“纯本地版”运行

## 本地启动

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)

## Supabase 初始化

1. 创建一个 Supabase 项目
2. 在 SQL Editor 执行 [schema.sql](D:\Projects\NNB\supabase\schema.sql)
3. 把 `Project URL` 和 `Publishable Key` 配到 `.env.local`
4. 如需服务端写入同步接口，再补 `SERVICE_ROLE_KEY`

当前代码里：

- 未配置 Supabase 时，设置页会显示“未配置云同步”
- 已配置后，可接登录、默认设置同步、任务元数据同步
- 图片本身仍不会上传到 Supabase Storage

## Gemini 模型建议

默认配置已经按官方图像链路预设：

- 默认图像模型：`gemini-3.1-flash-image-preview`
- 高质量图像模型：`gemini-3-pro-image-preview`
- 默认文本模型：`gemini-3-flash-preview`

这些默认值都可以在设置页改。

## 已完成的关键体验

- 顶部移除了套餐入口，改为 `带货`
- 图片支持点击放大
- 带货支持批量文案，并发限制为 5
- 历史页支持结果包下载和文案包导出
- 历史恢复不再只是恢复参数，也会尝试恢复本地输入素材
- 结果页和历史页都持续提醒用户及时下载

## 已知边界

- 服装试穿/换装目前基于 Gemini 图像编辑链路，后续如要更稳定的版型一致性，建议预留专用 VTON 能力
- HEIC/HEIF 是否能顺利预览，取决于浏览器环境
- 跨设备不会同步图片和输入素材，只同步元数据

## 构建与检查

```bash
npm run lint
npm run build
```

## 上线建议

- 推荐部署到 Vercel
- 先用本地版或 Supabase 元数据版上线验证流程
- 等业务稳定后，再接 `Supabase Storage` 或 `Cloudflare R2` 做图片持久化
