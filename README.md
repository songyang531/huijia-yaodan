# 回家药单 · 复诊准备助手

移动端优先的医疗黑客松原型。Next.js App Router、TypeScript、Tailwind CSS 4、shadcn/ui（Base UI）、React Context。页面始终使用 `max-w-md mx-auto`，最大宽度 448px。

## 本地运行

需要 Node.js 22.13+ 与 pnpm。

```bash
pnpm install
pnpm dev
```

打开 http://127.0.0.1:3000。默认无需 API 密钥，点击“演示整理，交给药师”即可加载包含 3 个冲突和 1 个待核对项的固定虚构案例。`pnpm build && pnpm start` 运行 Next.js 生产版本。

```bash
pnpm test       # 工作流、AI 约束、HTTP 接口测试
pnpm typecheck  # TypeScript 校验
pnpm build     # Next.js 生产构建
```

## 模块与完整源码

| 模块           | 文件                                                   | 职责                                                                                                                   |
| -------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 全局数据模型   | `types/handoff.ts`                                     | 完整保留 MaterialSource、VerifyStatus、MedicationItem、HandoffTask；另用伴随记录保存材料日期、权限成员、核对依据与版本 |
| 导航与移动布局 | `app/page.tsx`、`app/globals.css`                      | 三个角色 Bottom Tabs、任务阶段、统一手机宽度、安全区域                                                                 |
| 家庭端         | `components/views/family-view.tsx`                     | 模拟材料 / 本地图片添加、日期来源必填、逐成员共享开关、家属口述、AI 整理                                               |
| 药师端         | `components/views/pharmacist-view.tsx`                 | 原图对照、冲突高亮、名称与用法编辑、状态编辑、核对依据、生成交接单                                                     |
| 交接端         | `components/views/caregiver-view.tsx`                  | 大字号安排、药师填写的变化、理解反馈与疑问回流                                                                         |
| 材料原图       | `components/material-preview.tsx`、`public/materials/` | 缩略图、可放大查看的虚构原始材料                                                                                       |
| 全局状态       | `context/handoff-context.tsx`、`lib/workflow.ts`       | 共享状态、纯状态机、版本失效策略、流程门禁                                                                             |
| Mock           | `lib/mock-data.ts`                                     | 虚构人物、材料、冲突与未知状态                                                                                         |
| AI 系统约束    | `lib/ai/prompt.ts`                                     | 完整内嵌需求中的 System Prompt 与 JSON 提取协议                                                                        |
| AI 数据校验    | `lib/ai/schema.ts`、`lib/ai/normalize.ts`              | 严格 JSON Schema、Zod、证据关联、未确认强制标注、治疗动作隔离                                                          |
| 服务端 API     | `app/api/extract/route.ts`                             | `POST /api/extract`，OpenAI Responses 多模态输入，密钥仅在服务器                                                       |
| 自动化测试     | `scripts/test.mjs`                                     | 直接测试实际状态机、规范化代码和 API route                                                                             |

## 三分钟演示路线

1. **家庭端**：查看两份虚构材料的日期、来源与原图。开启共享后逐成员勾选；未选成员仍是“不共享”，关闭开关即撤销选择。
2. 点击 **“演示整理，交给药师”**。这里使用固定案例，修改图片或口述不会被当作真实 OCR 分析。
3. **药师端**：展示氨氯地平的频率差异、阿司匹林未见于出院单、二甲双胍规格模糊；阿托伐他汀为普通待核对项。“生成交接单”在任何条目未核对时均不可用。
4. 对照原图，编辑每条药物的明确用法，填写核对依据，再逐项选择“已逐项核对（演示）”。对于资料中没有答案的药物，必须由演示药师提供另外核实的虚构医生记录；原型不会替你猜测剂量或自动消除疑问。
5. 若展示频率变化，仅将已人工核实的说明写入“需要照护者关注的变化”。填写演示核对人，再点击 **“确认无误，生成交接单”**。
6. **交接端**：展示大号字体与变化区域，点击 **“我有疑问，需重新解释”**，疑问立即回到药师端。填写重新解释、再次生成后，照护者需要重新确认。
7. 点击 **“我已完全理解”** 完成闭环。后续修改任意用法，该条核对、旧交接单和旧理解反馈都会失效。

## 接入真实多模态 AI（可选）

复制 `.env.example` 为 `.env.local`，配置后重启 Next.js：

```dotenv
ENABLE_LIVE_AI=true
OPENAI_API_KEY=你的服务端密钥
OPENAI_MODEL=你账号可用且支持图片和结构化输出的模型名称
```

家庭端添加真实图片并明确勾选 AI 处理同意后，才发送本次真实图片与家属说明。支持 JPG、PNG、WebP，单张 3 MB、最多 6 份、请求体总计 16 MB。演示图片不发送；首次真实上传会清除未编辑的虚构口述。默认没有配置真实服务时返回清楚的 503 错误，**不会把 Mock 当成上传图片的识别结果**。

实现依据：[OpenAI 图片输入文档](https://developers.openai.com/api/docs/guides/images-vision)、[结构化输出文档](https://developers.openai.com/api/docs/guides/structured-outputs)。请求使用 Responses API、`input_image`、严格 JSON Schema、`store: false`、45 秒上游超时。真实服务未进行带密钥的端到端调用验证。

服务端在提示词之外再次校验：AI 只能输出 `PENDING_AI` / `CONFLICT_DETECTED`；证据引用必须来自请求；家庭信息与非明确医嘱强制标记“待确认”；治疗调整表述被保守隔离。关键词过滤不是完整的医学语义安全分类器，药师核对仍不可省略。

## 原型边界

- 三个视角、核对身份及成员权限按要求模拟，没有登录、真实药师认证或服务端成员 ACL；选择成员不会发送消息或创建外链。
- 状态仅保存在当前页面内存，刷新即回到演示；真实图片不写入 localStorage 或数据库。角色切换不改变任务阶段。
- `PHARMACIST_VERIFIED` 在本原型代表演示操作者的逐项确认，界面和交接单均明确标注“演示”，不能作为真实专业审核证明。
- 正式临床使用前需要服务端身份认证、持久化版本与审计、成员授权及配额限制。当前 live AI 默认关闭，仅适合可信演示环境。
- 拒绝推断停药或换药；未知内容必须补充核实后才能进入最终安排，不能通过“一键确认全部”跳过。
- 可选 WebMCP 只提供流程进度读取和视角切换，不开放药物核对、发布或理解确认。浏览器支持时自动注册；当前未验证浏览器 WebMCP 契约，不影响常规交互。
- 已执行状态机/API 自动化测试和生产构建；未进行浏览器点击或截图测试。

## 私有演示部署

项目保留 Sites/Vinext 构建适配：`pnpm site:build` 生成 Cloudflare Worker 演示版本。默认 `dev` / `build` / `start` 使用真正的 Next.js。私有站点不设置真实 AI 密钥，仅使用固定演示数据。`.openai/hosting.json` 只保存部署项目标识。
