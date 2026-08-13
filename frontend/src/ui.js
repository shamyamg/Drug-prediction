/* ==========================================================================
   PharmAI User Interface & Controller Logic
   ========================================================================== */

let activeTab = "analyze";
let xaiChartInstance = null;
let selectedFile = null;
let currentScreeningResults = null;

// Initialize on load
document.addEventListener("DOMContentLoaded", () => {
    MolViewer.initDrawer();
    checkBackendConnection();
    bindFileEvents();
    loadTargetsView();
});

/**
 * Tab switching controller.
 */
function switchTab(tabName) {
    activeTab = tabName;
    
    // Update menu button states
    document.querySelectorAll(".nav-item").forEach(btn => {
        btn.classList.remove("active");
    });
    document.getElementById(`tab-${tabName}`).classList.add("active");
    
    // Update view containers
    document.querySelectorAll(".content-view").forEach(view => {
        view.classList.remove("active");
    });
    document.getElementById(`view-${tabName}`).classList.add("active");
    
    // Update headers
    const title = document.getElementById("page-title");
    const desc = document.getElementById("page-description");
    
    if (tabName === "analyze") {
        title.innerText = "Molecule Analyzer";
        desc.innerText = "Predict biological activity and inspect molecular structure against target proteins.";
    } else if (tabName === "screen") {
        title.innerText = "Virtual Screening Portal";
        desc.innerText = "Run high-throughput machine learning screens against large chemical libraries.";
    } else if (tabName === "targets") {
        title.innerText = "Therapeutic Targets";
        desc.innerText = "Explore machine learning models trained on datasets from the ChEMBL database.";
        loadTargetsView();
    }
}

/**
 * Check backend API status and update the connection indicator.
 */
async function checkBackendConnection() {
    const dot = document.getElementById("api-status-dot");
    const text = document.getElementById("api-status-text");
    
    text.innerText = "Checking API...";
    
    const status = await ApiClient.checkStatus();
    
    if (status.online) {
        dot.className = "pulse-dot green";
        text.innerText = "API: Online";
        showToast(`Connected to backend (${status.url})`, "info");
    } else {
        dot.className = "pulse-dot red";
        text.innerText = "API: Offline (Click to configure)";
        showToast("Backend offline. Click status in sidebar to configure Render URL.", "warning");
    }
    return status;
}

/**
 * Open the Backend Server Settings modal.
 */
function openApiModal() {
    const modal = document.getElementById("api-modal");
    const input = document.getElementById("api-url-input");
    const statusDiv = document.getElementById("modal-test-status");
    
    input.value = ApiClient.getBaseUrl();
    statusDiv.className = "modal-test-status display-none";
    statusDiv.innerText = "";
    modal.classList.remove("display-none");
}

/**
 * Close the Backend Server Settings modal.
 */
function closeApiModal() {
    const modal = document.getElementById("api-modal");
    modal.classList.add("display-none");
}

/**
 * Quick preset URL setter.
 */
function setPresetUrl(url) {
    const input = document.getElementById("api-url-input");
    input.value = url;
}

/**
 * Test the API connection from inside the modal.
 */
