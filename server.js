const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { analyzeExperiment } = require('./services/analysis');
const { sendExperimentSummaryToFeishu } = require('./services/feishu');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'experiments.json');

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ experiments: [] }, null, 2), 'utf8');
  }
}

function readStore() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeStore(store) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function findExperiment(id) {
  const store = readStore();
  const experiment = store.experiments.find(item => item.id === id);
  return { store, experiment };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: process.env.APP_NAME || '科研实验优化 Agent' });
});

app.get('/api/experiments', (_req, res) => {
  const store = readStore();
  const experiments = [...store.experiments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(experiments);
});

app.post('/api/experiments', async (req, res) => {
  const { title, task, baseline, goal, logText, notes } = req.body || {};

  if (!title || !task || !logText) {
    return res.status(400).json({ message: 'title、task、logText 为必填项。' });
  }

  const store = readStore();
  const experiment = {
    id: 'exp_' + Date.now(),
    title,
    task,
    baseline: baseline || '',
    goal: goal || '',
    logText,
    notes: notes || '',
    analysis: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  store.experiments.push(experiment);
  writeStore(store);
  res.status(201).json(experiment);
});

app.post('/api/experiments/:id/analyze', async (req, res) => {
  const { id } = req.params;
  const { store, experiment } = findExperiment(id);

  if (!experiment) {
    return res.status(404).json({ message: '未找到实验记录。' });
  }

  try {
    const analysis = await analyzeExperiment(experiment);
    experiment.analysis = analysis;
    experiment.updatedAt = new Date().toISOString();
    writeStore(store);
    res.json(experiment);
  } catch (error) {
    res.status(500).json({ message: error.message || '分析失败。' });
  }
});

app.post('/api/experiments/:id/notify/feishu', async (req, res) => {
  const { id } = req.params;
  const { experiment } = findExperiment(id);

  if (!experiment) {
    return res.status(404).json({ message: '未找到实验记录。' });
  }

  if (!experiment.analysis) {
    return res.status(400).json({ message: '请先完成分析，再发送飞书通知。' });
  }

  try {
    const result = await sendExperimentSummaryToFeishu(experiment);
    res.json({ ok: true, result });
  } catch (error) {
    res.status(500).json({ message: error.message || '飞书发送失败。' });
  }
});

app.get('/api/experiments/:id', (req, res) => {
  const { experiment } = findExperiment(req.params.id);
  if (!experiment) {
    return res.status(404).json({ message: '未找到实验记录。' });
  }
  res.json(experiment);
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Research Agent running at http://localhost:${PORT}`);
});
