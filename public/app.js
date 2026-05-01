const listEl = document.getElementById('experiment-list');
const formEl = document.getElementById('experiment-form');
const refreshBtn = document.getElementById('refresh-btn');
const detailEmpty = document.getElementById('detail-empty');
const detailCard = document.getElementById('detail-card');
const analyzeBtn = document.getElementById('analyze-btn');
const notifyBtn = document.getElementById('notify-btn');

let experiments = [];
let selectedId = null;

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || '请求失败');
  }
  return data;
}

function renderList() {
  listEl.innerHTML = '';
  if (!experiments.length) {
    listEl.innerHTML = '<div class="empty-state">还没有实验记录，先在左侧创建一条吧。</div>';
    return;
  }

  for (const item of experiments) {
    const card = document.createElement('article');
    card.className = 'exp-card' + (item.id === selectedId ? ' active' : '');
    card.innerHTML = `
      <h3>${item.title}</h3>
      <p>${item.task}</p>
      <div class="exp-meta">${new Date(item.createdAt).toLocaleString()} · ${item.analysis ? '已分析' : '未分析'}</div>
    `;
    card.addEventListener('click', () => selectExperiment(item.id));
    listEl.appendChild(card);
  }
}

function renderAnalysisList(el, items) {
  el.innerHTML = '';
  if (!items || !items.length) {
    el.innerHTML = '<li>暂无</li>';
    return;
  }
  items.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    el.appendChild(li);
  });
}

function renderDetail(item) {
  if (!item) {
    detailEmpty.classList.remove('hidden');
    detailCard.classList.add('hidden');
    return;
  }

  detailEmpty.classList.add('hidden');
  detailCard.classList.remove('hidden');

  document.getElementById('detail-title').textContent = item.title;
  document.getElementById('detail-meta').textContent = `${item.task} · ${new Date(item.updatedAt).toLocaleString()}`;
  document.getElementById('detail-info').textContent = `基线：${item.baseline || '未填写'}；目标：${item.goal || '未填写'}；备注：${item.notes || '未填写'}`;

  const metricsEl = document.getElementById('metrics');
  metricsEl.innerHTML = '';
  const metrics = item.analysis?.metrics || {};
  const keys = Object.keys(metrics).filter(key => !key.endsWith('History'));
  if (!keys.length) {
    metricsEl.innerHTML = '<span class="metric">暂无可解析指标</span>';
  } else {
    keys.forEach(key => {
      const span = document.createElement('span');
      span.className = 'metric';
      span.textContent = `${key}: ${metrics[key]}`;
      metricsEl.appendChild(span);
    });
  }

  document.getElementById('summary').textContent = item.analysis?.summary || '尚未分析。';
  renderAnalysisList(document.getElementById('bottlenecks'), item.analysis?.bottlenecks || []);
  renderAnalysisList(document.getElementById('suggestions'), item.analysis?.suggestions || []);
  renderAnalysisList(document.getElementById('nextSteps'), item.analysis?.nextSteps || []);
}

function selectExperiment(id) {
  selectedId = id;
  renderList();
  renderDetail(experiments.find(item => item.id === id));
}

async function loadExperiments() {
  experiments = await request('/api/experiments');
  renderList();
  if (selectedId) {
    const existing = experiments.find(item => item.id === selectedId);
    renderDetail(existing || null);
  }
}

formEl.addEventListener('submit', async (event) => {
  event.preventDefault();
  const fd = new FormData(formEl);
  const payload = Object.fromEntries(fd.entries());
  try {
    const created = await request('/api/experiments', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    formEl.reset();
    await loadExperiments();
    selectExperiment(created.id);
  } catch (error) {
    alert(error.message);
  }
});

refreshBtn.addEventListener('click', loadExperiments);

analyzeBtn.addEventListener('click', async () => {
  if (!selectedId) return;
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = '分析中...';
  try {
    await request(`/api/experiments/${selectedId}/analyze`, { method: 'POST' });
    await loadExperiments();
    selectExperiment(selectedId);
  } catch (error) {
    alert(error.message);
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = '开始分析';
  }
});

notifyBtn.addEventListener('click', async () => {
  if (!selectedId) return;
  notifyBtn.disabled = true;
  notifyBtn.textContent = '发送中...';
  try {
    await request(`/api/experiments/${selectedId}/notify/feishu`, { method: 'POST' });
    alert('已发送到飞书机器人。');
  } catch (error) {
    alert(error.message);
  } finally {
    notifyBtn.disabled = false;
    notifyBtn.textContent = '发送飞书';
  }
});

loadExperiments();