async function testModalApiConnection() {
    const input = document.getElementById("api-url-input");
    const statusDiv = document.getElementById("modal-test-status");
    const testBtn = document.getElementById("btn-test-api");
    
    let targetUrl = input.value.trim().replace(/\/+$/, "");
    if (!targetUrl) {
        targetUrl = "http://127.0.0.1:8000";
    }
    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
        targetUrl = "https://" + targetUrl;
    }
    
    testBtn.disabled = true;
    testBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Testing...`;
    statusDiv.className = "modal-test-status testing";
    statusDiv.innerText = `Pinging ${targetUrl}... (If using free Render tier, wake-up can take up to 50s)`;
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000);
        
        const response = await fetch(`${targetUrl}/`, {
            method: "GET",
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const data = await response.json();
            statusDiv.className = "modal-test-status success";
            statusDiv.innerHTML = `<i class="fa-solid fa-circle-check"></i> Connected successfully! Service: ${data.service || "Online"}`;
        } else {
            statusDiv.className = "modal-test-status error";
            statusDiv.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Server replied with HTTP status ${response.status}.`;
        }
    } catch (e) {
        statusDiv.className = "modal-test-status error";
        statusDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Could not connect (${e.message || "Failed to fetch"}). Ensure the Render Web Service is running and CORS is enabled.`;
    } finally {
        testBtn.disabled = false;
        testBtn.innerHTML = `<i class="fa-solid fa-satellite-dish"></i> Test Connection`;
    }
}

/**
 * Save the entered API URL and reconnect.
 */
async function saveModalApiUrl() {
    const input = document.getElementById("api-url-input");
    const url = input.value.trim();
    
    ApiClient.setBaseUrl(url);
    closeApiModal();
    showToast("API URL saved. Reconnecting...", "info");
    
    await checkBackendConnection();
    await loadTargetsView();
}

/**
 * Single Compound Analysis execution.
 */
async function runAnalysis() {
    const smiles = document.getElementById("smiles-input").value.trim();
    const target = document.getElementById("target-select").value;
    
    if (!smiles) {
        showToast("Please enter a SMILES string first.", "warning");
        return;
    }
    
    const btn = document.getElementById("analyze-btn");
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Running Inference...`;
    
    try {
        const result = await ApiClient.predict(smiles, target);
        
        // Hide empty state, show results panel
        document.getElementById("result-empty-state").classList.add("display-none");
        const panel = document.getElementById("result-panel");
        panel.classList.remove("display-none");
        
        // Update basic headers
        document.getElementById("res-smiles-text").innerText = smiles;
        document.getElementById("res-smiles-text").title = smiles;
        
        const probActivePct = (result.probability_active * 100).toFixed(1);
        document.getElementById("res-probability").innerText = `${probActivePct}%`;
        
        const probBar = document.getElementById("res-probability-bar");
        probBar.style.width = `${probActivePct}%`;
        
        const badge = document.getElementById("res-activity-badge");
        if (result.is_active) {
            badge.innerText = "ACTIVE";
            badge.className = "active-badge active";
            probBar.className = "progress-bar-fill active-bg";
            document.getElementById("res-probability").className = "metric-value text-active";
        } else {
            badge.innerText = "INACTIVE";
            badge.className = "active-badge inactive";
            probBar.className = "progress-bar-fill inactive-bg";
            document.getElementById("res-probability").className = "metric-value text-inactive";
        }
        
        document.getElementById("res-action").innerText = result.recommended_action;
        
        // Update Lipinski parameters
        const desc = result.descriptors;
        updateLipinskiItem("lip-mw", `${desc.mw} g/mol`, desc.mw <= 500);
        updateLipinskiItem("lip-logp", desc.logp, desc.logp <= 5.0);
        updateLipinskiItem("lip-hbd", desc.hbd, desc.hbd <= 5);
        updateLipinskiItem("lip-hba", desc.hba, desc.hba <= 10);
        
        const summary = document.getElementById("res-lipinski-summary");
        if (desc.lipinski_pass) {
            summary.innerText = `Passes Lipinski's Rule of 5 (${desc.lipinski_violations} violations)`;
            summary.className = "lipinski-status";
        } else {
            summary.innerText = `Fails Lipinski's Rule of 5 (${desc.lipinski_violations} violations: ${desc.lipinski_violations_list.join(", ")})`;
            summary.className = "lipinski-status fail-status";
        }
        
        // Render 2D Canvas & 3D WebGL Model
        MolViewer.render2D(smiles);
        await MolViewer.render3D(smiles, result.descriptors.cid || null);
        
        // Build Explainable AI Chart
        buildXaiChart(result.feature_contributions);
        showToast("Analysis completed successfully!", "info");
    } catch (e) {
        showToast(e.message, "warning");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}

function updateLipinskiItem(id, valText, passBool) {
    const elem = document.getElementById(id);
    elem.querySelector(".lip-val").innerText = valText;
    if (passBool) {
        elem.className = "lipinski-item pass";
    } else {
        elem.className = "lipinski-item fail";
    }
}

/**
 * PubChem compound drug lookup by name.
 */
async function searchCompoundName() {
    const query = document.getElementById("compound-search").value.trim();
    if (!query) {
        showToast("Please enter a compound name.", "warning");
        return;
    }
    
    const btn = document.getElementById("search-btn");
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
    
    try {
        const result = await ApiClient.lookupCompound(query);
        
        document.getElementById("smiles-input").value = result.smiles;
        document.getElementById("res-compound-name").innerText = result.name.toUpperCase();
        
        showToast(`Resolved '${result.name}' successfully from PubChem`, "info");
        
        // Trigger predict automatically to improve UX
        runAnalysis();
    } catch (e) {
        showToast(e.message, "warning");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i>`;
    }
}

/**
 * Builds XAI feature impact chart using Chart.js.
 */
function buildXaiChart(contributions) {
    const ctx = document.getElementById("xai-chart").getContext("2d");
    
    if (xaiChartInstance) {
        xaiChartInstance.destroy();
    }
    
    if (!contributions || contributions.length === 0) {
        return;
    }
    
    const labels = contributions.map(c => `Fingerprint Bit #${c.bit_index}`);
    const values = contributions.map(c => c.contribution);
    const colors = values.map(v => v >= 0 ? "rgba(16, 185, 129, 0.75)" : "rgba(244, 63, 94, 0.75)");
    const borders = values.map(v => v >= 0 ? "#10b981" : "#f43f5e");
    
    xaiChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderColor: borders,
                borderWidth: 1.5,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', font: { size: 10 } },
                    title: { display: true, text: "Active Probability Shift", color: '#64748b', font: { size: 10 } }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { size: 10 } }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const val = context.raw;
                            return `Shift: ${val >= 0 ? '+' : ''}${(val * 100).toFixed(2)}% probability`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * File uploading and Drag & Drop handler bindings.
 */
function bindFileEvents() {
    const dropZone = document.getElementById("file-drop-zone");
    const uploader = document.getElementById("file-uploader");
    const textDisplay = document.getElementById("file-name-text");
    
    if (!dropZone) return;
    
    dropZone.addEventListener("click", () => uploader.click());
    
    uploader.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            handleSelectedFile(e.target.files[0]);
        }
    });
    
    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("dragover");
    });
    
    dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("dragover");
    });
    
    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("dragover");
        if (e.dataTransfer.files.length > 0) {
            handleSelectedFile(e.dataTransfer.files[0]);
        }
    });
}

