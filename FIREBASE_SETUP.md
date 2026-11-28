# Firebase 托管邮箱登录

网站仍部署在 Cloudflare，账号收藏仍保存在 D1。用户名密码与恢复码方式继续可用；邮箱选填，无邮箱注册需要确认丢失密码和恢复码后的风险。启用 Firebase 后，邮箱验证与重设密码使用邮件链接，不是数字验证码，不需要 Resend、自购发信域名或 Firebase Analytics。

## 当前项目

- Project ID：`my-aisearch`
- Auth domain：`my-aisearch.firebaseapp.com`
- Web API Key：已由项目所有者提供并作为公开配置写入 Wrangler 的 `FIREBASE_API_KEY`。
- 仅使用 Firebase Authentication，不启用 Analytics、Firestore、Storage 或付费服务。

Web API Key 不是管理员私钥；项目不需要、也不包含服务账号私钥。Firebase 后台 API 调用由 Worker 发起，密码仅用于请求身份服务；不在代码或日志中保存邮箱密码。Firebase 返回的令牌由 Google `accounts:lookup` 校验，并校验本项目的 audience、issuer、UID 和过期时间；不接受浏览器直接提交的 UID 或 ID Token 作为登录凭证。

## 控制台配置

1. Firebase → Authentication → 登录方式：开启「电子邮件/密码」，无需开启邮件链接无密码登录。
2. Authentication → 设置 → 已获授权的网域：添加 `conclusionsearchblai.dpdns.org`，不带协议或路径。
3. 若也使用 Workers 默认域名访问，可额外添加 `conclusionsearchblai.1464682661.workers.dev`。

到这里即可使用 Firebase 默认的邮件验证、重设密码页面。

### 可选：让邮件链接在本站打开

Authentication → Templates（模板）→ 邮箱验证 / 密码重置 → 编辑 → 自定义操作网址，设为：

`https://conclusionsearchblai.dpdns.org/auth/email`

本站已提供这一路径，用于验证邮箱和设置新密码。这样用户点击邮件后留在本站，由 Worker 与 Firebase 通信。验证码链接必须在 Firebase 模板里设置，不能只把网站地址填进普通邮件内容。若使用默认 Firebase 邮件页面，国内访问需实际测试；本站不承诺所有网络都能直连 Google 服务。

## 使用

- 新用户：勾选「绑定邮箱」，填写用户名、邮箱和密码，点击「发送验证邮件」或「注册并登录」。点开邮件链接验证后，回到网站点击「已验证，注册并登录」。
- 旧用户：先用原用户名密码登录，点「绑定邮箱」，填写邮箱和当前密码，点击发送验证邮件；验证后返回点「已验证，完成绑定」。不会改变原账号 ID，也不会删除收藏。
- 已绑定用户：可用邮箱或原用户名加密码登录。邮箱账号密码由 Firebase 管理。
- 忘记密码：选择「使用邮箱找回密码」，发送邮件并在链接页设置新密码。使用本站操作页面重设会撤销旧本站会话，云端收藏保留。
- 恢复码仍可恢复原本的本地账号；若该账号已迁移到 Firebase，使用恢复码恢复会停用原 Firebase 关联并解除邮箱绑定，保留收藏，后续重新绑定需要重新验证。Firebase 原生新邮箱账号不生成本地恢复码，使用邮件找回。
- 退出登录会清除本站和 Firebase 刷新 Cookie。Firebase 会话使用短期本站 Cookie，并通过 HttpOnly、Secure、SameSite 刷新 Cookie 续期；刷新令牌不暴露给页面脚本。

## 部署及测试

执行 `npm run deploy`，自动应用追加的 `0006_firebase_accounts.sql`。保留原 `0004` 和 `0005` 迁移。

`tests/firebase-workflow.mjs` 模拟 Google 接口，覆盖未验证邮箱拒绝登录、项目边界、已有账号绑定、跨浏览器收藏、会话刷新、密码重设与退出登录，不向真实收件人发送测试邮件。上线后应由站长用自己的邮箱实测邮件送达；注意垃圾邮件文件夹和 Firebase 的免费额度。
