// ===== 导出功能 =====

function saveResultToFile() {
    const table = document.getElementById("resultTable");
    if (!table || table.style.display === "none") {
        alert("当前没有可保存的结果");
        return;
    }
    const thead = table.querySelector("thead");
    const tbody = table.querySelector("tbody");
    if (!thead || !tbody || tbody.rows.length === 0) {
        alert("当前没有可保存的数据");
        return;
    }
    const headers = Array.from(thead.querySelectorAll("th")).map(th => th.textContent.trim());
    const rows = Array.from(tbody.querySelectorAll("tr")).map(tr => {
        const obj = {};
        Array.from(tr.querySelectorAll("td")).forEach((td, i) => {
            obj[headers[i] || ("列" + i)] = td.textContent.trim();
        });
        return obj;
    });
    const now = new Date();
    const yyyymmdd = now.getFullYear() + String(now.getMonth() + 1).padStart(2, "0") + String(now.getDate()).padStart(2, "0");
    const hhmmss = String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0") + String(now.getSeconds()).padStart(2, "0");
    const fileName = "执行结果_" + yyyymmdd + "_" + hhmmss + ".json";
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    if (typeof addLog === "function") addLog("保存结果成功：" + fileName);
}

document.addEventListener("DOMContentLoaded", () => {
    // 通用下载 Excel 按钮
    const downloadBtn = document.getElementById("downloadExcelBtn");
    if (downloadBtn) {
        downloadBtn.addEventListener("click", () => {
            const table = document.getElementById("resultTable");
            if (!table || table.style.display === "none" || table.rows.length === 0) {
                alert("当前没有可导出的数据！");
                addLog("导出Excel失败：当前没有可导出的数据");
                return;
            }
            if (typeof XLSX === "undefined") {
                alert("导出失败：未加载Excel组件（XLSX）");
                addLog("导出Excel失败：XLSX 未定义");
                return;
            }
            const wb = XLSX.utils.table_to_book(table, { sheet: "执行结果" });
            const now = new Date();
            const yyyymmdd = now.getFullYear() + String(now.getMonth() + 1).padStart(2, "0") + String(now.getDate()).padStart(2, "0");
            const hhmmss = String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0") + String(now.getSeconds()).padStart(2, "0");
            const fileName = "执行结果_" + yyyymmdd + "_" + hhmmss + ".xlsx";
            XLSX.writeFile(wb, fileName);
            addLog("导出Excel成功：" + fileName);
        });
    }
});

function exportCancelAccountXLS() {
    const table = document.getElementById("resultTable");
    if (!table) return;
    const rows = table.querySelectorAll("tbody tr");
    if (!rows || rows.length === 0) { alert("没有数据可导出"); return; }
    const data = [];
    rows.forEach(r => {
        const cells = r.querySelectorAll("td");
        if (cells.length >= 3) {
            const phone = cells[0].textContent.trim();
            const canCancel = cells[2].textContent.trim() === "是";
            if (canCancel && phone) data.push({ phone, can_cancel: true });
        }
    });
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/cancel_account/export_xls";
    form.style.display = "none";
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "data_json";
    input.value = JSON.stringify({ data });
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
}