function handleSelectedFile(file) {
    selectedFile = file;
    document.getElementById("file-name-text").innerText = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    showToast(`Loaded file: ${file.name}`, "info");
}

/**
 * Runs High-Throughput screening pipeline.
 */
async function runScreening() {
    const bulkText = document.getElementById("bulk-smiles").value.trim();
    const target = document.getElementById("screen-target-select").value;
    
    if (!bulkText && !selectedFile) {
        showToast("Please list SMILES in the textarea or upload a compound library file.", "warning");
        return;
    }
    
    const progressCard = document.getElementById("screening-progress-card");
    const progressBar = document.getElementById("screen-progress-bar");
    const progressText = document.getElementById("screen-progress-text");
    const btn = document.getElementById("screen-btn");
    
    progressCard.classList.remove("display-none");
    btn.disabled = true;
    
    let result = null;
    
    try {
        if (selectedFile) {
            // Screen via File upload endpoint
            progressText.innerText = "Uploading file and running predictions on server...";
            progressBar.style.width = "40%";
            
            result = await ApiClient.screenFile(selectedFile, target);
        } else {
            // Screen via direct SMILES list input
            const list = bulkText.split("\n").map(l => l.trim()).filter(l => l);
            progressText.innerText = `Submitting ${list.length} structures to backend...`;
            progressBar.style.width = "30%";
            
            result = await ApiClient.screen(list, target);
        }
        
        progressBar.style.width = "100%";
        progressText.innerText = `Successfully screened ${result.screened_count} molecules!`;
        
        currentScreeningResults = result;
        renderScreeningTable(result);
        
    } catch (e) {
        showToast(e.message, "warning");
        progressCard.classList.add("display-none");
    } finally {
        btn.disabled = false;
    }
}

function renderScreeningTable(data) {
    const tableBody = document.getElementById("screen-table-body");
    tableBody.innerHTML = "";
    
    document.getElementById("screening-results-card").classList.remove("display-none");
    
    if (data.results.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#64748b;">No valid compounds could be screened. Check SMILES formats.</td></tr>`;
        return;
    }
    
    data.results.forEach((row, idx) => {
        const tr = document.createElement("tr");
        const statusBadge = row.status === "Active" 
            ? `<span class="badge" style="background-color:var(--color-active-glow);color:var(--color-active);border:1px solid rgba(16,185,129,0.2)">Active</span>` 
            : `<span class="badge" style="background-color:var(--color-inactive-glow);color:var(--color-inactive);border:1px solid rgba(244,63,94,0.2)">Inactive</span>`;
            
        const probPct = (row.probability_active * 100).toFixed(1);
        
        tr.innerHTML = `
            <td><strong>#${idx + 1}</strong></td>
            <td><span class="table-smiles" title="${row.smiles}">${row.smiles}</span></td>
            <td>${row.mw}</td>
            <td>${row.logp}</td>
            <td>${row.synthetic_accessibility}</td>
            <td>${row.lipinski_violations}</td>
            <td><strong>${probPct}%</strong></td>
            <td>${statusBadge}</td>
            <td><button class="btn-table" onclick="loadScreenedIntoAnalyzer('${row.smiles}')">Analyze</button></td>
        `;
        tableBody.appendChild(tr);
    });
}

