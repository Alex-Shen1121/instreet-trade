import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getAuditContent,
  getDashboardData,
  getLiveInStreetData,
  getLogContent,
  getPageData,
  getShellData,
  getStrategyConfigData,
  updateManifestConfig,
  updateProfileConfig,
} from './data-service.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const app = express();
const port = Number(process.env.PORT || 3210);

app.use(express.json({ limit: '1mb' }));

function handleApiError(res, error) {
  const message = error?.message || 'request failed';
  res.status(400).json({ error: message });
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'instreet-trade-dashboard', time: new Date().toISOString() });
});

app.get('/api/overview', (_req, res) => {
  res.json(getDashboardData());
});

app.get('/api/shell', async (_req, res) => {
  try {
    const data = await getShellData();
    res.json(data);
  } catch (error) {
    handleApiError(res, error);
  }
});

app.get('/api/pages/:page', async (req, res) => {
  try {
    const data = await getPageData(req.params.page);
    res.json(data);
  } catch (error) {
    handleApiError(res, error);
  }
});

app.get('/api/live', async (_req, res) => {
  try {
    const data = await getLiveInStreetData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message || 'live fetch failed' });
  }
});

app.get('/api/config', (_req, res) => {
  try {
    res.json(getStrategyConfigData());
  } catch (error) {
    handleApiError(res, error);
  }
});

app.patch('/api/config/manifest', (req, res) => {
  try {
    res.json(updateManifestConfig(req.body?.patch ?? req.body));
  } catch (error) {
    handleApiError(res, error);
  }
});

app.patch('/api/config/active-profile', (req, res) => {
  try {
    const profileId = req.body?.profileId;
    res.json(updateManifestConfig({ active_profile: profileId }));
  } catch (error) {
    handleApiError(res, error);
  }
});

app.patch('/api/config/profiles/:profileId', (req, res) => {
  try {
    res.json(updateProfileConfig(req.params.profileId, req.body?.patch ?? req.body));
  } catch (error) {
    handleApiError(res, error);
  }
});

app.get('/api/audits/:name', (req, res) => {
  const data = getAuditContent(req.params.name);
  if (!data) return res.status(404).json({ error: 'audit not found' });
  res.json(data);
});

app.get('/api/logs/:name', (req, res) => {
  const data = getLogContent(req.params.name);
  if (!data?.content) return res.status(404).json({ error: 'log not found' });
  res.json(data);
});

app.get('/api/validation-report', (_req, res) => {
  const data = getDashboardData();
  res.json(data.validationReport || { error: 'no validation report yet' });
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(distDir));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(port, '0.0.0.0', () => {
  console.log(`instreet-trade-dashboard listening on http://0.0.0.0:${port}`);
});
