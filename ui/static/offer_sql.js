function togglePresentSection() {
    const hasPresent = document.getElementById('HAS_PRESENT').checked;
    const section = document.getElementById('presentSection');
    if (section) {
        section.style.display = hasPresent ? 'block' : 'none';
    }
}

function offerCopySql() {
    const sqlResult = document.getElementById('offerSqlResult');
    if (!sqlResult || !sqlResult.value) {
        alert('没有生成的SQL可以复制！');
        return;
    }
    sqlResult.select();
    document.execCommand('copy');
    alert('SQL已复制到剪贴板！');
}

function offerCopySqlToDbExecute() {
    const sql = document.getElementById('offerSqlResult').value;
    if (!sql) {
        alert('没有生成的 SQL');
        return;
    }
    const dbSqlInput = document.getElementById('dbSqlInput');
    if (dbSqlInput) {
        dbSqlInput.value = sql;
    }
    if (typeof switchTab === 'function') {
        switchTab('database');
    }
}

function offerInitReferenceHint() {
    const refInput = document.getElementById('offer_refOfrId');
    if (!refInput) return;

    refInput.addEventListener('input', function() {
        const value = this.value.trim();
        const container = document.getElementById('offerRefSql');
        if (!container) return;
        if (!value) {
            container.innerHTML = '';
            return;
        }
        let html = '<div class="sql-hint-box"><pre>';
        html += '-- 查询销售品基本信息\n';
        html += `select * from crm_ofr.code_ofr where ofr_id='${value}';\n\n`;
        html += '-- 查询产品信息\n';
        html += `select * from crm_product.code_product where product_id in (select product_id from crm_ofr.rule_ofr_product where ofr_id='${value}');\n\n`;
        html += '-- 查询套餐产品属性\n';
        html += `select * from crm_product.code_product_dinner_attr where product_id in (select product_id from crm_ofr.rule_ofr_product where ofr_id='${value}');\n\n`;
        html += '-- 查询月租配置\n';
        html += `select * from router.rent_offer where product_id in (select product_id from crm_ofr.rule_ofr_product where ofr_id='${value}');\n`;
        html += '-- 关联查询月租计划、策略、费率\n';
        html += `select ro.*, rp.*, rpc.*, rr.*, rp.* from router.rent_offer ro\n  left join router.rent_plan rp on ro.rent_plan_id = rp.rent_plan_id\n  left join router.rent_policy rpc on rp.rent_policy_id = rpc.rent_policy_id\n  left join router.rent_rate rr on rpc.rate_id = rr.rate_id\n  where ro.product_id in (select product_id from crm_ofr.rule_ofr_product where ofr_id='${value}');\n`;
        html += '</pre></div>';
        container.innerHTML = html;
    });
}

