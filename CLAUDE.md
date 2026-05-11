# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 语言规则

**永远使用中文交流**，包括所有回复、注释、错误提示、文档说明等。不要使用英文回复用户。

## 项目概述

这是一个基于 Flask 的自动化控制台应用，提供京东 BossWeb 系统的批量业务操作功能，包括补赠费、停机筛号、撤单、开机、销户校验、余额查询、详单查询等。同时提供产品指令配置功能，支持产品、套餐、销售品的 Oracle SQL 自动生成，以及采购号码提取和 MySQL 数据库连接执行。应用通过 Web UI 交互，支持手机号批量处理，并可打包为 Windows EXE 独立运行。

## 运行与开发

### 本地启动
```bash
python main.py
```

端口默认为 5000，可通过环境变量覆盖：
```bash
PORT=5001 python main.py
```

### PyInstaller 打包（Windows）
在项目根目录执行：
```bash
pip install -r requirements.txt
pyinstaller --name "自动化控制台" --noconfirm --onedir --windowed --add-data "ui;ui/" --add-data "docs;docs/" --paths "." main.py
```

或使用 spec 文件：
```bash
pyinstaller 自动化控制台.spec
```

打包后产物在 `dist/自动化控制台/` 目录。`--add-data` 参数在 Windows 上使用分号分隔符，macOS/Linux 上需改为冒号。

### GitHub Actions 自动构建
推送 `v*` 格式 tag 时会触发 `.github/workflows/build.yml`，在 Windows runner 上自动构建 EXE 并上传为 Release 附件。

## 架构概览

### 分层结构
```
├── main.py                    # 入口：create_app() + 浏览器自启
├── app_factory.py             # Flask 应用工厂 + Blueprint 注册
├── config.py                  # 配置类（PORT、HOST）
├── logging_config.py          # 日志配置
├── error_handlers.py          # 全局错误处理中间件
├── api_routes/                # 路由层（Blueprint 按功能拆分）
│   ├── _helpers.py            # 请求解析工具（cookie/手机号校验）
│   ├── page_routes.py         # GET / + /docs/* 静态文档
│   ├── recharge.py            # /api/recharge/*
│   ├── suspend.py             # /api/suspend/*
│   ├── resume.py              # /api/resume/*
│   ├── cancel.py              # /api/cancel/*
│   ├── cancel_account.py      # /api/cancel_account/*
│   ├── balance.py             # /api/balance/*
│   ├── cdr.py                 # /api/cdr/*
│   ├── sql.py                 # /api/sql/* (product/package/offer SQL 生成)
│   └── database.py            # /api/database/* (MySQL 连接/执行)
├── core/
│   ├── utils.py               # 纯工具函数（parse_phones, normalize_cookie）
│   ├── base.py                # BatchPhoneService 抽象基类
│   ├── database.py            # MySQL 连接管理（全局连接池）
│   ├── result_serializers.py  # dataclass → dict 序列化
│   ├── api/                   # 外部 API 客户端层
│   │   ├── bossweb_client.py  # BossWeb HTTP 客户端（所有底层接口）
│   │   ├── recharge_api.py    # 赠费相关 API 解析
│   │   └── cdr_api.py         # 详单 API 解析
│   └── services/              # 业务逻辑层
│       ├── recharge_service.py
│       ├── suspend_service.py
│       ├── resume_service.py
│       ├── cancel_account_service.py
│       ├── balance_service.py
│       ├── cdr_service.py
│       ├── order_cancel_service.py
│       ├── sql_generator.py            # 产品 SQL 生成
│       ├── package_sql_generator.py    # 套餐 SQL 生成
│       └── offer_sql_generator.py      # 销售品 SQL 生成
├── docs/
│   └── city_code.csv           # 省份城市编码表（采购号码提取用）
└── ui/
    ├── templates/index.html    # 单页应用（6 个 Tab）
    └── static/                 # JS 模块拆分
        ├── utils.js            # 工具函数
        ├── batch_engine.js     # BatchProcessor 批处理引擎
        ├── result_rendering.js # 表格渲染
        ├── feature_processors.js # 功能入口 + BatchProcessor 实例
        ├── file_upload.js      # Excel/CSV 文件上传
        ├── export.js           # Excel 导出
        ├── ui_controller.js    # Tab 切换 / 功能参数面板
        ├── product_sql.js      # 产品指令配置
        ├── package_sql.js      # 产品套餐 SQL
        ├── offer_sql.js        # 销售品 SQL
        ├── phone_extract.js    # 采购号码提取
        └── database.js         # 数据库连接/执行
```

### 前端 Tab 结构

| Tab ID | 名称 | 功能 |
|--------|------|------|
| business | 业务办理 | 7 种批量业务操作 |
| product | 指令配置 | 产品 Oracle SQL 生成 |
| package | 产品套餐 | 套餐 SQL 生成 |
| offer | 销售品套餐 | 销售品 SQL 生成 |
| phone_extract | 采购号码提取 | 按省市/等级/数量提取号码 SQL |
| database | 数据库连接 | MySQL 连接和 SQL 执行 |

### 核心设计模式

**应用工厂模式**：`create_app()` 负责创建 Flask 实例、注册 Blueprint、配置日志和错误处理。`main.py` 仅作为入口点调用工厂。

**Blueprint 路由拆分**：每个业务功能对应独立 Blueprint，URL 前缀与功能名对应（如 `/api/recharge`、`/api/suspend`）。所有路由在 `app_factory.py` 中统一注册。

**请求解析统一化**：`api_routes/_helpers.py` 提供 `parse_cookie_and_phones` 和 `parse_cookie_and_phone` 两个函数，每个 Blueprint 的 `process` 和 `process_one` 端点复用同一处理逻辑。

**服务层基类**：`core/base.py` 中的 `BatchPhoneService` 抽象基类提供标准的 `process_phones` 循环。`SuspendService`、`ResumeService`、`CancelAccountService`、`BalanceService` 继承此基类。

**结果序列化分离**：`core/result_serializers.py` 将所有 dataclass 结果转为 JSON 可序列化字典。

**前端批处理引擎**：`batch_engine.js` 中的 `BatchProcessor` 类封装了所有批处理的共同模式。每个功能通过配置对象实例化一个处理器。

### BossWeb API 层

`bossweb_client.py` 是京东 BossWeb 系统的 HTTP 客户端，封装了所有底层接口调用。所有服务层通过 API 层与外部系统交互。

### Cookie 处理

Cookie 支持多种格式输入（纯 cookie、curl 命令、多行 headers），通过 `core/utils.py` 中的 `normalize_cookie` 函数统一解析。

### PyInstaller 兼容性

`get_resource_path()` 函数处理打包后的资源路径（使用 `sys._MEIPASS`）。所有对 `ui/templates`、`ui/static`、`docs/` 的引用必须通过此函数获取路径。
