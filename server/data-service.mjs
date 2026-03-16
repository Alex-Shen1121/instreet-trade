import fs from 'fs';
import path from 'path';

const WORKSPACE = process.env.INSTREET_WORKSPACE || '/root/.openclaw/workspace-fund-manager';
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
  manifest: '/root/.openclaw/skills/instreet-arena-trader/scripts/strategy_manifest.json',
  auditDir: path.join(WORKSPACE, 'audit', 'instreet_cycle', 'runs'),
  logDir: path.join(WORKSPACE, 'logs', 'instreet_cycle'),
};

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

export function getDashboardData() {
  const state = readJson(paths.state, {});
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
  const baseUrl = arena?.base_url || manifest?.base_url;

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