async function generateOfferSql() {
    const data = {
        OFR_NAME: document.getElementById('OFR_NAME').value.trim(),
        OFR_DESC: document.getElementById('OFR_DESC').value.trim(),
        MARKET_PRICE: document.getElementById('MARKET_PRICE').value.trim(),
        OFR_SUB_TYPE: document.getElementById('OFR_SUB_TYPE').value,
        TELE_TYPE: document.getElementById('TELE_TYPE').value,
        GROUP_FLAG: document.getElementById('GROUP_FLAG').value,
        GROUP_TYPE: document.getElementById('GROUP_TYPE').value.trim(),
        OFR_MODE_TYPE: document.getElementById('OFR_MODE_TYPE').value,
        SUB_MODE_TYPE: document.getElementById('SUB_MODE_TYPE').value,
        EXP_TYPE: document.getElementById('EXP_TYPE').value,
        EXP_VALUE: document.getElementById('EXP_VALUE').value.trim(),
        REPEAT_FLAG: document.getElementById('REPEAT_FLAG').value,
        OTA_OFR_DESC: document.getElementById('OTA_OFR_DESC').value.trim(),
        OFRRENT: document.getElementById('OFRRENT').value.trim(),
        OTA_ADVANTAGE_DESC: document.getElementById('OTA_ADVANTAGE_DESC').value.trim(),
        CALL_TIME: document.getElementById('CALL_TIME').value.trim(),
        FLOW: document.getElementById('FLOW').value.trim(),
        SMS_NUM: document.getElementById('SMS_NUM').value.trim(),
        EXT_CALL_STANDARD: document.getElementById('EXT_CALL_STANDARD').value.trim(),
        EXT_FLOW_STANDARD: document.getElementById('EXT_FLOW_STANDARD').value.trim(),
        EXT_SMS_STANDARD: document.getElementById('EXT_SMS_STANDARD').value.trim(),

        PRODUCT_TYPE: document.getElementById('PRODUCT_TYPE').value,
        PROD_SUB_TYPE: document.getElementById('PROD_SUB_TYPE').value,

        PROD_PRICE_TYPE: document.getElementById('PROD_PRICE_TYPE').value,
        PROD_LEVEL: document.getElementById('PROD_LEVEL').value,

        RENT_TYPE: document.getElementById('RENT_TYPE').value,
        FULL_NUM: document.getElementById('FULL_NUM').value,

        OFFSET_EXPRESSION: document.getElementById('OFFSET_EXPRESSION').value.trim(),
        STATE_REF_MODE: document.getElementById('STATE_REF_MODE').value,
        STATE_GROUP: document.getElementById('STATE_GROUP').value.trim(),
        OTHER_EXPRESSION: document.getElementById('OTHER_EXPRESSION').value.trim(),

        FEE_CODE: document.getElementById('FEE_CODE').value.trim(),
        CYCLE_UNIT: document.getElementById('CYCLE_UNIT').value,
        CYCLES: document.getElementById('CYCLES').value,
        RATE: document.getElementById('RATE').value.trim(),
        PART_FLAG: document.getElementById('PART_FLAG').value,
        RATE_COMMENTS: document.getElementById('RATE_COMMENTS').value.trim(),

        HAS_PRESENT: document.getElementById('HAS_PRESENT').checked,
        BALANCE_TYPE: document.getElementById('BALANCE_TYPE').value.trim(),
        AMOUNT_TYPE: document.getElementById('AMOUNT_TYPE').value,
        AMOUNT: document.getElementById('AMOUNT').value.trim(),
        CYCLE_TYPE: document.getElementById('CYCLE_TYPE').value,
        CYCLE_AMOUNT: document.getElementById('CYCLE_AMOUNT').value.trim(),
        OFFSET: document.getElementById('OFFSET').value.trim(),
        RULE_PRESENT_FLAG: document.getElementById('RULE_PRESENT_FLAG').value,
    };

    if (!data.OFR_NAME) {
        alert('销售品名称 (OFR_NAME) 不能为空！');
        return;
    }
    if (!data.MARKET_PRICE) {
        alert('市场价格 (MARKET_PRICE) 不能为空！');
        return;
    }
    if (!data.FEE_CODE) {
        alert('费用项 (FEE_CODE) 不能为空！');
        return;
    }
    if (!data.RATE) {
        alert('费率 (RATE) 不能为空！');
        return;
    }
    if (data.HAS_PRESENT) {
        if (!data.BALANCE_TYPE) {
            alert('账本类型 (BALANCE_TYPE) 不能为空！');
            return;
        }
        if (!data.AMOUNT) {
            alert('赠送量 (AMOUNT) 不能为空！');
            return;
        }
        if (!data.CYCLE_AMOUNT) {
            alert('周期值 (CYCLE_AMOUNT) 不能为空！');
            return;
        }
        if (!data.OFFSET) {
            alert('偏移量 (OFFSET) 不能为空！');
            return;
        }
    }

    const btn = document.getElementById('offerGenerateBtn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '生成中...';

    try {
        const response = await fetch('/api/sql/generate_offer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        const result = await response.json();
        if (result.success) {
            document.getElementById('offerSqlResult').value = result.sql;
        } else {
            alert('生成失败：' + (result.message || '未知错误'));
        }
    } catch (e) {
        alert('请求失败：' + e);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    offerInitReferenceHint();

    const hasPresentCheck = document.getElementById('HAS_PRESENT');
    if (hasPresentCheck) {
        hasPresentCheck.addEventListener('change', togglePresentSection);
        togglePresentSection();
    }

    const btn = document.getElementById('offerGenerateBtn');
    if (btn) {
        btn.addEventListener('click', generateOfferSql);
    }
});
