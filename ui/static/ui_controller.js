// ===== UI 控制器：Tab 切换、功能参数面板、退出系统 =====

function switchTab(tabId) {
    document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById(tabId).classList.add('active');
}

function toggleServiceSection() {
    const subType = document.getElementById("PROD_SUB_TYPE").value;
    const serviceSection = document.getElementById("serviceSection");
    const instructionSection = document.getElementById("instructionSection");
    if (serviceSection) serviceSection.style.display = (subType === 'S' || subType === 'B') ? 'block' : 'none';
    if (instructionSection) instructionSection.style.display = (subType === 'S' || subType === 'B' || subType === 'P') ? 'block' : 'none';
}

function onFunctionChange() {
    const sel = document.getElementById('selectedFunction');
    const func = sel ? sel.value : '';
    const container = document.getElementById('funcParams');
    if (!container) return;
    let html = '';

    if (func === 'recharge') {
        html = '<div class="col"><div class="status">赠费防重查询日期范围：号码激活日期（active_time）至今天（自动计算）</div></div>';
    } else if (func === 'suspend') {
        html = `<div class="col">
            <label style="display: flex; align-items: center; gap: 6px;">
                <input type="checkbox" id="autoSuspendCheck" checked style="width: auto; height: auto;">
                <span style="font-size: 14px;">符合条件自动停机</span>
            </label>
        </div>`;
    } else if (func === 'resume') {
        html = `<div class="col" style="display: flex; flex-direction: column; gap: 8px;">
            <label style="display: flex; align-items: center; gap: 6px;">
                <input type="checkbox" id="autoResumeCheck" checked style="width: auto; height: auto;">
                <span style="font-size: 14px;">符合条件自动开机</span>
            </label>
            <div><input type="text" id="resumeRemark" placeholder="开机备注" value="企业方开机-余额充足开机"
                style="width: 300px; height: 36px; padding: 0 8px; font-size: 14px; border: 1px solid #dcdfe6; border-radius: 4px;"></div>
        </div>`;
    } else if (func === 'balance') {
        html = `<div class="col" style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
            <span style="font-size: 14px;">查询类型</span>
            <select id="balanceQueryMode" style="height: 36px; font-size: 14px; min-width: 180px;">
                <option value="simple" selected>只查状态+余额</option>
                <option value="ledger">查状态+账本明细</option>
            </select>
        </div>
        <div class="col" style="margin-top: 8px;" id="balanceSimpleFieldsContainer">
            <label style="font-size: 14px; margin-bottom: 6px; display: block;">选择显示字段</label>
            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                <label style="display: flex; align-items: center; gap: 4px; font-size: 13px;">
                    <input type="checkbox" id="balanceField_phone" checked disabled><span>手机号</span></label>
                <label style="display: flex; align-items: center; gap: 4px; font-size: 13px;">
                    <input type="checkbox" id="balanceField_plan_name" checked><span>套餐名称</span></label>
                <label style="display: flex; align-items: center; gap: 4px; font-size: 13px;">
                    <input type="checkbox" id="balanceField_user_status" checked><span>状态</span></label>
                <label style="display: flex; align-items: center; gap: 4px; font-size: 13px;">
                    <input type="checkbox" id="balanceField_balance" checked><span>余额</span></label>
                <label style="display: flex; align-items: center; gap: 4px; font-size: 13px;">
                    <input type="checkbox" id="balanceField_active_time" checked><span>激活时间</span></label>
                <label style="display: flex; align-items: center; gap: 4px; font-size: 13px;">
                    <input type="checkbox" id="balanceField_owe_amount" checked><span>欠费金额</span></label>
                <label style="display: flex; align-items: center; gap: 4px; font-size: 13px;">
                    <input type="checkbox" id="balanceField_message" checked disabled><span>结果</span></label>
            </div>
        </div>`;
    } else if (func === 'cdr') {
        html = `<div class="row" style="margin: 0; gap: 15px;">
            <div class="col input-group" style="flex: 1; min-width: 150px;">
                <label>详单类型</label>
                <select id="cdrServiceType" style="height: 36px; font-size: 14px;">
                    <option value="">综合（全部）</option>
                    <option value="1">通话</option><option value="2">上网</option><option value="3">短信</option>
                </select>
            </div>
            <div class="col input-group" style="flex: 1; min-width: 150px;">
                <label>结果类型</label>
                <select id="cdrResultMode" style="height: 36px; font-size: 14px;">
                    <option value="detail">查明细</option><option value="total">只查总量</option>
                </select>
            </div>
            <div class="col input-group" style="flex: 1; min-width: 150px;">
                <label>开始日期</label><input type="date" id="cdrStartDate">
            </div>
            <div class="col input-group" style="flex: 1; min-width: 150px;">
                <label>结束日期</label><input type="date" id="cdrEndDate">
            </div>
        </div>`;
    }

    container.innerHTML = html;
}

function exitSystem() {
    if (confirm('确定要退出系统吗？这会停止正在执行的任务并关闭页面。')) {
        if (typeof _batchRunning !== 'undefined' && _batchRunning) {
            _batchStopRequested = true;
            addLog('用户请求退出系统，已停止批处理');
        }
        window.close();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    onFunctionChange();
    if (typeof pkgInitReferenceHint === 'function') {
        pkgInitReferenceHint();
    }
});
