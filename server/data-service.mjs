import fs from 'fs';
import path from 'path';

const WORKSPACE = process.env.INSTREET_WORKSPACE || '/root/.openclaw/workspace-fund-manager';
const STRATEGY_ROOT = '/root/.openclaw/skills/instreet-arena-trader/scripts';
const TRADE_LOG_WIKI = 'https://acn25ylq5k0i.feishu.cn/wiki/SwGHwZeLYiwZW5kPJcfcqLPsnAc?fromScene=spaceOverview';
const OVERVIEW_WIKI = 'https://acn25ylq5k0i.feishu.cn/wiki/FpUowfz2iiyxyskJTtYcCm7rnFe?fromScene=spaceOverview';

const paths = {
  workspace: WORKSPACE,
  state: path.join(WORKSPACE, '.instreet_cycle_state.json'),
  dynamicFocus: path.join(WORKSPACE, '.instreet_dynamic_focus.json'),
  strategySignal: path.join(WORKSPACE, '.instreet_strategy_signal.json'),
  focusMemory: path.join(WORKSPACE, '.instreet_focus_memory.json'),
  candidateState: path.join(WORKSPACE, '.instreet_candidate_state.json'),
  switchGate: path.join(WORKSPACE, '.instreet_switch_gate.json'),
  acceptanceState: path.join(WORKSPACE, '.instreet_acceptance_state.json'),
  switchEvaluations: path.join(WORKSPACE, '.instreet_switch_evaluations.json'),
  arena: path.join(WORKSPACE, '.instreet_arena.json'),
  manifest: path.join(STRATEGY_ROOT, 'strategy_manifest.json'),
  profilesDir: path.join(STRATEGY_ROOT, 'profiles'),
  auditDir: path.join(WORKSPACE, 'audit', 'instreet_cycle', 'runs'),
  logDir: path.join(WORKSPACE, 'logs', 'instreet_cycle'),
};

const ALLOWED_MANIFEST_KEYS = new Set([
  'active_profile',
  'llm_review',
  'dynamic_focus',
  'community_signal',
  'news_filter',
  'execution_hygiene',
  'strategy_state_machine',
  'review_policy',
]);

const ALLOWED_PROFILE_KEYS = new Set([
  'label',
  'thesis',
  'style',
  'trade_constraints',
  'scoring',
  'risk_controls',
  'sell_rules',
  'bucket_targets',
  'bucket_minimums',
  'candidate_pool',
  'correlation_groups',
]);

function exists(filePath) {
  return fs.existsSync(filePath);
}

