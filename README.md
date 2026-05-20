# 自动化控制台

基于 Flask 的京东 BossWeb 系统批量业务操作与产品配置工具。

## 功能列表

### 业务办理（批量操作）

| 功能 | 说明 |
|------|------|
| 补赠费 | 按号码执行赠费，含防重校验 |
| 停机筛号 | 查询余额/状态，符合条件的号码自动停机 |
| 撤单 | 查询可撤单后执行撤单 |
| 开机 | 局方停机且余额≥0 自动开机 |
| 销户校验 | 筛选余额≥0 的可销户号码 |
| 余额查询 | 逐号查询余额状态，支持简单/账本明细两种模式 |
| 详单查询 | 查询通话/短信/上网详单 |

### 产品配置

| Tab | 说明 |
|-----|------|
| 指令配置 | 产品 Oracle SQL 生成（11 张表） |
| 产品套餐 | 套餐 SQL 生成（3 张表） |
| 销售品套餐 | 销售品 SQL 生成（9 张表） |
| 采购号码提取 | 按省市/等级/数量生成查询 SQL |
| 数据库连接 | MySQL 连接与 SQL 执行 |

## 目录结构

```
自动化控制台_v2/
├── main.py                    # 入口（create_app + 浏览器自启）
├── app_factory.py             # Flask 应用工厂 + Blueprint 注册
├── config.py                  # 配置类
├── logging_config.py          # 日志配置
├── error_handlers.py          # 全局错误处理
├── requirements.txt
├── 自动化控制台.spec           # PyInstaller 打包配置
├── api_routes/                # 路由层（按功能拆分的 Blueprint）
│   ├── _helpers.py            # 请求解析工具
│   ├── page_routes.py         # 首页 + 文档服务
│   ├── recharge.py            # 补赠费
│   ├── suspend.py             # 停机筛号
│   ├── resume.py              # 开机
│   ├── cancel.py              # 撤单
│   ├── cancel_account.py      # 销户校验
│   ├── balance.py             # 余额查询
│   ├── cdr.py                 # 详单查询
│   ├── sql.py                 # SQL 生成（product/package/offer）
│   └── database.py            # MySQL 连接/执行
├── core/
│   ├── utils.py               # 工具函数
│   ├── base.py                # 服务基类
│   ├── database.py            # MySQL 连接管理
│   ├── result_serializers.py  # 结果序列化
│   ├── api/                   # 外部 API 客户端
│   └── services/              # 业务逻辑层
├── ui/
│   ├── templates/index.html   # 前端页面（6 Tab）
│   └── static/                # JS 模块
└── docs/
    └── city_code.csv          # 省份城市编码表
```

## 本地启动

```bash
python main.py
```

默认端口 5000，可通过环境变量覆盖：

```bash
PORT=5001 python main.py
```

## PyInstaller 打包（Windows）

```bash
pip install -r requirements.txt
pyinstaller 自动化控制台.spec
```

或使用命令行（Windows 用分号分隔符，macOS/Linux 用冒号）：

```bash
# Windows
pyinstaller --name "自动化控制台" --noconfirm --onedir --windowed --add-data "ui;ui/" --add-data "docs;docs/" --paths "." main.py

# macOS/Linux
pyinstaller --name "自动化控制台" --noconfirm --onedir --windowed --add-data "ui:ui/" --add-data "docs:docs/" --paths "." main.py
```

## GitHub Actions 自动构建

推送 `v*` 格式 tag（如 `v1.0.0`）会触发 `.github/workflows/build.yml`，自动在 Windows 上构建 EXE 并发布为 Release。
