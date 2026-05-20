// ===== 指令配置 SQL 生成（产品 Tab） =====
import { toggleServiceSection } from './ui_controller.js';

const REASON_CODES = [
   { code: "12", name: "挂失", default: true },
   { code: "13", name: "解挂", default: true },
   { code: "14", name: "停机保号", default: true },
   { code: "15", name: "复机", default: true },
   { code: "30", name: "个性化取消流量", default: false },
   { code: "31", name: "个性化开流量", default: false },
   { code: "50", name: "欠费单停", default: true },
   { code: "60", name: "局方单停", default: true },
   { code: "61", name: "局方单开", default: true },
   { code: "70", name: "欠费双停", default: true },
   { code: "71", name: "欠费开机", default: true },
   { code: "80", name: "电信局方停机", default: false },
   { code: "81", name: "电信局方开机", default: false },
   { code: "90", name: "局方停机", default: true },
   { code: "91", name: "局方开机", default: true },
   { code: "96", name: "后台欠费拆机", default: false },
   { code: "97", name: "开户返销", default: true },
   { code: "98", name: "销户", default: false },
   { code: "99", name: "激活", default: false },
   { code: "100", name: "流量封顶", default: false },
   { code: "101", name: "流量封顶解除", default: false },
   { code: "300", name: "两个月未通话停来显", default: false },
   { code: "301", name: "两个月未通话开来显", default: false },
   { code: "1000", name: "开启流量限速", default: false },
   { code: "1001", name: "关闭流量限速", default: false }
];

const REASON_ACTION_MAP = {
   "12": "off",
   "13": "order",
   "14": "off",
   "15": "on",
   "30": "off",
   "31": "on",
   "50": "off",
   "60": "halfOff",
   "61": "order",
   "70": "off",
   "71": "on",
   "80": "off",
   "81": "on",
   "90": "off",
   "91": "on",
   "96": "off",
   "97": "off",
   "98": "off",
   "99": "on",
   "100": "off",
   "101": "order",
   "300": "off",
   "301": "order",
   "1000": "off",
   "1001": "on"
};

let instRowId = 0;

function initReasonCodes() {
   const container = document.getElementById('reasonCodeGroup');
   REASON_CODES.forEach(rc => {
      const div = document.createElement('div');
      div.className = 'checkbox-item';
      const checked = rc.default ? 'checked' : '';
      div.innerHTML = `
            <input type="checkbox" id="rc_${rc.code}" value="${rc.code}" ${checked}>
            <label for="rc_${rc.code}">${rc.code} - ${rc.name}</label>
        `;
      container.appendChild(div);
   });
}

function addInstructionRow() {
   const container = document.getElementById('instructionsContainer');
   const row = document.createElement('div');
   row.className = 'inst-row';
   row.id = `inst_row_${instRowId}`;

   row.innerHTML = `
        <select class="inst-action">
            <option value="order">order (订购)</option>
            <option value="unsubscribe">unsubscribe (退订)</option>
            <option value="on">on (全开)</option>
            <option value="halfoff">halfoff (半停)</option>
            <option value="off">off (全停)</option>
        </select>
        <input type="text" class="inst-vopcode" placeholder="VOP_CODE" style="width:120px;">
        <input type="text" class="inst-comments" placeholder="注解/说明" style="flex:1;">
        <input type="text" class="inst-dependence" placeholder="DEPENDENCE" style="width:100px;">
        <input type="text" class="inst-key" placeholder="KEY" style="width:80px;">
        <input type="text" class="inst-actionpe" placeholder="ACTION_PE" style="width:80px;">
        <input type="text" class="inst-flag" placeholder="FLAG" style="width:60px;">
        <input type="text" class="inst-vopprod" placeholder="VOP_PROD" style="width:100px;">
        <button class="btn-remove" onclick="removeInstructionRow('${row.id}')">删除</button>
    `;
   container.appendChild(row);
   instRowId++;
}

function removeInstructionRow(id) {
   document.getElementById(id).remove();
}

function copySql() {
   const text = document.getElementById('sqlResult').value;
   if (!text) return;
   navigator.clipboard.writeText(text).then(() => {
      alert('SQL 已复制到剪贴板！');
   });
}

