# Read the Room 

本版本把聊天记录导入、对象画像、对话预演和复盘接入 DMXAPI，Windows 微信记录可通过 WeChatBridge 的本地收件箱读取。本仓库提供网站代码和第三版 3D 模型，用于本地运行与协作。没有部署在线服务。

## 发布 HTTPS 作品链接

已加入云端部署配置：[部署到 Render](https://render.com/deploy?repo=https://github.com/SouthHeaven-157/123)。完整说明见 [DEPLOY.md](DEPLOY.md)。云端采用浏览器独立保存和 AI 访问码，在部署平台配置模型密钥。

本机运行方式保持不变。以下是本机版说明，云端差异以 DEPLOY.md 为准。

## 首次配置

复制 `.env.example` 为 `.env.local`，填入自己的 DMXAPI 和 Jev 密钥。Windows ZIP 导入需要 Python 3，可在 `.env.local` 中设置 `PYTHON_EXE=C:/实际路径/python.exe`。未配置密钥时仍能打开网站，AI 功能会提示配置。安装 Node.js 18 或更新版本后，运行 `node server.cjs`。本项目不需要 npm install。

## 启动

在本目录运行 `node server.cjs`，打开 <http://127.0.0.1:4173>，或使用 `启动预览.ps1`。Node.js 18 或更新版本需要能运行服务端的 `fetch`。模型密钥保存在被 Git 忽略的 `.env.local`；如需换模型，在网页顶部点“选择模型”。模型请求会按 DMXAPI 账户计费。

## 微信记录

微信选中并分享聊天记录给 WeChatBridge 后，页面“从微信导入”点“刷新微信记录”，选择要分析的记录。Windows 收件箱路径遵从 WeChatBridge 的约定：`%LOCALAPPDATA%\WeChatBridge\Inbox\Ready`。需要单独安装 WeChatBridge 并分享记录后，页面才能读取已提交的材料。尚未安装时，可直接在页面上传微信分享生成的 ZIP，或将 ZIP 放入 `data/wechat-imports` 后刷新。

ZIP 暂存在 D 盘工作区，解析完成后即删除，不展开附件。当前识别微信原生 `聊天记录.txt` 格式以及 TXT、MD、带说话人字段的 JSON。不会读取微信数据库，也不会从全部会话自动抓取聊天。图片、语音与文件附件不送去分析。

## 使用流程

导入微信记录或本地文件，检查“我在记录中的昵称”，再点击“生成对象画像”。确认对象后进入预演。发送消息只会交给 DMXAPI 模型模拟对象回复，不会发到微信。对话中可从自己的消息分支，另试一种措辞；“AI 语境复盘”分析草稿，“AI 分支复盘”对照两条路径。

实时雷达使用 `jev-1.13.0`，通过 DMXAPI TypeSafe `POST /typesafe/v1/systemone` 调用，使用独立的 Jev 密钥。它会分析五个维度：被冒犯、语气冲、歧义、不可执行、权力否定。评分按 Jev 的 0–4 档结果换算成 0–100，界面同时展示各维度置信度和材料依据不足提示；数值不是现实中的冒犯概率。

默认停止输入 1.5 秒后自动分析，可关闭“自动分析”后点击“立即分析”。判研包含对象画像、最近 12 条对话、共享背景、沟通目标、边界和可选话语位置。私下目标与边界提供给 Jev 和复盘助手，不传给模拟对方。空草稿、等待分析或接口失败会显示“—”，不会伪装成零风险。自动请求串行处理，旧草稿结果不会覆盖当前草稿；相同输入在服务端缓存 3 分钟。手动立即分析会请求新结果。

“AI 改写并用 Jev 复检”由原聊天模型提出候选表达，再用 Jev 对候选评分，展示修改前后的变化。候选不会自动替换草稿，需点击“采用这版表达”。五维判研覆盖全文，逐句问题定位最多覆盖前 6 句。聊天模型仍使用原有 DMXAPI 配置。

当前 DMXAPI 账户返回的模型列表只有 `deepseek-v4-flash`，网页模型选择器读取服务端实时列表。模型服务端使用 OpenAI 兼容的 `POST /v1/chat/completions` 接口。

聊天预演页已加入“面对面预演”三维窗口，可切换面试办公室、办公会议室和学校走廊。视角始终固定在用户位置。等待模型时对方倾听，回复出现时播放说话动作并显示相同文本，随后恢复待机。切换路径或退出聊天页会复位动作。场景可收起，收起后暂停渲染。所有模型由同一个 4173 网站服务提供，无需另外启动 3D 预览服务。

角色外观仍是固定预设，不按聊天人物自动生成外貌。当前没有语音播放或音素口型；说话时长按文字长度估算，嘴型仅为节奏演示。`dialogue-3d/assets-v3` 保留三套模型，网页直接使用现有资源，无需复制或重新下载。

保存工作区会在 `data/workspace.json` 写入你选择保存的材料、画像和分支；它包含原始聊天内容，请妥善保管。微信临时 ZIP 通过后端解析后会立即删除。上传到模型的记录由 DMXAPI 按其服务条款处理。

## 本地接口

- `GET /api/status`：模型和微信收件箱状态
- `GET /api/models`、`POST /api/settings`：查看及切换模型
- `POST /api/upload`、`GET /api/bridge`、`POST /api/bridge/import`：导入文件或读取 WeChatBridge 收件箱
- `POST /api/personas`、`POST /api/rehearse`、`POST /api/review`：生成画像、模拟回复及复盘
- `POST /api/radar`：Jev 五维雷达与逐句判研
- `GET/POST /api/workspace`：本地工作区保存与恢复

DPAPI 或 Windows 凭据库尚未配置；密钥保存在本地明文 `.env.local`。请勿把此文件、`data/` 或真实聊天记录提交到版本库。
