// ===== 采购号码提取 SQL 生成 =====

let cityCodeData = [];
let provinceMap = {};
let groupCounter = 0;

function parseCsv(csvText) {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim());
    const result = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const parts = line.split(',').map(p => p.replace(/^"|"$/g, '').trim());
        const province = parts[0] || '';
        const city = parts[1] || '';
        const cityCode = parts[2] || '';
        if (city && cityCode) {
            result.push({
                province: province || city,
                city: city,
                cityCode: cityCode
            });
        }
    }
    return result;
}

function buildProvinceMap(data) {
    const map = {};
    data.forEach(item => {
        if (!map[item.province]) {
            map[item.province] = [];
        }
        map[item.province].push(item);
    });
    return map;
}

function renderPhoneLevel() {
    const container = document.getElementById('pePhoneLevelGroup');
    if (!container) return;
    let html = '';
    for (let i = 1; i <= 9; i++) {
        const active = i === 9 ? ' active' : '';
        html += `<button class="pe-level-btn${active}" data-level="${i}" onclick="togglePhoneLevel(this)">${i}</button>`;
    }
    container.innerHTML = html;
}

function togglePhoneLevel(btn) {
    btn.classList.toggle('active');
}

function selectTelecom(value) {
    document.querySelectorAll('.pe-tab-btn').forEach(el => el.classList.remove('active'));
    const btn = document.querySelector(`.pe-tab-btn[data-telecom="${value}"]`);
    if (btn) btn.classList.add('active');
}

function getProvinces() {
    return Object.keys(provinceMap).sort();
}

function getCitiesByProvince(province) {
    if (!province || !provinceMap[province]) return [];
    return provinceMap[province].sort((a, b) => a.city.localeCompare(b.city));
}

// ===== 分组管理 =====

