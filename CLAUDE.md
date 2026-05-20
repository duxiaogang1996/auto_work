# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**永远使用中文交流**，包括所有回复、注释、错误提示、文档说明等。

## 项目概述

基于 Flask 的自动化控制台应用，提供京东 BossWeb 系统的批量业务操作功能（补赠费、停机筛号、撤单、开机、销户校验、余额查询、详单查询）。附带产品指令配置（Oracle SQL 自动生成）和采购号码提取。支持手机号批量处理，可打包为 Windows EXE 独立运行。

## 开发命令

```bash
# 启动后端（默认端口 5000）
python src/main.py
PORT=5001 python src/main.py

# 前端开发（Vite 热更新）
npm run dev     # 启动 Vite 开发服务器
npm run build   # 构建前端到 src/ui/static/dist/

# PyInstaller 打包
pip install -r requirements.txt
pyinstaller tools/自动化控制台.spec

# Pencil 设计文件
design/control-console.pen  # 用 Pencil 编辑器打开
```

## 目录结构

```
src/                      # 所有源码
├── main.py               # 入口：create_app() + webbrowser 自启
├── app_factory.py        # Flask 应用工厂 + 10 个 Blueprint 注册
├── config.py             # 配置类（HOST/PORT）
├── logging_config.py     # 日志格式配置
├── error_handlers.py     # 全局异常处理
├── api_routes/           # 路由层（每个功能一个 Blueprint）
│   ├── _helpers.py       # parse_cookie_and_phone() 等请求解析工具
│   ├── page_routes.py    # GET / + GET /docs/<filename>
│   ├── login_helper.py   # Selenium 浏览器自动登录获取 Cookie
│   └── recharge/suspend/resume/cancel/cancel_account/balance/cdr/sql.py
├── core/
│   ├── base.py           # BatchPhoneService 抽象基类
│   ├── utils.py          # normalize_cookie() 等工具函数
│   ├── result_serializers.py  # 各功能结果序列化
│   ├── api/              # BossWeb HTTP 客户端层
│   │   ├── bossweb_client.py  # 通用请求（session/cookie/响应解析）
│   │   ├── recharge_api.py    # 补赠费相关 API 封装
│   │   └── cdr_api.py         # 详单查询 API 封装
│   └── services/         # 业务逻辑层
│       ├── reason_codes.py    # 停开机原因码配置
│       ├── *_service.py       # 各功能业务逻辑
│       └── *_sql_generator.py # 产品/套餐/销售品 SQL 生成
├── ui/
│   ├── templates/index.html   # SPA 入口（5 Tab）
│   └── static/               # 前端（14 个 ES Module）
│       ├── index.js           # Vite 入口，import 所有模块
│       ├── utils.js           # Cookie 规范化、手机号解析、日志、HTTP 请求
│       ├── batch_engine.js    # BatchProcessor 类：逐号处理循环/进度/停止
│       ├── ui_controller.js   # Tab 切换、参数面板动态渲染
│       ├── feature_processors.js  # 7 个功能入口函数
│       ├── result_rendering.js    # 结果表格渲染（各功能独立表头）
│       ├── export.js          # JSON/Excel/CSV/XLS 导出
│       ├── login_helper.js    # 浏览器登录 Cookie 获取
│       ├── file_upload.js     # CSV/Excel 文件上传解析
│       ├── product_sql.js / package_sql.js / offer_sql.js  # SQL 配置页交互
│       └── phone_extract.js   # 采购号码提取（纯前端）
├── docs/                 # 需求文档
├── tests/                # 测试（当前为空）
├── design/               # Pencil UI 设计文件
└── tools/                # PyInstaller spec
```

## 核心架构

### 三层后端模式

```
路由层 (Blueprint) → 服务层 (Service) → API 客户端层 (BossWebClient)
```