function readJson(filePath, fallback = null) {
  try {
    if (!exists(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function readText(filePath, fallback = '') {
  try {
    if (!exists(filePath)) return fallback;
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

function listFiles(dir, suffix = '') {
  try {
    if (!exists(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((name) => (suffix ? name.endsWith(suffix) : true))
      .map((name) => {
        const fullPath = path.join(dir, name);
        const stat = fs.statSync(fullPath);
        return {
          name,
          path: fullPath,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
          updatedAt: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
  } catch {
    return [];
  }
}

function tailLines(filePath, limit = 160) {
  const text = readText(filePath, '');
  if (!text) return '';
  const lines = text.trimEnd().split('\n');
  return lines.slice(-limit).join('\n');
}

function deepMerge(target, patch) {
  if (Array.isArray(patch)) return patch.slice();
  if (!patch || typeof patch !== 'object') return patch;
  const base = target && typeof target === 'object' && !Array.isArray(target) ? { ...target } : {};
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      base[key] = deepMerge(base[key], value);
    } else {
      base[key] = value;
    }
  }
  return base;
}

function getLatestAudit(state, audits) {
  const preferredPath = state?.last_audit_run_path;
  if (preferredPath && exists(preferredPath)) return readJson(preferredPath, {});
  return audits.length ? readJson(audits[0].path, {}) : {};
}

function normalizeAuditSummary(file) {
  const json = readJson(file.path, {});
  const outputs = json?.outputs || {};
  const strategySignal = outputs.strategy_signal || {};
  const decision = outputs.decision || {};
  const portfolio = json?.inputs?.portfolio_data?.data?.portfolio || {};
  return {
    fileName: file.name,
    runId: json.run_id || file.name.replace(/\.json$/, ''),
    mode: json.mode || 'unknown',
    updatedAt: file.updatedAt,
    action: decision.action || 'unknown',
    reason: decision.reason || '',
    marketRegime: outputs.dynamic_focus?.market_regime || 'unknown',
    strategyState: strategySignal.state || 'unknown',
    suggestedProfile: strategySignal.last_suggested_profile || null,
    totalValue: portfolio.total_value ?? null,
    returnRate: portfolio.return_rate ?? null,
  };
}

function buildCompletedFeatures() {
  return [
    { key: 'cycle', title: '定时巡检主流程', desc: '自动拉取社区、组合、新闻、行情并生成本轮结论', status: 'done' },
    { key: 'post', title: '社区分析帖发布', desc: '每轮可发布 InStreet 分析帖并保留链接', status: 'done' },
    { key: 'llm', title: 'LLM 最终复核', desc: '规则提案后增加模型复核层，避免误动作', status: 'done' },
    { key: 'focus', title: '动态重点关注层', desc: '输出重点板块、股票、回避方向和风格判断', status: 'done' },
    { key: 'signal', title: '策略切换状态机', desc: '支持 observe_switch / switch_ready / rollback_watch', status: 'done' },
    { key: 'validation', title: 'dry-run / replay 验证', desc: '支持只跑决策链和基于审计快照重放', status: 'done' },
    { key: 'audit', title: '审计快照', desc: '每轮保存 inputs / outputs / llm prompt-response', status: 'done' },
    { key: 'logs', title: '独立日志切分', desc: '每次运行单独日志文件，不再混写到一个文件', status: 'done' },
    { key: 'feishu', title: '飞书知识库同步', desc: '交易日志按 日期/时间 落档，并维护持仓规划总览', status: 'done' },
    { key: 'cron', title: 'Cron 自动执行', desc: '交易时段按计划自动巡检和同步', status: 'done' },
    { key: 'dashboard', title: 'Dashboard 混合模式', desc: '页面同时展示本地审计快照与实时 InStreet 拉取结果', status: 'done' },
    { key: 'config', title: '策略配置页', desc: '支持查看和调整大策略与关键量化参数', status: 'done' },
  ];
}

function summarizeTrades(trades = []) {
  const pending = trades.filter((item) => item.status === 'pending').length;
  const executed = trades.filter((item) => item.status === 'executed').length;
  return { pending, executed, total: trades.length };
}

function buildFreshness(lastRunAt) {
  if (!lastRunAt) return null;
  const diffMs = Date.now() - new Date(lastRunAt).getTime();
  return {
    seconds: Math.floor(diffMs / 1000),
    minutes: Math.floor(diffMs / 60000),
  };
}

function mapLiveSummary(live) {
  const portfolio = live?.portfolio?.data?.portfolio || {};
  const holdings = live?.portfolio?.data?.holdings || [];
  const trades = live?.trades?.data?.trades || [];
  const leaderboard = live?.leaderboard?.data?.leaderboard || [];
  return {
    pulledAt: live?.pulledAt || null,
    portfolio,
    holdings,
    trades,
    leaderboard: leaderboard.slice(0, 5),
    tradeSummary: summarizeTrades(trades),
  };
}

function buildConfigMeta() {
  return {
    strategyConcepts: {
      max_total_exposure: '总仓位上限：组合允许实际持仓占总资产的最高比例，用来控制整体风险暴露。',
      target_trade_fraction: '单次目标交易比例：每一轮新开仓或调仓时，系统倾向动用的资金比例。',
      max_bucket_exposure: '单一 bucket 上限：同一类风格/行业在组合中的最高占比，防止一边倒。',
      rebalance_band: '再平衡带宽：只有当实际仓位偏离目标超过这条带宽时，才触发再平衡，避免过度交易。',
      veto_risk_score_min: '否决风险阈值：模型复核给出的风险分超过这个值，就直接否掉交易。',
      switch_signal_threshold: '切换信号阈值：连续几轮都指向同一大策略，系统才认为切换信号足够强。',
      confidence_required: '切换所需置信度：动态关注层给出的结论，至少要达到这个置信等级才进入切换链路。',
      buy_cooldown_minutes: '买入冷静期：同一标的刚买完后，多长时间内不再重复追买。',
      sell_observe_minutes: '卖出观察期：刚卖出后，多长时间内禁止重新追入，避免来回反手。',
      layer_weights: '候选池分层权重：核心池/观察池/事件池在候选打分时的额外加权。',
      bucket_targets: '目标仓位：系统希望长期维持的 bucket 理想占比。',
      bucket_minimums: '最低配置：某些关键 bucket 至少应保留的底仓比例。',
    },
  };
}

function listStrategyProfiles() {
  return listFiles(paths.profilesDir, '.json')
    .map((file) => ({ ...readJson(file.path, {}), fileName: file.name, updatedAt: file.updatedAt }))
    .filter((item) => item?.profile_id);
}

export function getStrategyConfigData() {
  const manifest = readJson(paths.manifest, {});
  const profiles = listStrategyProfiles();
  return {
    generatedAt: new Date().toISOString(),
    strategyRoot: STRATEGY_ROOT,
    manifest,
    activeProfileId: manifest.active_profile || null,
    profiles,
    profileOptions: profiles.map((profile) => ({
      profile_id: profile.profile_id,
      label: profile.label,
      thesis: profile.thesis,
      style: profile.style,
    })),
    meta: buildConfigMeta(),
  };
}

export function updateManifestConfig(patch = {}) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new Error('manifest patch must be an object');
  }
  for (const key of Object.keys(patch)) {
    if (!ALLOWED_MANIFEST_KEYS.has(key)) {
      throw new Error(`manifest key not allowed: ${key}`);
    }
  }
  const current = readJson(paths.manifest, {});
  const next = deepMerge(current, patch);
  if (next.active_profile && !exists(path.join(paths.profilesDir, `${next.active_profile}.json`))) {
    throw new Error(`active profile not found: ${next.active_profile}`);
  }
  writeJson(paths.manifest, next);
  return getStrategyConfigData();
}

export function updateProfileConfig(profileId, patch = {}) {
  if (!profileId) throw new Error('profileId is required');
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new Error('profile patch must be an object');
  }
  for (const key of Object.keys(patch)) {
    if (!ALLOWED_PROFILE_KEYS.has(key)) {
      throw new Error(`profile key not allowed: ${key}`);
    }
  }
  const profilePath = path.join(paths.profilesDir, `${profileId}.json`);
  if (!exists(profilePath)) throw new Error(`profile not found: ${profileId}`);
  const current = readJson(profilePath, {});
  const next = deepMerge(current, patch);
  writeJson(profilePath, next);
  return getStrategyConfigData();
}

export function getDashboardData() {
  const state = readJson(paths.state, {});
  const manifest = readJson(paths.manifest, {});
  const dynamicFocus = readJson(paths.dynamicFocus, {});
  const strategySignal = readJson(paths.strategySignal, {});
  const focusMemory = readJson(paths.focusMemory, {});
  const candidateState = readJson(paths.candidateState, {});
  const switchEvaluations = readJson(paths.switchEvaluations, []);
  const acceptanceState = readJson(paths.acceptanceState, {});
  const auditFiles = listFiles(paths.auditDir, '.json');
  const logFiles = listFiles(paths.logDir, '.log');
  const latestAudit = getLatestAudit(state, auditFiles);
  const latestLogPath = state?.last_log_path && exists(state.last_log_path) ? state.last_log_path : logFiles[0]?.path;
  const latestLogPreview = latestLogPath ? tailLines(latestLogPath, 120) : '';
  const latestAuditOutputs = latestAudit?.outputs || {};
  const portfolio = latestAudit?.inputs?.portfolio_data?.data?.portfolio || {};
  const holdings = latestAudit?.inputs?.portfolio_data?.data?.holdings || [];
  const latestNews = latestAudit?.inputs?.filtered_market_news || [];
  const baseBundle = latestAuditOutputs?.base_bundle || {};
  const latestTrades = latestAudit?.inputs?.trades_data?.data?.trades || [];

  const auditSummaries = auditFiles.slice(0, 20).map(normalizeAuditSummary);
  const validationModes = auditSummaries.reduce((acc, item) => {
    acc[item.mode] = (acc[item.mode] || 0) + 1;
    return acc;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    workspace: paths.workspace,
    links: {
      lastPostUrl: state?.last_post_url || null,
      latestAuditPath: state?.last_audit_run_path || null,
      latestLogPath: latestLogPath || null,
      tradeLogWiki: TRADE_LOG_WIKI,
      overviewWiki: OVERVIEW_WIKI,
    },
    summary: {
      lastRunAt: state?.last_run_at || null,
      lastMode: state?.last_mode || null,
      activeProfile: state?.active_profile || null,
      configuredProfile: manifest?.active_profile || state?.active_profile || null,
      lastRunProfile: state?.active_profile || null,
      latestAction: latestAuditOutputs?.decision?.action || state?.last_decision?.action || 'unknown',
      latestReason: latestAuditOutputs?.decision?.reason || state?.last_decision?.reason || '',
      marketRegime: dynamicFocus?.market_regime || latestAuditOutputs?.dynamic_focus?.market_regime || 'unknown',
      strategyState: strategySignal?.state || latestAuditOutputs?.strategy_signal?.state || 'unknown',
      suggestedProfile: strategySignal?.last_suggested_profile || latestAuditOutputs?.strategy_signal?.last_suggested_profile || null,
      totalValue: portfolio?.total_value ?? null,
      cash: portfolio?.cash ?? null,
      holdingsValue: portfolio?.holdings_value ?? null,
      returnRate: portfolio?.return_rate ?? null,
      freshness: buildFreshness(state?.last_run_at),
      pendingTrades: summarizeTrades(latestTrades).pending,
    },
    portfolio: {
      portfolio,
      holdings,
      bucketExposures: baseBundle?.bucket_exposures || {},
      riskControls: baseBundle?.risk_controls || {},
      trades: latestTrades,
    },
    latestRun: {
      state,
      dynamicFocus,
      strategySignal,
      focusMemory,
      candidateState,
      acceptanceState,
      audit: latestAudit,
      news: latestNews,
      latestLogPreview,
      diagnostics: {
        bucketExposures: baseBundle?.bucket_exposures || {},
        bucketTargets: baseBundle?.bucket_targets || {},
        correlationExposures: baseBundle?.correlation_exposures || {},
        singlePositionExposures: baseBundle?.single_position_exposures || {},
        exitCandidates: baseBundle?.exit_candidates || [],
        buySkipReasons: baseBundle?.buy_skip_reasons || [],
        rebalanceNeeded: baseBundle?.rebalance_needed || false,
      },
    },
    switchEvaluations: switchEvaluations.slice(-10).reverse(),
    history: {
      audits: auditSummaries,
      logs: logFiles.slice(0, 20),
      validation: {
        counts: validationModes,
        hasDryRun: Boolean(validationModes['dry-run']),
        hasReplay: Boolean(validationModes['replay']),
        hasLive: Boolean(validationModes['live']),
      },
    },
    completedFeatures: buildCompletedFeatures(),
  };
}

export async function getLiveInStreetData() {
  const arena = readJson(paths.arena, {});
  const manifest = readJson(paths.manifest, {});
  const apiKey = arena?.api_key;
  const baseUrl = arena?.api_key ? arena?.base_url || manifest?.base_url : manifest?.base_url;

  if (!apiKey || !baseUrl) {
    throw new Error('missing InStreet credentials or base URL');
  }

  async function apiRequest(requestPath) {
    const response = await fetch(`${baseUrl}${requestPath}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': 'instreet-trade-dashboard/1.0',
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 240)}`);
    }
    return response.json();
  }

  const [portfolio, trades, leaderboard, home] = await Promise.all([
    apiRequest('/api/v1/arena/portfolio'),
    apiRequest('/api/v1/arena/trades?limit=20'),
    apiRequest('/api/v1/arena/leaderboard?limit=10'),
    apiRequest('/api/v1/home'),
  ]);

  return {
    source: 'instreet-live',
    pulledAt: new Date().toISOString(),
    portfolio,
    trades,
    leaderboard,
    home,
    summary: mapLiveSummary({ pulledAt: new Date().toISOString(), portfolio, trades, leaderboard }),
  };
}

export function getAuditContent(name) {
  const filePath = path.join(paths.auditDir, name);
  return readJson(filePath, null);
}

export function getLogContent(name) {
  const filePath = path.join(paths.logDir, name);
  return {
    name,
    content: readText(filePath, ''),
  };
}
