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

### 说明

跳过证书校验只作用于后端到 AdGuardHome 的那条连接（按请求单独放宽），不会关闭整个进程的 SSL 验证。
除上面两条路径外没有别的开关；临时排查连通性用下面的 `curl -k`。

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
curl -k -u "用户名:密码" "http://192.168.1.100/control/querylog?limit=1"
```

返回 JSON 表示连接正常。`-k` 用于跳过自签名证书验证。