- **路由层**：参数校验（parse_cookie_and_phone），调用 service，序列化响应
- **服务层**：业务编排，继承 BatchPhoneService 基类（process_phones → process_single_phone 循环）
- **API 客户端层**：封装 BossWeb HTTP 调用，统一 session、cookie、响应解析

### 前端架构

单页应用（14 个 ES Module，Vite 打包），核心引擎 `BatchProcessor`：

- 逐号发送 POST 请求到后端
- 增量渲染到结果表格（每处理一个号码即时更新）
- 实时进度条 + 可中断 + 日志自动滚动（500 行限制）

### 关键模式

- **BatchPhoneService 基类**：提供 `process_phones()` 批量循环 + try/except 错误隔离，子类实现 `process_single_phone()`
- **Cookie 处理**：`normalize_cookie()` 统一解析（纯 cookie 字符串 / curl 命令 / 多行 HTTP headers 三种格式）
- **结果序列化**：`serialize_*()` 函数将 Service 数据对象转为前端 JSON

### 10 个 Blueprint

| 前缀 | 模块 |
|------|------|
| `/` | page_routes（页面 + 文档静态文件） |
| `/api/recharge` | 补赠费 |
| `/api/suspend` | 停机筛号 |
| `/api/resume` | 开机 |
| `/api/cancel` | 撤单 |
| `/api/cancel_account` | 销户校验 |
| `/api/balance` | 余额查询 |
| `/api/cdr` | 详单查询 |
| `/api/sql` | SQL 生成（product/package/offer） |
| `/api/login` | Selenium 浏览器登录 |

### BossWeb 外部 API（11 个接口）

Base URL: `http://bossweb.jd.com/busi_web/busi/`
鉴权方式：Cookie Header
响应结构：`{"type":"success|error", "content":"...", "args":{...}}`

| 内部名 | 路径 | 用途 |
|--------|------|------|
| API-1 | `QryPromDetail_Qry` | 分月返还记录（补赠费） |
| API-2 | `queryInfoBill` | 账单扣款（补赠费） |
| API-3 | `querysubsorderquery` | 历史赠费防重（补赠费） |
| API-4 | `querySubsBaseInfo` | 综合信息/余额/状态（所有功能） |
| API-5 | `sendChargeSubmit` | 执行赠费（补赠费） |
| API-6 | `dealOpenClose` | 停/开机操作 |
| API-7 | `userMessageQuery` | 撤单前置查询 |
| API-8 | `userMessageOut` | 执行撤单 |
| API-9 | `querySubsCDRs` | 详单分页查询 |
| API-11 | `queryBalances` | 余额+账本明细 |

## 业务功能清单

| 功能 | 输入 | 输出表头 | 特殊参数 |
|------|------|---------|---------|
| 补赠费 | cookie, phones | 手机号/未返还月份/扣款/已赠费/应赠费/赠费前后/差值/结果 | dry_run, max_gift_amount(默认12), bill_sleep_s(0.3), after_gift_sleep_s(0.5) |
| 停机筛号 | cookie, phones | 手机号/余额/套餐名/套餐金额/状态/应停机/结果 | auto_suspend(默认true) |
| 开机 | cookie, phones | 手机号/原状态/余额/条件判断/结果 | auto_resume(默认true), remark |
| 撤单 | cookie, phones | 手机号/查询状态/用户状态/订单状态/订单号/结果 | - |
| 销户校验 | cookie, phones | 手机号/余额/可销户 | - |
| 余额查询 | cookie, phones, mode | simple: 手机号/套餐/状态/余额/激活时间; ledger: +账本明细 | mode(simple/ledger) |
| 详单查询 | cookie, phone(单号) | 开始时间/通话类型/主被叫/时长/资费 | service_type, start_time, end_time, result_mode |

## 需求文档

`docs/需求说明文档.md` — 项目的唯一需求来源，按功能模块组织。

## Pencil 设计文件

`design/control-console.pen` — 包含业务办理主页面、号码提取页面、以及 7 个功能演示卡片。
