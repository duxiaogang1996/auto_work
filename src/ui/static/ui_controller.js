// ===== UI 控制器：侧边栏切换、Tab 切换、功能参数面板、退出系统 =====
import { addLog, restoreCookie, clearSavedCookie } from './utils.js';

// Tab 名称映射（用于面包屑）
const TAB_GROUP = {
    business: { group: '业务管理', label: '业务办理' },
    product: { group: '产品配置', label: '指令配置' },
    package: { group: '产品配置', label: '产品指令' },
    offer: { group: '产品配置', label: '销售品套餐' },
    phone_extract: { group: '系统工具', label: '采购号码提取' },
};

const FUNC_LABELS = {
    recharge: '补赠费',
    suspend: '停机筛号',
    cancel: '撤单',
    resume: '开机',
    cancel_account: '销户校验',
    balance: '余额查询',
    cdr: '详单查询',
};

const FUNC_DANGEROUS = {
    recharge: true, suspend: true, resume: false,
    cancel: true, cancel_account: false, balance: false, cdr: false,
};

// 暴露工具函数供 feature_processors.js 使用
window.__utils = { restoreCookie, clearSavedCookie };

let _selectedFunction = 'recharge';

// ===== 侧边栏折叠/展开 =====
let sidebarCollapsed = window.innerWidth <= 768;

export function toggleSidebar() {
    sidebarCollapsed = !sidebarCollapsed;
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) {
        sidebar.classList.toggle('collapsed', sidebarCollapsed);
        if (window.innerWidth <= 768) {
            sidebar.classList.toggle('drawer-open', !sidebarCollapsed);
        }
    }
    if (overlay) overlay.classList.toggle('show', !sidebarCollapsed && window.innerWidth <= 768);
}

// ===== 标签页切换 =====
export function switchTab(tabId) {
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    const menuEl = document.querySelector(`.menu-item[data-tab="${tabId}"]`);
    if (menuEl) menuEl.classList.add('active');

    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    const contentEl = document.getElementById(tabId);
    if (contentEl) contentEl.classList.add('active');

    const breadcrumbEl = document.getElementById('breadcrumb');
    const info = TAB_GROUP[tabId] || { group: '', label: tabId };
    if (breadcrumbEl) {
        var html = '<span class="breadcrumb-item">首页</span>';
        if (info.group) {
            html += '<span class="breadcrumb-sep">/</span>';
            html += '<span class="breadcrumb-item">' + info.group + '</span>';
        }
        html += '<span class="breadcrumb-sep">/</span>';
        html += '<span class="breadcrumb-item" id="breadcrumbCurrent">' + info.label + '</span>';
        breadcrumbEl.innerHTML = html;
    }

    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (sidebar) { sidebar.classList.add('collapsed'); sidebar.classList.remove('drawer-open'); }
        if (overlay) overlay.classList.remove('show');
    }
}

// ===== 仅在产品 Tab 中通过 HTML onchange 调用 =====
export function toggleServiceSection() {
    const subType = document.getElementById("PROD_SUB_TYPE").value;
    const serviceSection = document.getElementById("serviceSection");
    const instructionSection = document.getElementById("instructionSection");
    if (serviceSection) serviceSection.style.display = (subType === 'S' || subType === 'B') ? 'block' : 'none';
    if (instructionSection) instructionSection.style.display = (subType === 'S' || subType === 'B' || subType === 'P') ? 'block' : 'none';
}

// ===== 功能按钮选择 =====
export function selectFunction(funcKey) {
    _selectedFunction = funcKey;

    // 高亮按钮
    document.querySelectorAll('.func-btn').forEach(el => el.classList.remove('active'));
    const btn = document.querySelector(`.func-btn[data-func="${funcKey}"]`);
    if (btn) btn.classList.add('active');

    // 切换参数面板
    document.querySelectorAll('.func-params').forEach(el => el.style.display = 'none');
    const paramsEl = document.getElementById('param' + funcKey.charAt(0).toUpperCase() + funcKey.slice(1));
    if (paramsEl) paramsEl.style.display = 'block';

    // 更新执行按钮
    const runBtn = document.getElementById('runSelectedBtn');
    if (runBtn) {
        var label = FUNC_LABELS[funcKey] || funcKey;
        runBtn.innerHTML = '▶ 执行 ' + label;
        runBtn.className = FUNC_DANGEROUS[funcKey] ? 'btn-warning' : 'btn-success';
    }
}

export function getSelectedFunction() {
    return _selectedFunction;
}

// ===== 退出系统 =====
export function exitSystem() {
    clearSavedCookie();
    if (confirm('确定要退出系统吗？这会停止正在执行的任务并关闭页面。')) {
        const { isBatchRunning, requestBatchStop } = window;
        if (isBatchRunning && isBatchRunning()) {
            requestBatchStop();
            addLog('用户请求退出系统，已停止批处理');
        }
        window.close();
    }
}

// ===== 详单模式切换 =====
export function onCdrModeChange() {
    // 目前仅用于预设日期格式，无额外逻辑
}

// 挂到 window 供 HTML onclick 调用
window.switchTab = switchTab;
window.toggleSidebar = toggleSidebar;
window.toggleServiceSection = toggleServiceSection;
window.selectFunction = selectFunction;
window.onCdrModeChange = onCdrModeChange;
window.exitSystem = exitSystem;

document.addEventListener('DOMContentLoaded', () => {
    selectFunction('recharge');
});
