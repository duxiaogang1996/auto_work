// ===== 文件上传 =====
import { addLog, setStatus } from './utils.js';

document.addEventListener("DOMContentLoaded", () => {
    const uploadBtn = document.getElementById("uploadFileBtn");
    if (uploadBtn) {
        uploadBtn.addEventListener("click", () => {
            const input = document.getElementById("fileInput");
            if (input) input.click();
        });
    }

    const input = document.getElementById("fileInput");
    if (!input) return;

    input.addEventListener("change", function (e) {
        const file = e.target.files[0];
        if (!file) return;

        addLog("选择文件：" + file.name);
        document.getElementById("fileNameDisplay").textContent = file.name;
        const reader = new FileReader();

        reader.onload = function (evt) {
            const data = evt.target.result;
            let phones = [];

            if (file.name.toLowerCase().endsWith('.csv')) {
                const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
                const lines = text.split(/\r?\n/);
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;
                    const cols = line.split(',');
                    const phone = cols[0].replace(/['"]/g, '').trim();
                    if (phone) phones.push(phone);
                }
            } else {
                if (typeof XLSX === "undefined") {
                    setStatus("解析失败：未加载Excel组件（XLSX）", "error");
                    addLog("解析Excel失败：XLSX 未定义");
                    return;
                }
                const rawData = XLSX.utils.sheet_to_json(XLSX.read(data, { type: 'binary' }).Sheets[XLSX.read(data, { type: 'binary' }).SheetNames[0]]);
                rawData.forEach(row => {
                    const keys = Object.keys(row);
                    if (keys.length > 0) {
                        const phone = String(row[keys[0]]).trim();
                        if (phone) phones.push(phone);
                    }
                });
            }

            phones = [...new Set(phones)].filter(p => p.length >= 11);
            const phonesTextarea = document.getElementById("phones");
            const existing = phonesTextarea.value.trim();
            phonesTextarea.value = existing ? existing + '\n' + phones.join('\n') : phones.join('\n');

            setStatus("成功从文件中读取 " + phones.length + " 个手机号", "ok");
            addLog("文件解析完成，手机号数量：" + phones.length);
        };

        reader.readAsText(file);
        if (!file.name.toLowerCase().endsWith('.csv')) reader.readAsBinaryString(file);
        e.target.value = '';
    });
});
