## 家里上了 AdGuard Home，平均延迟一直下不去，看着烦

部署 AdGuard Home 大半年了，拦截效果确实不错，但有个事一直膈应我 —— 打开自带的统计面板，就看到一个总的平均延迟数字，**完全不知道是哪个域名在拖后腿**。

到底是哪个倒霉域名把平均值拉高的？是某台 IoT 设备在疯狂请求不存在的域名？还是某个上游 DNS 间歇性抽风？

自带面板不告诉你。

## 于是撸了一个日志分析工具

ADGH 自带的查询日志其实很详细，但缺少按域名的**聚合分析能力**。翻了几天文档，和 DeepSeek 一起搞了个小工具：

**AdGuard Home Boost** — 一个增强型前端面板。

原理很简单：把 ADGH 的查询日志拉下来，按域名做百分位延时统计（P50/P95/P99/Max），缓存/非缓存分开算，然后一目了然地排个序。

## 效果

打开面板，点一下刷新，几秒钟后：

- **哪个域名最慢** — 按 P95 降序排列，最慢的排最上面
- **慢在哪** — 是上游慢还是缓存没命中？cached / uncached 分开展示
- **谁在查** — 展开域名详情，直接看到是哪个设备（IP + 主机名）在查
- **被拦截的也有记录** — 哪个规则拦了这个域名，拦了多少次，清清楚楚
- **趋势图** — 双 Y 轴，查询量 + 屏蔽率变化一目了然

看完之后我把家里一个小米的 IoT 设备抓出来扔进了隔离 VLAN，平均延迟直接从 180ms 降到了 25ms。

## 部署

支持 Docker，一行搞定：

```bash
docker run -d --name adguard-home-boost \
  -p 3080:3080 \
  -e ADGH_URL=http://你的adgh地址 \
  -e ADGH_USER=用户名 \
  -e ADGH_PASSWD=密码 \
  xiebaiyuan/adguard-home-boost:latest
```

浏览器打开 http://localhost:3080 就能看到面板了。

不想用 Docker 也行，本地 Node 18+ 直接跑：

```bash
git clone https://github.com/xiebaiyuan/adguard-home-boost
cd adguard-home-boost
npm install
npm run dev
```

项目地址扔给 AI（Claude/ChatGPT/DeepSeek），说"帮我部署一下"，它自己就能搞定。

## 适合谁

- 家里有 AdGuard Home，想知道**到底是哪个域名在拖慢 DNS**
- 怀疑有设备在泄漏 DNS 查询到上游，想抓出来
- 想看看 mDNS 或者其他奇怪域名是不是在往外跑

有啥奇怪的域名 DNS 耗时异常、mDNS 请求泄漏到公网上游、某个设备在疯狂请求不存在的域名 —— 打开面板，一览无余。

---

GitHub: [github.com/xiebaiyuan/adguard-home-boost](https://github.com/xiebaiyuan/adguard-home-boost)
