# 邮箱验证与找回密码配置

用户名密码注册仍可使用，不绑定邮箱前必须确认：忘记密码且丢失恢复码后无法找回。只有成功验证的邮箱才能用于登录和重设密码。邮件服务未配置时不会假装已经发信，邮箱验证入口暂不开放，原有账号和收藏不受影响。

## 1. 验证发信域名

1. 使用 GitHub 注册并登录 https://resend.com/ 。
2. Domains → Add Domain，填 `notify.conclusionsearchblai.dpdns.org`，不要包含协议或路径。
3. 在 Cloudflare 中打开 `conclusionsearchblai.dpdns.org` 域名 → DNS → Records，按 Resend 提供的类型、名称、值逐条添加发信验证记录。
4. DNS 名称和值必须复制自己 Resend 页面里的内容；保留网站原有的 DNS，不删除已有记录，不启用不需要的收信功能。
5. 回 Resend 点 Verify / Verify DNS Records，直到发送域名状态显示 Verified。

`notify` 是专门用于发信的子域名，不更改网站地址，也不需要购买收件邮箱。

## 2. 配置 Cloudflare Worker

在 Resend → API Keys 创建用于该发信域名的发信密钥。密钥仅保存在 Cloudflare Secret，不要粘贴到聊天、源码或 GitHub。

Cloudflare → Workers & Pages → conclusionsearchblai → Settings → Variables and Secrets：

| 名称 | 类型 | 内容 |
| --- | --- | --- |
| `RESEND_API_KEY` | Secret | Resend 创建的 API 密钥 |
| `EMAIL_FROM` | Text | `剧集汇 <accounts@notify.conclusionsearchblai.dpdns.org>` |
| `EMAIL_DAILY_LIMIT` | Text，选填 | 默认 `90`，用于限制网站每日验证码发送请求总量；按自己的服务额度调整 |

保存并部署。项目开启 `keep_vars`，后续 GitHub 自动部署会保留控制台配置的变量。Resend 订阅额度与费用以其控制台显示为准。

## 3. 使用

- 新用户可勾选「绑定邮箱（选填）」并验证；不绑定仍可注册。
- 旧账号先用用户名密码登录，再点右上角「绑定邮箱」，输入当前密码并验证邮箱。
- 已验证邮箱可作为登录名，与密码一起登录。
- 忘记密码：登录窗口选「使用邮箱找回密码」，收验证码后设置新密码。重设会退出其他会话并更新恢复码，不删除收藏。

## 验证码规则

验证码有效期 10 分钟，最多 5 次验证尝试，只能使用一次。发送间隔至少 60 秒，有邮箱/IP/全站发送额度限制。绑定或更换邮箱需要当前密码，且不能占用已绑定其他账号的邮箱。测试使用模拟发信接口，不会给真实邮箱发送测试邮件。
