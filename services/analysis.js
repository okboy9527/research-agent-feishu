const extractMetrics = (text) => {
  const patterns = {
    precision: /precision\s*[:=]\s*([0-9.]+)/ig,
    recall: /recall\s*[:=]\s*([0-9.]+)/ig,
    map50: /mAP(?:@?0?\.5|50)?\s*[:=]\s*([0-9.]+)/ig,
    loss: /loss\s*[:=]\s*([0-9.]+)/ig,
    f1: /f1\s*[:=]\s*([0-9.]+)/ig
  };

  const metrics = {};
  for (const [key, regex] of Object.entries(patterns)) {
    const values = [...text.matchAll(regex)].map(match => Number(match[1]));
    if (values.length) {
      metrics[key] = values[values.length - 1];
      metrics[`${key}History`] = values;
    }
  }
  return metrics;
};

function buildRuleBasedAnalysis(exp, metrics) {
  const bottlenecks = [];
  const suggestions = [];
  const nextSteps = [];
  const highlights = [];

  if (typeof metrics.precision === 'number' && typeof metrics.recall === 'number') {
    if (metrics.precision > 0.75 && metrics.recall < 0.5) {
      bottlenecks.push('模型偏保守，误检控制较好，但漏检明显，召回率偏低。');
      suggestions.push('优先检查正负样本分布、置信度阈值、NMS 阈值与小目标样本占比。');
      nextSteps.push('做一轮阈值扫描实验，并记录 Precision/Recall/F1 的联动变化。');
    }
    if (metrics.recall > 0.75 && metrics.precision < 0.5) {
      bottlenecks.push('模型偏激进，召回较高，但误检较多。');
      suggestions.push('检查难负样本、类别混淆样本与后处理规则。');
      nextSteps.push('引入更严格的后处理或增加难负样本训练。');
    }
  }

  if (typeof metrics.loss === 'number') {
    highlights.push(`当前 loss 约为 ${metrics.loss}。`);
    if (metrics.loss > 1) {
      bottlenecks.push('loss 仍偏高，模型可能尚未稳定收敛。');
      suggestions.push('检查学习率、warmup、batch size 与数据质量。');
    }
  }

  if (typeof metrics.map50 === 'number') {
    highlights.push(`当前 mAP 指标约为 ${metrics.map50}。`);
    if (metrics.map50 < 0.5) {
      bottlenecks.push('整体检测质量还有较大提升空间。');
      nextSteps.push('优先确认标注质量，再尝试数据增强与骨干网络对比。');
    }
  }

  if (!bottlenecks.length) {
    bottlenecks.push('当前日志没有暴露出单一绝对瓶颈，更适合做对照实验定位关键影响因素。');
  }
  if (!suggestions.length) {
    suggestions.push('围绕数据、训练策略、后处理三条线各设计 1 组最小可验证实验。');
  }
  if (!nextSteps.length) {
    nextSteps.push('把下一轮实验拆成单变量对照，避免多因素同时变化导致结论不清。');
  }

  return {
    mode: 'rule-based',
    summary: `针对实验“${exp.title}”，系统已完成日志解析，并生成阶段性问题定位与下一轮实验建议。`,
    metrics,
    highlights,
    bottlenecks,
    suggestions,
    nextSteps,
    generatedAt: new Date().toISOString()
  };
}

async function analyzeWithLLM(exp, metrics) {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  if (!apiKey) {
    return null;
  }

  const prompt = `你是科研实验优化 Agent，请基于以下实验信息输出 JSON，字段为 summary, bottlenecks, suggestions, nextSteps, highlights。\n实验标题: ${exp.title}\n任务: ${exp.task}\n基线: ${exp.baseline || '无'}\n目标: ${exp.goal || '无'}\n备注: ${exp.notes || '无'}\n日志: ${exp.logText}\n提取指标: ${JSON.stringify(metrics)}`;

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: '你是一个严谨的科研实验分析助手，只输出 JSON。' },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM 调用失败: ${text}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  const parsed = JSON.parse(content);
  return {
    mode: 'llm',
    metrics,
    generatedAt: new Date().toISOString(),
    ...parsed
  };
}

async function analyzeExperiment(exp) {
  const metrics = extractMetrics(exp.logText || '');
  const llmResult = await analyzeWithLLM(exp, metrics).catch(() => null);
  return llmResult || buildRuleBasedAnalysis(exp, metrics);
}

module.exports = {
  analyzeExperiment
};
