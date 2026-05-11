async function dbConnect() {
    const payload = {
        host: document.getElementById('dbHost').value.trim(),
        port: parseInt(document.getElementById('dbPort').value),
        user: document.getElementById('dbUser').value.trim(),
        password: document.getElementById('dbPassword').value,
        database: document.getElementById('dbName').value.trim(),
    };

    const statusEl = document.getElementById('dbStatus');
    statusEl.textContent = '连接中...';
    statusEl.style.color = '#fa8c16';

    try {
        const res = await fetch('/api/database/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const result = await res.json();
        if (result.success) {
            statusEl.textContent = '已连接';
            statusEl.style.color = '#52c41a';
            alert('数据库连接成功！');
        } else {
            statusEl.textContent = '连接失败';
            statusEl.style.color = '#f56c6c';
            alert('连接失败: ' + result.message);
        }
    } catch (e) {
        statusEl.textContent = '连接失败';
        statusEl.style.color = '#f56c6c';
        alert('请求失败: ' + e);
    }
}

async function dbDisconnect() {
    try {
        const res = await fetch('/api/database/disconnect', { method: 'POST' });
        const result = await res.json();
        const statusEl = document.getElementById('dbStatus');
        statusEl.textContent = '未连接';
        statusEl.style.color = '#999';
        alert(result.message);
    } catch (e) {
        alert('请求失败: ' + e);
    }
}

async function dbCheckStatus() {
    try {
        const res = await fetch('/api/database/check_status', { method: 'POST' });
        const result = await res.json();
        const statusEl = document.getElementById('dbStatus');
        if (result.connected) {
            statusEl.textContent = '已连接';
            statusEl.style.color = '#52c41a';
        } else {
            statusEl.textContent = '未连接';
            statusEl.style.color = '#999';
        }
    } catch (e) {
        const statusEl = document.getElementById('dbStatus');
        statusEl.textContent = '检查失败';
        statusEl.style.color = '#f56c6c';
    }
}

async function dbExecute() {
    const sql = document.getElementById('dbSqlInput').value.trim();
    if (!sql) {
        alert('请输入 SQL 语句');
        return;
    }

    const resultCard = document.getElementById('dbResultCard');
    const resultArea = document.getElementById('dbResultArea');

    try {
        const res = await fetch('/api/database/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sql }),
        });
        const result = await res.json();

        resultCard.style.display = 'block';
        let output = '';
        output += result.message + '\n\n';

        if (result.results) {
            result.results.forEach((r, i) => {
                output += `--- SQL #${i + 1} ---\n`;
                output += `状态: ${r.success ? '成功' : '失败'}\n`;
                output += `信息: ${r.message}\n`;
                if (r.results && r.results.length > 0) {
                    output += `记录数: ${r.results.length}\n`;
                    r.results.forEach(row => {
                        output += JSON.stringify(row) + '\n';
                    });
                }
                output += '\n';
            });
        }

        resultArea.textContent = output;
    } catch (e) {
        resultCard.style.display = 'block';
        resultArea.textContent = '请求失败: ' + e;
    }
}

function clearDbResult() {
    const resultArea = document.getElementById('dbResultArea');
    if (resultArea) {
        resultArea.textContent = '';
    }
    const resultCard = document.getElementById('dbResultCard');
    if (resultCard) {
        resultCard.style.display = 'none';
    }
}
