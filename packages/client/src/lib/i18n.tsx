import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Lang = 'zh' | 'en'

const zh: Record<string, string> = {
  'app.title': 'AdGuard Home Boost',
  'app.subtitle': '',

  'header.theme.light': '切换到浅色模式',
  'header.theme.dark': '切换到深色模式',
  'header.lang': 'English',

  'status.ready': 'Ready',
  'status.waiting': '等待数据',
  'status.protected': '保护中',
  'status.paused': '已暂停',
  'status.protecting': '保护...',
  'status.updated': '更新于',

  'section.overview': '分析概览',
  'section.stats': '实时统计',
  'section.latency': '域名延时分布',
  'section.domainRank': '域名延时排行',
  'section.trend': '查询趋势',

  'kpi.totalQueries': '总查询',
  'kpi.cacheHitRate': '缓存命中率',
  'kpi.p50': 'P50 延时',
  'kpi.p95': 'P95 延时',
  'kpi.slow': '慢查',
  'kpi.uncached': 'uncached',
  'kpi.dash': '--',

  'stats.avgProcess': '平均处理',
  'stats.upstreams': '上游服务数',
  'stats.blocked': '已屏蔽',
  'stats.allowed': '已放行',
  'stats.clients': '客户端数',
  'stats.blockRate': '屏蔽比例',
  'stats.typeDist': '查询类型分布',
  'stats.clientRank': '客户端排行',
  'stats.blockDomainRank': '屏蔽域名排行',
  'stats.upstreamResp': '上游服务响应',
  'stats.noBlockData': '暂无屏蔽记录',
  'stats.loadFail': '实时统计加载失败',

  'domain.search': '搜索域名...',
  'domain.allTypes': '所有类型',
  'domain.count': '个域名',
  'domain.detail': '域名详情',
  'domain.noMatch': '没有域名匹配',
  'domain.noData': '暂无数据，请先刷新',
  'domain.export': '导出日志',
  'domain.detailFail': '详情加载失败',
  'domain.resolveResult': '解析结果',
  'domain.upstream': '上游服务器',
  'domain.clientSource': '客户端来源',
  'domain.blockRules': '拦截规则',
  'domain.recentQueries': '最近查询',
  'domain.times': '次',
  'domain.avg': '均',

  'table.domain': '域名',
  'table.type': '类型',
  'table.count': '次数',
  'table.cacheRate': '缓存率',
  'table.blocked': '拦截',
  'table.p50': 'P50',
  'table.p60': 'P60',
  'table.p70': 'P70',
  'table.p95': 'P95',
  'table.p99': 'P99',
  'table.slowQuery': '慢查询',
  'table.max': 'MAX',

  'chart.tooltip.queries': '查询',
  'chart.tooltip.blocked': '屏蔽',
  'chart.tooltip.blockRate': '屏蔽率',
  'chart.tooltip.sma3': '3日均线',
  'chart.empty': '暂无数据',
  'chart.domainUnit': '个域名',
  'chart.ratio': '占比',

  'pie.total': '总计',

  'trend.fast': '<200ms',

  'time.recent24h': '最近 24h',
  'time.recent7d': '最近 7 天',
  'time.recent30d': '最近 30 天',

  'btn.refresh': '刷新分析数据',
  'btn.config': '配置 AdGuardHome 连接',
  'btn.export': '导出 CSV',
  'btn.clearCache': '清除 DNS 缓存',
  'btn.manage': 'AdGuardHome 管理',
  'btn.statsToggle': '统计',
  'dialog.close': '关闭',
  'dialog.saving': '保存中...',
  'dialog.save': '保存',
  'dialog.cancel': '取消',
  'dialog.add': '添加',
  'dialog.deleteProfile': '删除这个配置',
  'dialog.manage.title': 'AdGuardHome 管理',
  'dialog.manage.security': '安全功能',
  'dialog.manage.safebrowsing': '安全浏览',
  'dialog.manage.safebrowsingDesc': '拦截恶意和钓鱼网站',
  'dialog.manage.parental': '家长控制',
  'dialog.manage.parentalDesc': '拦截成人内容',
  'dialog.manage.customRules': '自定义过滤规则',
  'dialog.manage.rulesPlaceholder': '每行一条规则，例如：||example.com^',
  'dialog.manage.saveRules': '保存规则',
  'dialog.manage.filtersHint': '过滤器（点击开关启/停，点击编辑修改 URL）',
  'dialog.manage.rulesUnit': '条',
  'dialog.manage.disabled': '已禁用',
  'dialog.manage.addFilterTitle': '添加过滤器订阅',
  'dialog.manage.filterName': '名称',
  'dialog.manage.filterUrl': 'URL',
  'dialog.manage.rewrites': 'DNS 重写',
  'dialog.manage.noRewrites': '暂无重写规则',
  'dialog.manage.rewriteDomain': '域名',
  'dialog.manage.rewriteAnswer': '目标 IP',
  'dialog.manage.maintenance': '维护',
  'dialog.manage.resetting': '重置中...',
  'dialog.manage.resetStats': '重置统计',
  'dialog.manage.clearing': '清空中...',
  'dialog.manage.clearLog': '清空查询日志',
  'dialog.config.title': 'AdGuardHome 配置',
  'dialog.config.existing': '已有配置',
  'dialog.config.nameLabel': '配置名称',
  'dialog.config.namePlaceholder': '例如：路由器、办公室',
  'dialog.config.urlLabel': 'AdGuardHome 地址',
  'dialog.config.urlPlaceholder': 'http://192.168.1.100',
  'dialog.config.userLabel': '用户名',
  'dialog.config.passLabel': '密码',
  'dialog.config.rangeLabel': '分析时间范围',
  'dialog.config.save': '保存并连接',
  'dialog.config.defaultProfile': '默认',
  'dialog.config.errFields': '请填写所有字段',
  'dialog.config.errName': '请输入配置名称',
  'dialog.config.errConfig': '配置失败',
  'dialog.config.errSave': '保存失败',
  'domain.loadMore': '加载更多',
}

