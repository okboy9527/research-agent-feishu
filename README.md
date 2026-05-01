# 科研实验优化 Agent（支持飞书）

这是一个可直接运行的完整项目，目标是把“实验记录 → 自动分析 → 下一轮建议 → 飞书同步”串成一个闭环。

## 1. 项目能力

- 录入实验标题、任务方向、基线、目标、实验日志和备注
- 自动解析日志中的 Precision / Recall / mAP / loss / F1 等指标
- 生成阶段总结、问题定位、优化建议、下一轮实验建议
- 支持两种分析模式：
  - 无大模型配置：走内置规则分析
  - 配置 OpenAI 兼容接口：走 LLM 分析
- 支持把分析结果推送到飞书机器人

## 2. 目录结构

```bash
research-agent-feishu/
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── services/
│   ├── analysis.js
│   └── feishu.js
├── data/
│   └── experiments.json
├── .env.example
├── package.json
├── server.js
└── README.md
```

## 3. 启动方法

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制 `.env.example` 为 `.env`，然后填写：

```bash
PORT=3000
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
FEISHU_WEBHOOK_URL=
FEISHU_SECRET=
APP_NAME=科研实验优化 Agent
```

### 运行

```bash
npm start
```

浏览器打开：

```bash
http://localhost:3000
```

## 4. 飞书接入方式

当前项目接入的是“飞书机器人 webhook”模式。

你需要做的事：

1. 在飞书群里添加自定义机器人。
2. 拿到 webhook URL。
3. 如果你启用了签名校验，把密钥填到 `FEISHU_SECRET`。
4. 在系统中先分析实验，再点击“发送飞书”。

发送成功后，飞书会收到一张交互卡片，内容包括：
- 实验任务
- 当前基线
- 阶段目标
- 提取指标
- 问题定位
- 优化建议
- 下一轮实验计划

## 5. 如果你想继续扩展

你后续可以继续加：

- 接入数据库（MySQL / PostgreSQL）
- 接入飞书多维表格，自动写入实验记录
- 接入飞书用户 OAuth 登录
- 对接你自己的大模型供应商
- 增加实验结果对比图表
- 增加导出周报 / 汇报材料功能

## 6. 适合你怎么用

你现在可以把每次实验日志直接贴进系统，然后：

1. 保存实验。
2. 点击“开始分析”。
3. 检查系统生成的问题定位和建议。
4. 点击“发送飞书”，同步到组会群或自己的科研群。