function loadScreenedIntoAnalyzer(smiles) {
    document.getElementById("smiles-input").value = smiles;
    document.getElementById("target-select").value = document.getElementById("screen-target-select").value;
    document.getElementById("compound-search").value = "";
    document.getElementById("res-compound-name").innerText = "SCREENED MOLECULE";
    switchTab("analyze");
    runAnalysis();
}

/**
 * CSV Hitlist Export.
 */
function exportCSV() {
    if (!currentScreeningResults || currentScreeningResults.results.length === 0) {
        showToast("No screening data available to export.", "warning");
        return;
    }
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Rank,SMILES,Molecular Weight,LogP,Synthetic Accessibility,Lipinski Violations,Active Probability,Prediction\n";
    
    currentScreeningResults.results.forEach((row, idx) => {
        const line = `${idx + 1},"${row.smiles}",${row.mw},${row.logp},${row.synthetic_accessibility},${row.lipinski_violations},${row.probability_active},${row.status}`;
        csvContent += line + "\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `PharmAI_VirtualScreening_Hitlist.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Downloaded screening results CSV", "info");
}

/**
 * Load Therapeutic Targets dynamically from Backend Models metadata.
 */
async function loadTargetsView() {
    const container = document.getElementById("targets-list-container");
    if (!container) return;
    
    try {
        const targets = await ApiClient.getTargets();
        container.innerHTML = "";
        
        targets.forEach(t => {
            const card = document.createElement("div");
            card.className = "target-card";
            
            // Build metrics
            let metricsHtml = "";
            if (t.metrics) {
                metricsHtml = `
                    <div class="target-stats-grid">
                        <div class="t-stat"><span class="t-val">${(t.metrics.accuracy * 100).toFixed(1)}%</span><span class="t-lbl">Accuracy</span></div>
                        <div class="t-stat"><span class="t-val">${(t.metrics.precision * 100).toFixed(1)}%</span><span class="t-lbl">Precision</span></div>
                        <div class="t-stat"><span class="t-val">${(t.metrics.recall * 100).toFixed(1)}%</span><span class="t-lbl">Recall</span></div>
                        <div class="t-stat"><span class="t-val">${t.dataset_size}</span><span class="t-lbl">Dataset Size</span></div>
                    </div>
                `;
            } else {
                metricsHtml = `
                    <div style="background-color:rgba(0,0,0,0.15);padding:14px;border-radius:var(--border-radius-sm);text-align:center;color:var(--text-muted);font-size:12px;">
                        <i class="fa-solid fa-triangle-exclamation"></i> Model trained offline but metrics unavailable.
                    </div>
                `;
            }
            
            card.innerHTML = `
                <div class="target-card-header">
                    <h3>${t.target_name}</h3>
                    <span class="target-id-badge">${t.chembl_id}</span>
                </div>
                <p>${t.description}</p>
                ${metricsHtml}
            `;
            container.appendChild(card);
        });
    } catch (e) {
        console.error("Error loading targets list:", e);
    }
}

/**
 * Toast notifications.
 */
function showToast(message, type = "info") {
    const toast = document.getElementById("toast");
    const msgSpan = document.getElementById("toast-message");
    
    msgSpan.innerText = message;
    
    if (type === "warning") {
        toast.style.borderLeftColor = "var(--color-inactive)";
        toast.querySelector(".toast-icon").className = "fa-solid fa-triangle-exclamation toast-icon";
        toast.querySelector(".toast-icon").style.color = "var(--color-inactive)";
    } else {
        toast.style.borderLeftColor = "var(--color-primary)";
        toast.querySelector(".toast-icon").className = "fa-solid fa-circle-info toast-icon";
        toast.querySelector(".toast-icon").style.color = "var(--color-primary)";
    }
    
    toast.classList.add("show");
    
    setTimeout(() => {
        toast.classList.remove("show");
    }, 4000);
}

window.switchTab = switchTab;
window.runAnalysis = runAnalysis;
window.searchCompoundName = searchCompoundName;
window.runScreening = runScreening;
window.exportCSV = exportCSV;
window.loadScreenedIntoAnalyzer = loadScreenedIntoAnalyzer;
window.openApiModal = openApiModal;
window.closeApiModal = closeApiModal;
window.setPresetUrl = setPresetUrl;
window.testModalApiConnection = testModalApiConnection;
window.saveModalApiUrl = saveModalApiUrl;
window.checkBackendConnection = checkBackendConnection;