const en: Record<string, string> = {
  'app.title': 'AdGuard Home Boost',
  'app.subtitle': '',

  'header.theme.light': 'Switch to light mode',
  'header.theme.dark': 'Switch to dark mode',
  'header.lang': '中文',

  'status.ready': 'Ready',
  'status.waiting': 'Waiting for Data',
  'status.protected': 'Protected',
  'status.paused': 'Paused',
  'status.protecting': 'Protecting...',
  'status.updated': 'Updated at',

  'section.overview': 'Overview',
  'section.stats': 'Real-time Stats',
  'section.latency': 'Latency Distribution',
  'section.domainRank': 'Domain Latency Rank',
  'section.trend': 'Query Trends',

  'kpi.totalQueries': 'Total Queries',
  'kpi.cacheHitRate': 'Cache Hit Rate',
  'kpi.p50': 'P50 Latency',
  'kpi.p95': 'P95 Latency',
  'kpi.slow': 'Slow',
  'kpi.uncached': 'uncached',
  'kpi.dash': '--',

  'stats.avgProcess': 'Avg Processing',
  'stats.upstreams': 'Upstreams',
  'stats.blocked': 'Blocked',
  'stats.allowed': 'Allowed',
  'stats.clients': 'Clients',
  'stats.blockRate': 'Block Rate',
  'stats.typeDist': 'Query Type',
  'stats.clientRank': 'Top Clients',
  'stats.blockDomainRank': 'Top Blocked',
  'stats.upstreamResp': 'Upstream Response',
  'stats.noBlockData': 'No blocked records',
  'stats.loadFail': 'Failed to load real-time stats',

  'domain.search': 'Search domains...',
  'domain.allTypes': 'All Types',
  'domain.count': 'domains',
  'domain.detail': 'Domain Details',
  'domain.noMatch': 'No domain matches',
  'domain.noData': 'No data yet',
  'domain.export': 'Export Log',
  'domain.detailFail': 'Failed to load details',
  'domain.resolveResult': 'Resolved Addresses',
  'domain.upstream': 'Upstream Servers',
  'domain.clientSource': 'Client Sources',
  'domain.blockRules': 'Block Rules',
  'domain.recentQueries': 'Recent Queries',
  'domain.times': 'x',
  'domain.avg': 'avg',

  'table.domain': 'Domain',
  'table.type': 'Type',
  'table.count': 'Count',
  'table.cacheRate': 'Cache',
  'table.blocked': 'Blocked',
  'table.p50': 'P50',
  'table.p60': 'P60',
  'table.p70': 'P70',
  'table.p95': 'P95',
  'table.p99': 'P99',
  'table.slowQuery': 'Slow',
  'table.max': 'MAX',

  'chart.tooltip.queries': 'Queries',
  'chart.tooltip.blocked': 'Blocked',
  'chart.tooltip.blockRate': 'Block Rate',
  'chart.tooltip.sma3': '3-day SMA',
  'chart.empty': 'No data',
  'chart.domainUnit': 'domains',
  'chart.ratio': 'ratio',

  'pie.total': 'Total',

  'trend.fast': '<200ms',

  'time.recent24h': 'Last 24h',
  'time.recent7d': 'Last 7 Days',
  'time.recent30d': 'Last 30 Days',

  'btn.refresh': 'Refresh analysis data',
  'btn.config': 'Configure AdGuardHome',
  'btn.export': 'Export CSV',
  'btn.clearCache': 'Clear DNS cache',
  'btn.manage': 'AdGuardHome Management',
  'btn.statsToggle': 'Stats',
  'dialog.close': 'Close',
  'dialog.saving': 'Saving...',
  'dialog.save': 'Save',
  'dialog.cancel': 'Cancel',
  'dialog.add': 'Add',
  'dialog.deleteProfile': 'Delete this profile',
  'dialog.manage.title': 'AdGuardHome Management',
  'dialog.manage.security': 'Security',
  'dialog.manage.safebrowsing': 'Safe Browsing',
  'dialog.manage.safebrowsingDesc': 'Blocks malware and phishing sites',
  'dialog.manage.parental': 'Parental Control',
  'dialog.manage.parentalDesc': 'Blocks adult content',
  'dialog.manage.customRules': 'Custom Filtering Rules',
  'dialog.manage.rulesPlaceholder': 'One rule per line, e.g. ||example.com^',
  'dialog.manage.saveRules': 'Save rules',
  'dialog.manage.filtersHint': 'Filters (click the switch to toggle, click to edit the URL)',
  'dialog.manage.rulesUnit': 'rules',
  'dialog.manage.disabled': 'disabled',
  'dialog.manage.addFilterTitle': 'Add filter subscription',
  'dialog.manage.filterName': 'Name',
  'dialog.manage.filterUrl': 'URL',
  'dialog.manage.rewrites': 'DNS Rewrites',
  'dialog.manage.noRewrites': 'No rewrite rules yet',
  'dialog.manage.rewriteDomain': 'Domain',
  'dialog.manage.rewriteAnswer': 'Target IP',
  'dialog.manage.maintenance': 'Maintenance',
  'dialog.manage.resetting': 'Resetting...',
  'dialog.manage.resetStats': 'Reset statistics',
  'dialog.manage.clearing': 'Clearing...',
  'dialog.manage.clearLog': 'Clear query log',
  'dialog.config.title': 'AdGuardHome Configuration',
  'dialog.config.existing': 'Saved profiles',
  'dialog.config.nameLabel': 'Profile name',
  'dialog.config.namePlaceholder': 'e.g. Router, Office',
  'dialog.config.urlLabel': 'AdGuardHome address',
  'dialog.config.urlPlaceholder': 'http://192.168.1.100',
  'dialog.config.userLabel': 'Username',
  'dialog.config.passLabel': 'Password',
  'dialog.config.rangeLabel': 'Analysis range',
  'dialog.config.save': 'Save and connect',
  'dialog.config.defaultProfile': 'Default',
  'dialog.config.errFields': 'Please fill in every field',
  'dialog.config.errName': 'Please enter a profile name',
  'dialog.config.errConfig': 'Configuration failed',
  'dialog.config.errSave': 'Save failed',
  'domain.loadMore': 'Load more',
}

const ALL = { zh, en }

interface I18nCtx {
  lang: Lang
  t: (key: string) => string
  setLang: (l: Lang) => void
}

const I18nContext = createContext<I18nCtx>({
  lang: 'zh',
  t: (k: string) => zh[k] ?? k,
  setLang: () => {},
})

function detectLang(): Lang {
  if (typeof navigator === 'undefined') return 'zh'
  const lang = navigator.language?.toLowerCase() ?? ''
  return lang.startsWith('zh') ? 'zh' : 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    return (localStorage.getItem('lang') as Lang) || detectLang()
  })

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
    localStorage.setItem('lang', lang)
  }, [lang])

  const t = (key: string): string => {
    const dict = ALL[lang]
    return dict[key] ?? key
  }

  return (
    <I18nContext.Provider value={{ lang, t, setLang }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}
