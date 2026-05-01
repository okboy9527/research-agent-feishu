const crypto = require('crypto');

function buildSign(secret, timestamp) {
  const stringToSign = `${timestamp}\n${secret}`;
  return crypto.createHmac('sha256', stringToSign).digest('base64');
}

function buildCard(experiment) {
  const analysis = experiment.analysis || {};
  const metrics = analysis.metrics || {};
  const metricText = Object.keys(metrics)
    .filter(key => !key.endsWith('History'))
    .map(key => `${key}: ${metrics[key]}`)
    .join(' | ') || '未提取到明确指标';

  const list = (items) => (items && items.length ? items.map((item, index) => `${index + 1}. ${item}`).join('\n') : '暂无');

  return {
    msg_type: 'interactive',
    card: {
      config: { wide_screen_mode: true },
      header: {
        template: 'blue',
        title: {
          tag: 'plain_text',
          content: `科研实验分析：${experiment.title}`
        }
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**任务**：${experiment.task}\n**基线**：${experiment.baseline || '未填写'}\n**目标**：${experiment.goal || '未填写'}`
          }
        },
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**阶段总结**\n${analysis.summary || '暂无总结'}`
          }
        },
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**关键指标**\n${metricText}`
          }
        },
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**问题定位**\n${list(analysis.bottlenecks)}`
          }
        },
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**优化建议**\n${list(analysis.suggestions)}`
          }
        },
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**下一轮实验**\n${list(analysis.nextSteps)}`
          }
        }
      ]
    }
  };
}

async function sendExperimentSummaryToFeishu(experiment) {
  const webhook = process.env.FEISHU_WEBHOOK_URL;
  const secret = process.env.FEISHU_SECRET;

  if (!webhook) {
    throw new Error('缺少 FEISHU_WEBHOOK_URL，请先在 .env 中配置飞书机器人 webhook。');
  }

  const payload = buildCard(experiment);

  if (secret) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    payload.timestamp = timestamp;
    payload.sign = buildSign(secret, timestamp);
  }

  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`飞书 webhook 请求失败: ${text}`);
  }

  return { raw: text };
}

module.exports = {
  sendExperimentSummaryToFeishu
};
