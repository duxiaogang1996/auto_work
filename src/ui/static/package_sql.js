// ===== 产品指令 SQL 生成（套餐 Tab） =====

let pkgProductRowId = 0;

function pkgInitReferenceHint() {
    const refInput = document.getElementById('pkg_refPackageId');
    if (!refInput) return;
    refInput.addEventListener('input', function (e) {
        const refId = e.target.value.trim();
        const hints = document.querySelectorAll('#package .sql-hint');
        hints.forEach(hint => {
            if (refId) {
                hint.style.display = 'block';
                hint.innerText = hint.getAttribute('data-tpl').replace('{id}', refId);
            } else {
                hint.style.display = 'none';
            }
        });
    });
}

function pkgAddProductRow() {
    const container = document.getElementById('pkgProductContainer');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'pkg-prod-row';
    row.id = `pkg_prod_row_${pkgProductRowId}`;

    row.innerHTML = `
        <select class="pkg-prod-type" style="width: 140px;">
            <option value="00">00 - 主产品</option>
            <option value="01">01 - 资费产品</option>
        </select>
        <input type="text" class="pkg-prod-id" placeholder="产品ID (PRODUCT_ID)" style="flex:1;">
        <input type="text" class="pkg-prod-mapping" placeholder="MAPPING_VALUE" style="width: 150px;">
        <button class="btn-remove" onclick="pkgRemoveProductRow('${row.id}')">删除</button>
    `;
    container.appendChild(row);
    pkgProductRowId++;
}

function pkgRemoveProductRow(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function pkgCopySql() {
    const text = document.getElementById('pkgSqlResult').value;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        alert('SQL 已复制到剪贴板！');
    });
}

function pkgCopySqlToDbExecute() {
    const sql = document.getElementById('pkgSqlResult').value;
    if (!sql) {
        alert('没有生成的 SQL');
        return;
    }
    const dbSqlInput = document.getElementById('dbSqlInput');
    if (dbSqlInput) {
        dbSqlInput.value = sql;
    }
    navigator.clipboard.writeText(sql).then(() => alert('已复制到剪贴板'));
}

window.pkgAddProductRow = pkgAddProductRow;
window.pkgRemoveProductRow = pkgRemoveProductRow;
window.pkgCopySql = pkgCopySql;
window.pkgCopySqlToDbExecute = pkgCopySqlToDbExecute;

document.getElementById('pkgGenerateBtn').addEventListener('click', async () => {
    const data = {
        PACKAGE_NAME: document.getElementById('PKG_PACKAGE_NAME').value.trim(),
        PACKAGE_DESC: document.getElementById('PKG_PACKAGE_DESC').value.trim(),
        TELE_TYPE: document.getElementById('PKG_TELE_TYPE').value,
        PACKAGE_TYPE: document.getElementById('PKG_PACKAGE_TYPE').value,
        PACKAGE_PRICE: document.getElementById('PKG_PACKAGE_PRICE').value.trim(),
        EFFECT_MONTH: document.getElementById('PKG_EFFECT_MONTH').value.trim(),

        EFF_TYPE: document.getElementById('PKG_EFF_TYPE').value,
        CAN_REFUND: document.getElementById('PKG_CAN_REFUND').value,
        OPEN_ORDER_FLAG: document.getElementById('PKG_OPEN_ORDER_FLAG').value,
        CREDIT_LEVEL: document.getElementById('PKG_CREDIT_LEVEL').value.trim()
    };

    const prodRows = document.querySelectorAll('.pkg-prod-row');
    data.PRODUCTS = Array.from(prodRows).map(row => {
        return {
            PRODUCT_TYPE: row.querySelector('.pkg-prod-type').value,
            PRODUCT_ID: row.querySelector('.pkg-prod-id').value.trim(),
            MAPPING_VALUE: row.querySelector('.pkg-prod-mapping').value.trim()
        };
    });

    try {
        const res = await fetch('/api/sql/generate_package', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            document.getElementById('pkgSqlResult').value = result.data;
        } else {
            alert('生成失败: ' + result.message);
        }
    } catch (err) {
        alert('请求出错: ' + err.message);
    }
});

pkgInitReferenceHint();