function copySqlToDbExecute() {
   const sql = document.getElementById('sqlResult').value;
   if (!sql) return;
   const dbSqlInput = document.getElementById('dbSqlInput');
   if (dbSqlInput) dbSqlInput.value = sql;
   navigator.clipboard.writeText(sql).then(() => alert('已复制到剪贴板'));
}

// 挂到 window 供 onclick 调用
window.addInstructionRow = addInstructionRow;
window.removeInstructionRow = removeInstructionRow;
window.copySql = copySql;
window.copySqlToDbExecute = copySqlToDbExecute;

document.getElementById('refProductId').addEventListener('input', function (e) {
   const refId = e.target.value.trim();
   const hints = document.querySelectorAll('.sql-hint');
   hints.forEach(hint => {
      if (refId) {
         hint.style.display = 'block';
         hint.innerText = hint.getAttribute('data-tpl').replace('{id}', refId);
      } else {
         hint.style.display = 'none';
      }
   });
});

document.getElementById('generateBtn').addEventListener('click', async () => {
   const data = {
      PRODUCT_NAME: document.getElementById('PRODUCT_NAME').value.trim(),
      PRODUCT_DESC: document.getElementById('PRODUCT_DESC').value.trim(),
      PRODUCT_TYPE: document.getElementById('PRODUCT_TYPE').value,
      PRODUCT_PRICE: document.getElementById('PRODUCT_PRICE').value.trim(),
      TELE_TYPE: document.getElementById('TELE_TYPE').value,
      PROD_SUB_TYPE: document.getElementById('PROD_SUB_TYPE').value,

      PROD_PRICE_TYPE: document.getElementById('PROD_PRICE_TYPE').value,
      PROD_LEVEL: document.getElementById('PROD_LEVEL').value,

      MAPPING_VALUE: document.getElementById('MAPPING_VALUE').value.trim(),
      VOP_PRODUCT_TYPE: document.getElementById('VOP_PRODUCT_TYPE').value,
      DISCOUNT_FEE: document.getElementById('DISCOUNT_FEE').value.trim(),
      MAPPING_PKG_VALUE: document.getElementById('MAPPING_PKG_VALUE').value.trim()
   };

   if (data.PROD_SUB_TYPE === 'S' || data.PROD_SUB_TYPE === 'B' || data.PROD_SUB_TYPE === 'P') {
      const instRows = document.querySelectorAll('.inst-row');
      data.INSTRUCTIONS = Array.from(instRows).map(row => {
         return {
            ACTION: row.querySelector('.inst-action').value,
            VOP_CODE: row.querySelector('.inst-vopcode').value.trim(),
            COMMENTS_CRM: row.querySelector('.inst-comments').value.trim(),
            DEPENDENCE: row.querySelector('.inst-dependence').value.trim(),
            KEY: row.querySelector('.inst-key').value.trim(),
            ACTION_PE: row.querySelector('.inst-actionpe').value.trim(),
            FLAG: row.querySelector('.inst-flag').value.trim(),
            VOP_PROD: row.querySelector('.inst-vopprod').value.trim()
         };
      });
   }

   if (data.PROD_SUB_TYPE === 'S' || data.PROD_SUB_TYPE === 'B') {
      data.SERVICE_TYPE = document.getElementById('SERVICE_TYPE').value.trim();
      data.IS_ONLY_OPEN = document.getElementById('IS_ONLY_OPEN').value;

      const checkedReasons = document.querySelectorAll('#reasonCodeGroup input[type="checkbox"]:checked');
      data.REASON_CODES = Array.from(checkedReasons).map(cb => {
         const code = cb.value;
         return {
            code: code,
            action: REASON_ACTION_MAP[code] || 'off'
         };
      });
   }

   try {
      const res = await fetch('/api/sql/generate_product', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(data)
      });
      const result = await res.json();
      if (result.success) {
         document.getElementById('sqlResult').value = result.data;
      } else {
         alert('生成失败: ' + result.message);
      }
   } catch (err) {
      alert('请求出错: ' + err.message);
   }
});

// Modules are deferred — DOM is ready, run init immediately
initReasonCodes();
addInstructionRow();
toggleServiceSection();