function peAddGroup() {
    const container = document.getElementById('peGroupsContainer');
    if (!container) return;
    groupCounter++;
    const groupId = `pe_group_${groupCounter}`;
    const provinces = getProvinces();

    let provinceOptions = '<option value="">省份</option>';
    provinces.forEach(p => {
        provinceOptions += `<option value="${p}">${p}</option>`;
    });

    const html = `
        <div id="${groupId}" class="pe-group-row">
            <div class="pe-group-field">
                <label class="pe-field-label">省份</label>
                <select id="${groupId}_province" onchange="peOnProvinceChange('${groupId}')" class="pe-group-province">
                    ${provinceOptions}
                </select>
            </div>
            <div class="pe-group-field">
                <label class="pe-field-label">城市</label>
                <select id="${groupId}_city" class="pe-group-city">
                    <option value="">全部城市</option>
                </select>
            </div>
            <div class="pe-group-field" style="flex: none; width: 70px;">
                <label class="pe-field-label">数量</label>
                <input type="number" id="${groupId}_qty" class="pe-group-qty" min="1" value="100">
            </div>
            <div class="pe-group-field" style="flex: none;">
                <label class="pe-field-label">模式</label>
                <div class="pe-group-mode">
                    <button type="button" class="pe-mode-btn active" data-group="${groupId}" data-mode="include" onclick="peSetMode('${groupId}','include')">包含</button>
                    <button type="button" class="pe-mode-btn" data-group="${groupId}" data-mode="exclude" onclick="peSetMode('${groupId}','exclude')">排除</button>
                </div>
            </div>
            <button type="button" onclick="peRemoveGroup('${groupId}')" class="pe-group-del">✕</button>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', html);
}

function peRemoveGroup(groupId) {
    const group = document.getElementById(groupId);
    if (group) group.remove();
}

function peOnProvinceChange(groupId) {
    const provinceSel = document.getElementById(`${groupId}_province`);
    const citySel = document.getElementById(`${groupId}_city`);
    if (!provinceSel || !citySel) return;

    const province = provinceSel.value;
    const cities = province ? getCitiesByProvince(province) : [];

    let options = '<option value="">全部城市</option>';
    cities.forEach(item => {
        options += `<option value="${item.cityCode}">${item.city}</option>`;
    });
    citySel.innerHTML = options;
}

function peSetMode(groupId, mode) {
    const container = document.getElementById(groupId);
    if (!container) return;
    const btns = container.querySelectorAll('.pe-mode-btn');
    let alreadyActive = false;
    btns.forEach(btn => {
        if (btn.dataset.mode === mode && btn.classList.contains('active')) {
            alreadyActive = true;
        }
    });
    if (alreadyActive) return; // 已经是该模式，不做任何变化
    btns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
}

// ===== SQL 生成 =====

function getAllGroups() {
    const container = document.getElementById('peGroupsContainer');
    if (!container) return [];
    const groups = container.querySelectorAll('[id^="pe_group_"]');
    const result = [];

    groups.forEach(group => {
        const groupId = group.id;
        const provinceSel = document.getElementById(`${groupId}_province`);
        const citySel = document.getElementById(`${groupId}_city`);
        const qtyInput = document.getElementById(`${groupId}_qty`);
        const modeBtn = group.querySelector('.pe-mode-btn.active');

        if (!provinceSel || !citySel || !qtyInput) return;
        const province = provinceSel.value;
        if (!province) return;

        const qty = parseInt(qtyInput.value) || 0;
        if (qty <= 0) return;

        const cityCode = citySel.value;
        const mode = modeBtn ? modeBtn.dataset.mode : 'include';

        if (cityCode) {
            // 选了具体城市
            result.push({ mode, province, cityCode, quantity: qty });
        } else {
            // 全部城市
            const cities = getCitiesByProvince(province);
            if (cities.length === 1) {
                // 直辖市等只有一个城市：自动带上城市编码
                result.push({ mode, province, cityCode: cities[0].cityCode, quantity: qty });
            } else {
                // 多城市省份：不加 city_code 过滤，总量限制
                result.push({ mode, province, cityCode: '', quantity: qty, allCities: true });
            }
        }
    });

    return result;
}

function getSelectedPhoneLevels() {
    const container = document.getElementById('pePhoneLevelGroup');
    if (!container) return [];
    const btns = container.querySelectorAll('.pe-level-btn.active');
    return Array.from(btns).map(btn => parseInt(btn.dataset.level));
}

function generateSql() {
    const telecomEl = document.querySelector('.pe-tab-btn.active');
    const telecom = telecomEl ? telecomEl.dataset.telecom : '';
    const selectedLevels = getSelectedPhoneLevels();
    const stockIdEl = document.getElementById('peStockId');
    const statusEl = document.getElementById('peStatus');
    const stockId = stockIdEl ? parseInt(stockIdEl.value) : 0;
    const status = statusEl ? parseInt(statusEl.value) : 0;
    const groups = getAllGroups();

    if (!telecom) {
        alert('请选择制式');
        return;
    }

    if (selectedLevels.length === 0) {
        alert('请至少选择一个号码等级');
        return;
    }

    if (groups.length === 0) {
        const existingGroups = document.querySelectorAll('#peGroupsContainer [id^="pe_group_"]');
        if (existingGroups.length > 0) {
            alert('请确保每个分组都已选择省份并填写数量');
        } else {
            alert('请至少添加一个分组，选择省份和城市并填写数量');
        }
        return;
    }

    let levelCondition = '';
    if (selectedLevels.length === 1) {
        levelCondition = `phone_level = ${selectedLevels[0]}`;
    } else {
        levelCondition = `phone_level in (${selectedLevels.join(', ')})`;
    }

    const baseWhere = `telecom = '${telecom}' and ${levelCondition} and stock_id = ${stockId} and status = ${status} and yn = 1`;
    const selects = [];

    groups.forEach(group => {
        if (group.allCities) {
            // 整个省份，不限制城市
            selects.push(`select * from ((select * from rs_phone_number where ${baseWhere} limit ${group.quantity}))`);
        } else if (group.mode === 'exclude') {
            // 排除模式：取该省份除该城市外的所有号码
            const allCities = getCitiesByProvince(group.province);
            const otherCodes = allCities.filter(c => c.cityCode !== group.cityCode).map(c => c.cityCode);
            if (otherCodes.length === 0) return;
            let cityCondition;
            if (otherCodes.length === 1) {
                cityCondition = `city_code = '${otherCodes[0]}'`;
            } else {
                cityCondition = `city_code in (${otherCodes.map(c => `'${c}'`).join(', ')})`;
            }
            selects.push(`select * from ((select * from rs_phone_number where ${baseWhere} and ${cityCondition} limit ${group.quantity}))`);
        } else {
            // 包含模式：取该城市的号码
            selects.push(`select * from ((select * from rs_phone_number where ${baseWhere} and city_code = '${group.cityCode}' limit ${group.quantity}))`);
        }
    });

    const finalSql = selects.join('\nunion all\n') + ';';
    document.getElementById('peSqlResult').value = finalSql;

    const summaryEl = document.getElementById('peResultSummary');
    if (summaryEl) {
        summaryEl.style.display = 'block';
        summaryEl.innerHTML = `共 <b>${groups.length}</b> 个分组，生成 <b>${selects.length}</b> 条 SELECT 语句（UNION ALL）。`;
    }
}

function peCopySql() {
    const sqlEl = document.getElementById('peSqlResult');
    if (!sqlEl || !sqlEl.value) {
        alert('没有生成的 SQL');
        return;
    }
    sqlEl.select();
    document.execCommand('copy');
    alert('已复制到剪贴板');
}

async function loadCityCodeData() {
    const container = document.getElementById('peGroupsContainer');
    if (container) {
        container.innerHTML = '<div style="color: #909399; font-size: 13px; padding: 15px; display: flex; align-items: center; gap: 8px;"><span style="display: inline-block; width: 14px; height: 14px; border: 2px solid #e4e7ed; border-top-color: #409eff; border-radius: 50%; animation: peSpin 0.8s linear infinite;"></span>正在加载城市数据...</div>';
    }
    try {
        const resp = await fetch('/docs/city_code.csv');
        const text = await resp.text();
        cityCodeData = parseCsv(text);
        provinceMap = buildProvinceMap(cityCodeData);
        if (container) container.innerHTML = '';
        peAddGroup();
        const provinceCount = Object.keys(provinceMap).length;
        const cityCount = cityCodeData.length;
        const infoEl = document.getElementById('peLoadInfo');
        if (infoEl) {
            infoEl.textContent = `已加载 ${provinceCount} 省 ${cityCount} 市`;
        }
    } catch (e) {
        console.error('加载city_code数据失败:', e);
        if (container) {
            container.innerHTML = '<div style="color: #f56c6c; font-size: 13px; padding: 15px;">加载 city_code 数据失败，请检查文件路径</div>';
        }
    }
}

const style = document.createElement('style');
style.textContent = `@keyframes peSpin { to { transform: rotate(360deg); } }`;
document.head.appendChild(style);

window.selectTelecom = selectTelecom;
window.togglePhoneLevel = togglePhoneLevel;
window.peAddGroup = peAddGroup;
window.peRemoveGroup = peRemoveGroup;
window.peOnProvinceChange = peOnProvinceChange;
window.peSetMode = peSetMode;
window.generateSql = generateSql;
window.peCopySql = peCopySql;

document.addEventListener('DOMContentLoaded', () => {
    renderPhoneLevel();
    loadCityCodeData();

    const generateBtn = document.getElementById('peGenerateBtn');
    if (generateBtn) {
        generateBtn.addEventListener('click', generateSql);
    }
});
