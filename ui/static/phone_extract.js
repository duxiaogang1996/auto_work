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
        html += `
            <label style="display: flex; align-items: center; gap: 4px; font-size: 13px; cursor: pointer;">
                <input type="checkbox" value="${i}" ${i === 9 ? 'checked' : ''} style="width: auto; height: auto;">
                <span>${i}</span>
            </label>
        `;
    }
    container.innerHTML = html;
}

function getProvinces() {
    return Object.keys(provinceMap).sort();
}

function getCitiesByProvince(province) {
    if (!province || !provinceMap[province]) return [];
    return provinceMap[province].sort((a, b) => a.city.localeCompare(b.city));
}

function peAddGroup() {
    const container = document.getElementById('peGroupsContainer');
    if (!container) return;
    groupCounter++;
    const groupId = `pe_group_${groupCounter}`;
    const provinces = getProvinces();

    let provinceOptions = '<option value="">- 选择省份 -</option>';
    provinces.forEach(p => {
        provinceOptions += `<option value="${p}">${p}</option>`;
    });

    const html = `
        <div id="${groupId}" style="border: 1px solid #e4e7ed; border-radius: 6px; padding: 15px; margin-bottom: 15px; background: #fafafa;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span style="font-weight: bold;">分组 ${groupCounter}</span>
                <button onclick="peRemoveGroup('${groupId}')" style="padding: 4px 10px; background: #f56c6c; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">删除</button>
            </div>
            <div class="row" style="margin: 0;">
                <div class="col input-group">
                    <label>模式</label>
                    <select id="${groupId}_mode" onchange="peOnProvinceChange('${groupId}')" style="height: 36px; font-size: 14px;">
                        <option value="include">包含 - 仅取选中城市的号码</option>
                        <option value="exclude">排除 - 取除选中城市之外的号码</option>
                    </select>
                </div>
            </div>
            <div class="row" style="margin: 0;">
                <div class="col input-group">
                    <label>选择省份</label>
                    <select id="${groupId}_province" onchange="peOnProvinceChange('${groupId}')" style="height: 36px; font-size: 14px;">
                        ${provinceOptions}
                    </select>
                </div>
            </div>
            <div style="margin-bottom: 10px;">
                <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer;">
                    <input type="checkbox" id="${groupId}_allCities" onchange="peOnAllCitiesToggle('${groupId}')" style="width: auto; height: auto;">
                    <span>不限城市（取该省份全部城市，共用下方默认数量）</span>
                </label>
            </div>
            <div id="${groupId}_citySection" style="display: none; margin-top: 10px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <label style="display: flex; align-items: center; gap: 4px; font-size: 13px; cursor: pointer;">
                        <input type="checkbox" id="${groupId}_selectAll" onchange="peToggleAllCities('${groupId}')" style="width: auto; height: auto;">
                        <span>全选</span>
                    </label>
                    <span id="${groupId}_cityHint" style="font-size: 12px; color: #999;">勾选城市后，右侧输入框填写该城市的数量</span>
                </div>
                <div id="${groupId}_cityList" style="max-height: 200px; overflow-y: auto; border: 1px solid #e4e7ed; border-radius: 4px; padding: 8px; background: #fff;">
                    <div style="color: #999; font-size: 13px; text-align: center; padding: 20px;">请先选择省份</div>
                </div>
            </div>
            <div id="${groupId}_qtySection" style="display: none; margin: 12px 0 0 0;">
                <div class="row" style="margin: 0;">
                    <div class="col input-group" style="max-width: 200px;">
                        <label>默认数量</label>
                        <input type="number" id="${groupId}_defaultQty" min="1" value="100" style="height: 32px; font-size: 13px; width: 100%;">
                    </div>
                </div>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', html);
}

function peRemoveGroup(groupId) {
    const group = document.getElementById(groupId);
    if (group) {
        group.remove();
    }
}

function peOnAllCitiesToggle(groupId) {
    const cb = document.getElementById(`${groupId}_allCities`);
    const citySection = document.getElementById(`${groupId}_citySection`);
    const qtySection = document.getElementById(`${groupId}_qtySection`);
    if (!cb || !citySection) return;
    const showCityList = !cb.checked;
    citySection.style.display = showCityList ? 'block' : 'none';
    if (qtySection) {
        qtySection.style.display = cb.checked ? 'block' : 'none';
    }
}

function getGroupMode(groupId) {
    const modeSel = document.getElementById(`${groupId}_mode`);
    return modeSel ? modeSel.value : 'include';
}

function renderCityList(groupId) {
    const provinceSel = document.getElementById(`${groupId}_province`);
    const cityList = document.getElementById(`${groupId}_cityList`);
    const citySection = document.getElementById(`${groupId}_citySection`);
    const allCitiesCb = document.getElementById(`${groupId}_allCities`);
    const selectAll = document.getElementById(`${groupId}_selectAll`);
    const hintSpan = document.getElementById(`${groupId}_cityHint`);
    if (!provinceSel || !cityList || !citySection) return;

    if (selectAll) selectAll.checked = false;

    const province = provinceSel.value;
    if (!province) {
        cityList.innerHTML = '<div style="color: #999; font-size: 13px; text-align: center; padding: 20px;">请先选择省份</div>';
        return;
    }

    // 选择省份后自动显示城市区域（不限城市复选框未勾选时）
    if (!allCitiesCb || !allCitiesCb.checked) {
        citySection.style.display = 'block';
        const qtySection = document.getElementById(`${groupId}_qtySection`);
        if (qtySection) qtySection.style.display = 'none';
    }

    const mode = getGroupMode(groupId);
    const isInclude = mode === 'include';
    if (hintSpan) {
        hintSpan.textContent = isInclude ? '勾选城市后，右侧输入框填写该城市的数量' : '勾选要排除的城市';
    }
    const cities = getCitiesByProvince(province);
    let html = '';
    cities.forEach((item, idx) => {
        const isEven = idx % 2 === 0;
        html += `
            <label style="display: flex; align-items: center; gap: 6px; padding: 4px 8px; font-size: 13px; cursor: pointer; background: ${isEven ? '#fafafa' : '#fff'}; border-radius: 3px; margin-bottom: 2px;">
                <input type="checkbox" class="pe-city-cb" data-group="${groupId}" data-code="${item.cityCode}" onchange="peOnCityToggle('${groupId}')" style="width: auto; height: auto;">
                <span style="min-width: 80px;">${item.city}</span>
                ${isInclude ? `<input type="number" class="pe-city-qty" data-group="${groupId}" data-code="${item.cityCode}" min="1" value="100" style="width: 80px; height: 24px; font-size: 12px; padding: 0 4px; border: 1px solid #dcdfe6; border-radius: 3px; display: none;">` : ''}
            </label>
        `;
    });
    cityList.innerHTML = html;
}

function peOnProvinceChange(groupId) {
    renderCityList(groupId);
}

function peToggleAllCities(groupId) {
    const selectAll = document.getElementById(`${groupId}_selectAll`);
    const checked = selectAll ? selectAll.checked : false;
    const mode = getGroupMode(groupId);
    const cbs = document.querySelectorAll(`.pe-city-cb[data-group="${groupId}"]`);
    cbs.forEach(cb => {
        cb.checked = checked;
        if (mode !== 'include') return;
        const code = cb.getAttribute('data-code');
        const qtyInput = document.querySelector(`.pe-city-qty[data-group="${groupId}"][data-code="${code}"]`);
        if (qtyInput) {
            qtyInput.style.display = checked ? 'inline-block' : 'none';
        }
    });
}

function peOnCityToggle(groupId) {
    const cb = event.target;
    const code = cb.getAttribute('data-code');
    const mode = getGroupMode(groupId);
    if (mode === 'include') {
        const qtyInput = document.querySelector(`.pe-city-qty[data-group="${groupId}"][data-code="${code}"]`);
        if (qtyInput) {
            qtyInput.style.display = cb.checked ? 'inline-block' : 'none';
        }
    }

    // 更新全选框状态
    const allCbs = document.querySelectorAll(`.pe-city-cb[data-group="${groupId}"]`);
    const checkedCbs = document.querySelectorAll(`.pe-city-cb[data-group="${groupId}"]:checked`);
    const selectAll = document.getElementById(`${groupId}_selectAll`);
    if (selectAll && allCbs.length > 0) {
        selectAll.checked = allCbs.length === checkedCbs.length;
    }
}

function getAllGroups() {
    const container = document.getElementById('peGroupsContainer');
    if (!container) return [];
    const groups = container.querySelectorAll('[id^="pe_group_"]');
    const result = [];

    groups.forEach(group => {
        const groupId = group.id;
        const provinceSel = document.getElementById(`${groupId}_province`);
        const allCitiesCb = document.getElementById(`${groupId}_allCities`);
        const defaultQtyInput = document.getElementById(`${groupId}_defaultQty`);
        const modeSel = document.getElementById(`${groupId}_mode`);

        if (!provinceSel) return;

        const province = provinceSel.value;
        if (!province) return;

        const mode = modeSel ? modeSel.value : 'include';
        const allCities = allCitiesCb ? allCitiesCb.checked : false;

        if (allCities) {
            // 不限城市：取该省份全部城市，使用默认数量
            const defaultQty = defaultQtyInput && defaultQtyInput.value ? parseInt(defaultQtyInput.value) : 0;
            if (defaultQty <= 0) return;

            const cityCodes = getCitiesByProvince(province).map(c => c.cityCode);
            result.push({
                mode: mode,
                province: province,
                cityCodes: cityCodes,
                quantity: defaultQty,
                isPerCity: false
            });
        } else {
            // 限定具体城市
            const checkedCbs = document.querySelectorAll(`.pe-city-cb[data-group="${groupId}"]:checked`);
            if (checkedCbs.length === 0) return;

            if (mode === 'exclude') {
                // 排除模式：只需城市编码，不需要数量
                const cityCodes = Array.from(checkedCbs).map(cb => cb.getAttribute('data-code'));
                result.push({
                    mode: mode,
                    province: province,
                    cityCodes: cityCodes,
                    quantity: 0,
                    isPerCity: false
                });
            } else {
                // 包含模式：每个城市有自己的数量
                checkedCbs.forEach(cb => {
                    const cityCode = cb.getAttribute('data-code');
                    const qtyInput = document.querySelector(`.pe-city-qty[data-group="${groupId}"][data-code="${cityCode}"]`);
                    const quantity = qtyInput && qtyInput.value ? parseInt(qtyInput.value) : 0;
                    if (quantity <= 0) return;

                    result.push({
                        mode: mode,
                        province: province,
                        cityCodes: [cityCode],
                        quantity: quantity,
                        isPerCity: true
                    });
                });
            }
        }
    });

    return result;
}

function getSelectedPhoneLevels() {
    const container = document.getElementById('pePhoneLevelGroup');
    if (!container) return [];
    const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => parseInt(cb.value));
}

function generateSql() {
    const telecomEl = document.getElementById('peTelecom');
    const telecom = telecomEl ? telecomEl.value : '';
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
        alert('请至少添加一个采购分组，选择省份和城市并填写正确的数量');
        return;
    }

    let levelCondition = '';
    if (selectedLevels.length === 1) {
        levelCondition = `phone_level = ${selectedLevels[0]}`;
    } else {
        levelCondition = `phone_level in (${selectedLevels.join(', ')})`;
    }

    const selects = [];
    groups.forEach((group) => {
        let cityCondition = '';

        if (group.cityCodes.length === 1) {
            cityCondition = `city_code = '${group.cityCodes[0]}'`;
        } else {
            cityCondition = `city_code in (${group.cityCodes.map(c => `'${c}'`).join(', ')})`;
        }

        // 排除模式：将条件取反，不加 limit
        if (group.mode === 'exclude') {
            cityCondition = cityCondition.replace(/^city_code = /, 'city_code != ')
                .replace(/^city_code in /, 'city_code not in ');
            const sql = `select * from rs_phone_number where telecom = '${telecom}' and ${cityCondition} and ${levelCondition} and stock_id = ${stockId} and status = ${status} and yn = 1`;
            selects.push(sql);
        } else {
            const sql = `select * from rs_phone_number where telecom = '${telecom}' and ${cityCondition} and ${levelCondition} and stock_id = ${stockId} and status = ${status} and yn = 1 limit ${group.quantity}`;
            selects.push(sql);
        }
    });

    const wrappedSelects = selects.map(s => `(${s})`);
    const finalSql = wrappedSelects.join('\nunion all\n') + ';';
    document.getElementById('peSqlResult').value = finalSql;
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

function peCopySqlToDbExecute() {
    const sql = document.getElementById('peSqlResult').value;
    if (!sql) {
        alert('没有生成的 SQL');
        return;
    }
    const dbSqlInput = document.getElementById('dbSqlInput');
    if (dbSqlInput) {
        dbSqlInput.value = sql;
    }
    if (typeof switchTab === 'function') {
        navigator.clipboard.writeText(sql).then(() => alert('已复制到剪贴板'));
    }
}

async function loadCityCodeData() {
    try {
        const resp = await fetch('/docs/city_code.csv');
        const text = await resp.text();
        cityCodeData = parseCsv(text);
        provinceMap = buildProvinceMap(cityCodeData);
        peAddGroup();
    } catch (e) {
        console.error('加载city_code数据失败:', e);
        const container = document.getElementById('peGroupsContainer');
        if (container) {
            container.innerHTML = '<div style="color: #f56c6c; font-size: 13px; padding: 10px;">加载city_code数据失败，请检查文件路径</div>';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    renderPhoneLevel();
    loadCityCodeData();

    const generateBtn = document.getElementById('peGenerateBtn');
    if (generateBtn) {
        generateBtn.addEventListener('click', generateSql);
    }
});
