# 发布 HTTPS 作品链接

本仓库已包含 Render 的 `render.yaml`、Dockerfile 和 Node.js/Python 环境。源码仓库地址不是作品运行地址；部署成功后复制 Render 返回的 HTTPS 地址。

[部署到 Render](https://render.com/deploy?repo=https://github.com/SouthHeaven-157/123)

## 最少操作

1. 登录 Render，并授权访问此 GitHub 仓库。
2. 打开上方部署链接，使用 `main` 分支的 Blueprint。
3. 填入 `DMX_API_KEY` 和 `JEV_API_KEY`，在 Render 后台填写，不能提交进 GitHub。
4. 创建服务，等待部署状态变为 Live。复制平台分配的完整 `https://…onrender.com` 地址，用于作品提交。
5. 在服务 Environment 中查看或自行设置 `API_ACCESS_CODE`（至少 16 个字符），仅把该访问码交给需要体验 AI 的评审或伙伴。不要分享模型密钥。

默认使用 `plan: free`，不自动创建付费磁盘或数据库。如果账号不支持该规格，先在 Render 页面确认可用方案及价格，再选择其他规格。

## 云端行为

- 页面与三维资源可公开打开。模型请求需要访问码，登录后使用 HttpOnly、SameSite Cookie，HTTPS 部署下同时启用 Secure，约八小时有效。
- AI 请求有频率与并发限制；访问码不是完整的用户账号系统。公开大规模开放前应增加账号、配额和计费管理。
- 云端不读取部署者电脑上的 WeChatBridge 收件箱。通过页面上传 ZIP、TXT、MD 或 JSON，单文件上限 10 MB。文件解析后即删除临时副本。
- 点击保存，只将工作区写入当前浏览器，不发送至共享工作区文件。不同设备不自动同步，共用同一个浏览器仍会共用该浏览器的记录。
- 生成画像、聊天、复盘或雷达时，所选材料仍会发送给模型服务。浏览器关闭不会取消已提交的模型请求。
- 云端模型由部署环境变量配置，访客不能修改全站模型设置。健康检查位于 `/healthz`，只有模型服务出错不会让静态作品页面停服。
- 无数据库依赖。服务器临时目录可随重启清除；Render 空闲休眠和可用性以账号与当前服务规格为准。

## 环境变量

| 名称 | 用途 |
|---|---|
| `APP_MODE=cloud` | 开启公网部署模式 |
| `PUBLIC_URL` | 自有域名部署时填写完整 HTTPS 地址。Render 默认自动使用 `RENDER_EXTERNAL_URL` |
| `API_ACCESS_CODE` | AI 功能访问码，Blueprint 默认随机生成 |
| `DMX_API_KEY` / `JEV_API_KEY` | 两个模型服务密钥 |
| `DMX_BASE_URL` / `DMX_MODEL` | 默认 DMXAPI 和 `deepseek-v4-flash` |
| `JEV_API_URL` / `JEV_MODEL` | 默认 SystemOne 接口和 `jev-1.13.0` |
| `HOST` / `PORT` | 容器监听，默认 `0.0.0.0:10000`，Render 可注入 PORT |
| `PYTHON_EXE` | Docker 默认 `/usr/bin/python3` |
| `DATA_DIR` | 临时处理目录，Docker 默认 `/app/data` |

## 本地运行

未设置 `APP_MODE=cloud` 时仍使用本机模式，在 `127.0.0.1:4173` 监听，可使用原 WeChatBridge 读取和本地文件保存。公网模式要求明确的 HTTPS 地址和非空访问码，缺少配置时会拒绝启动。

`npm test` 运行云端接口测试。运行环境需要 Node.js 22 和 Python 3，可通过 `TEST_PYTHON` 指定测试 Python。
