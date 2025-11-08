// =============================
// SKYLINE LOGIC AIRDROP – MAIN
// =============================

// Backend URL
const API_BASE = "https://skyairdropbackend.onrender.com";

// Global state
let connectedWallet = null;
let userRisk = null;
let userTasks = null;
let wagmiClient = null;

// -----------------------------
// WAGMI + MetaMask Bağlantısı
// -----------------------------
async function connectWallet() {
    try {
        const accounts = await window.ethereum.request({
            method: "eth_requestAccounts",
        });
        connectedWallet = accounts[0];

        document.getElementById("walletAddress").innerText =
            connectedWallet.slice(0, 6) +
            "..." +
            connectedWallet.slice(-4);

        await preClaimStart();
    } catch (err) {
        console.error("Wallet connect error:", err);
        alert("Wallet bağlantısı reddedildi.");
    }
}

// -----------------------------
// 1) PRE-CLAIM (risk score + görev listesi)
// -----------------------------
async function preClaimStart() {
    try {
        const res = await fetch(`${API_BASE}/pre-claim`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wallet: connectedWallet }),
        });

        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Pre-claim hatası");

        userRisk = data.risk_score;
        userTasks = data.tasks;

        renderTasksUI(data.tasks);

        document.getElementById("stepStatus").innerText =
            "Hazır – Görevleri tamamlayabilirsiniz.";

    } catch (err) {
        console.error("/pre-claim error:", err);
        alert("Pre-claim yapılamadı.");
    }
}

// -----------------------------
// Görevlerin Arayüze Yazılması
// -----------------------------
function renderTasksUI(tasks) {
    const list = document.getElementById("taskList");
    list.innerHTML = "";

    tasks.forEach((t) => {
        const item = document.createElement("div");
        item.className = "taskItem";
        item.innerHTML = `
            <div class="taskName">${t.name}</div>
            <div class="taskCheck" id="task_${t.key}">
                ${t.completed ? "✅ Tamamlandı" : "⏳ Bekleniyor"}
            </div>
        `;
        list.appendChild(item);
    });
}

// -----------------------------
// X (Twitter) Doğrulama
// -----------------------------
async function verifyX() {
    const username = document.getElementById("xInput").value.trim();
    if (!username) return alert("X kullanıcı adı giriniz.");

    const res = await fetch(`${API_BASE}/verify-x`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            wallet: connectedWallet,
            username,
        }),
    });

    const data = await res.json();

    if (!data.ok) {
        alert(data.error || "X doğrulama hatası");
        return;
    }

    document.getElementById("task_x").innerText = "✅ Tamamlandı";
    alert("X doğrulaması başarılı.");
}

// -----------------------------
// Telegram Doğrulama
// -----------------------------
async function verifyTelegram() {
    const username = document.getElementById("tgInput").value.trim();
    if (!username) return alert("Telegram kullanıcı adı giriniz.");

    const res = await fetch(`${API_BASE}/verify-telegram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            wallet: connectedWallet,
            username,
        }),
    });

    const data = await res.json();

    if (!data.ok) {
        alert(data.error || "Telegram doğrulama hatası");
        return;
    }

    document.getElementById("task_telegram").innerText = "✅ Tamamlandı";
    alert("Telegram doğrulaması başarılı.");
}

// -----------------------------
// Instagram Doğrulama
// -----------------------------
async function verifyInstagram() {
    const username = document.getElementById("igInput").value.trim();
    if (!username) return alert("Instagram kullanıcı adı giriniz.");

    const res = await fetch(`${API_BASE}/verify-instagram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            wallet: connectedWallet,
            username,
        }),
    });

    const data = await res.json();

    if (!data.ok) {
        alert(data.error || "Instagram doğrulama hatası");
        return;
    }

    document.getElementById("task_instagram").innerText = "✅ Tamamlandı";
    alert("Instagram doğrulaması başarılı.");
}

// -----------------------------
// CLAIM – Token Talep Et
// -----------------------------
async function claimTokens() {
    try {
        const res = await fetch(`${API_BASE}/claim`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wallet: connectedWallet }),
        });

        const data = await res.json();
        if (!data.ok) {
            alert(data.error || "Claim hatası.");
            return;
        }

        alert("Başarılı! Claim işlemi tamamlandı.");
    } catch (err) {
        console.error("Claim error:", err);
        alert("Claim yapılamadı.");
    }
}
