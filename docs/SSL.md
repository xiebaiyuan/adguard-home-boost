# SSL 证书说明

## 自签名证书

如果 AdGuardHome 使用了自签名证书（多数本地部署情况），需要禁用 SSL 验证。

### 方法一：网页配置（推荐）

在 ⚙️ 配置面板填写 AdGuardHome 地址时，后端自动处理 SSL 验证关闭。

### 方法二：环境变量

在 `.env` 文件中设置：

```
ADGH_SKIP_VERIFY=true
```

### 方法三：手动忽略

跳过前端代理验证（仅调试时使用）：

```bash
export NODE_TLS_REJECT_UNAUTHORIZED=0
npm run dev
```

> ⚠️ `NODE_TLS_REJECT_UNAUTHORIZED=0` 会全局关闭 Node.js 的 SSL 验证，**仅建议在本地开发环境使用**。

## 使用 HTTPS 地址

如果通过 Cloudflare Tunnel / Nginx 反向代理访问 AdGuardHome，需要：
- 确保代理层配置了合法证书（如 Let's Encrypt）
- 此时 `ADGH_SKIP_VERIFY` 应保持 `false`（默认值）

## 连接问题排查

| 现象 | 原因 | 解决 |
|------|------|------|
| `502 Bad Gateway` | Cloudflare 无法回源到内网 IP | 改用内网地址直接访问 |
| `UNABLE_TO_VERIFY_LEAF_SIGNATURE` | 自签名证书未加入信任链 | 设置 `ADGH_SKIP_VERIFY=true` |
| `ECONNREFUSED` | AdGuardHome 未运行或端口错误 | 检查 AdGuardHome 监听地址和端口 |
| `401 Unauthorized` | 用户名/密码错误 | 检查凭据 |

### 验证 AdGuardHome API 是否可达

```bash
curl -k -u "用户名:密码" "http://192.168.8.97/control/querylog?limit=1"
```

返回 JSON 表示连接正常。`-k` 用于跳过自签名证书验证。
