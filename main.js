/* ==========================
   Skyline Logic Airdrop v1.0 (Stabil + Hardened + UX Upgrades)
   ========================== */

// ---------- Config ----------
const DEV_MODE = false; // true yaparsan console loglar açılır.

// Your Node.js server URL (Render)
const NODE_SERVER_URL = "https://skyairdropbackend.onrender.com"; 

// X Tweet ID (geçici)
const AIRDROP_TWEET_ID = "1983278116723392817";

// Social links (tek yerden yönetim) + intent URL’leri
const SOCIAL_URLS = {
  x: "https://x.com/SkylineLogicAI",
  xFollowIntent: "https://twitter.com/intent/user?screen_name=SkylineLogicAI",
  xRetweetIntent: `https://twitter.com/intent/retweet?tweet_id=${AIRDROP_TWEET_ID}`,
  telegram: "https://t.me/skylinelogic",
  telegramDeep: "tg://resolve?domain=skylinelogic",
  instagram: "https://www.instagram.com/skyline.logic",
};

// Contracts
const AIRDROP_CONTRACT = "0x316549D421e454e08040efd8b7d331C7e5946724";
const TOKEN_CONTRACT   = "0xa7c4436c2Cf6007Dd03c3067697553bd51562f2c";

// Network (BNB Smart Chain)
const REQUIRED_CHAIN_ID = '0x38'; // 56 (BNB Mainnet)
const BNB_CHAIN_PARAMS = {
  chainId: '0x38',
  chainName: 'BNB Smart Chain',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: ['https://bsc-dataseed.binance.org/'],
  blockExplorerUrls: ['https://bscscan.com']
};

// Airdrop ABI
const AIRDROP_ABI = [
  {"inputs":[{"internalType":"address","name":"_token","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"wallet","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"AirdropClaimed","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"WithdrawRemaining","type":"event"},
  {"inputs":[],"name":"amountPerWallet","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"claimed","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"claimAirdrop","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"newAmount","type":"uint256"}],"name":"setAmountPerWallet","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"token","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"withdrawRemainingTokens","outputs":[],"stateMutability":"nonpayable","type":"function"}
];

// ---------- State ----------
let provider, signer, airdrop, userWallet = null;

/* ------------------ Utils ------------------ */
// Fetch with timeout
async function fetchWithTimeout(resource, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(resource, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}
function log(...args) { if (DEV_MODE) console.log(...args); }

// küçük yardımcılar
function $(sel){ return document.querySelector(sel); }
function $all(sel){ return document.querySelectorAll(sel); }

/* ------------------ Task List ------------------ */
const TASKS = [
  { id: "x",         label: "Follow our X account & retweet the airdrop post", btnText: "Verify" },
  { id: "telegram",  label: "Join our Telegram channel",                        btnText: "Join"   },
  { id: "instagram", label: "Follow our Instagram and repost the airdrop post", btnText: "Follow" }
];
let completedTasks = [];

/* ------------------ UX Widgets (dinamik eklenir) ------------------ */
function ensureUXWidgets() {
  // Progress bar
  if (!$("#task-progress")) {
    const req = document.querySelector(".requirements");
    if (req) {
      const box = document.createElement("div");
      box.id = "task-progress";
      box.style.cssText = "margin:14px 0 6px; background:#0b1228; border:1px solid #24335e; border-radius:10px; padding:10px;";
      box.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="color:#9fb7ff;font-size:14px;">Your Progress</span>
          <span id="task-progress-text" style="color:#cfe1ff;font-size:13px;">0 / ${TASKS.length} tasks</span>
        </div>
        <div style="width:100%;height:10px;background:#111a3a;border-radius:8px;overflow:hidden;">
          <div id="task-progress-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#4a67ff,#8338ec);transition:width .25s;"></div>
        </div>
      `;
      req.prepend(box);
    }
  }

  // Participants/Remaining sayaç kutusu
  if (!$("#participants-box")) {
    const cc = document.querySelector(".countdown-container");
    if (cc) {
      const div = document.createElement("div");
      div.id = "participants-box";
      div.style.cssText = "margin-top:10px;color:#cfe1ff;font-size:13px;opacity:.95;";
      div.innerHTML = `
        <div id="participants-line" style="margin-top:4px;">Participants: -- / 5,000 • Remaining: --</div>
      `;
      cc.appendChild(div);
    }
  }
}

function updateProgressBar() {
  const done = TASKS.filter(t => completedTasks.includes(t.id)).length;
  const total = TASKS.length;
  const pct = Math.round((done/total)*100);
  const txt = $("#task-progress-text");
  const bar = $("#task-progress-bar");
  if (txt) txt.textContent = `${done} / ${total} tasks`;
  if (bar) bar.style.width = `${pct}%`;
}

async function refreshParticipantsCounter() {
  // Leaderboard uzunluğu = katılan kullanıcı tahmini (claim değil). Backendten gerçek claim sayacı yoksa bu yaklaşım.
  try {
    const res = await fetchWithTimeout(`${NODE_SERVER_URL}/get-leaderboard`);
    if (!res.ok) throw new Error("Leaderboard fetch failed");
    const leaders = await res.json();
    const count = Array.isArray(leaders) ? leaders.length : 0;
    const max = 5000;
    const remaining = Math.max(0, max - count);
    const line = $("#participants-line");
    if (line) line.textContent = `Participants: ${count.toLocaleString()} / ${max.toLocaleString()} • Remaining: ${remaining.toLocaleString()}`;
  } catch(e){
    log("participants refresh error", e);
  }
}

function adjustPoolCopyTo500M() {
  // “Airdrop Pool” satırını bulup 500,000,000 $SKYL yap
  const stats = document.querySelectorAll(".airdrop-stats .stat-item .stat-title");
  stats.forEach((titleEl) => {
    if (titleEl.textContent.trim().toLowerCase() === "airdrop pool") {
      const valueEl = titleEl.parentElement?.querySelector(".stat-value");
      if (valueEl) valueEl.textContent = "500,000,000 $SKYL";
    }
  });
}

/* ------------------ Ağ Kontrol ------------------ */
async function checkAndSwitchNetwork() {
  if (!window.ethereum) return false;
  try {
    const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (currentChainId === REQUIRED_CHAIN_ID) return true;

    showBanner("Please switch to BNB Smart Chain", "red");
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: REQUIRED_CHAIN_ID }] });
    return true;
  } catch (switchError) {
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [BNB_CHAIN_PARAMS] });
        return true;
      } catch (addError) {
        console.error("Failed to add BNB chain:", addError);
        return false;
      }
    }
    console.error("Failed to switch network:", switchError);
    return false;
  }
}

/* ------------------ Wallet Connection ------------------ */
async function connectWallet() {
  try {
    if (!window.ethereum) {
      showModal("Please install MetaMask or open this page in a Web3-enabled browser.");
      return;
    }
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    userWallet = (await signer.getAddress()).toLowerCase();

    const networkOK = await checkAndSwitchNetwork();
    if (!networkOK) showBanner("Please connect to BNB Smart Chain to continue.", "red");
    
    // UI Update
    const connectBtnEl = document.querySelector(".wallet-actions .btn");
    if (connectBtnEl) connectBtnEl.style.display = "none";
    $("#statusMsg").textContent = "Network: Connected";
    showBanner("✅ Wallet connected", "green");
    updateProfilePanel(userWallet);

    await loadUserTasks();
  } catch (err) {
    console.error("Wallet connection failed:", err);
    showBanner("⚠️ Wallet connection failed", "red");
  }
}

function disconnectWallet() {
  provider = signer = airdrop = null;
  userWallet = null;
  location.reload();
}

/* ------------------ Task Management ------------------ */
async function loadUserTasks() {
  if (!userWallet) return;
  try {
    const res = await fetchWithTimeout(`${NODE_SERVER_URL}/get-tasks?wallet=${userWallet}`);
    if (!res.ok) throw new Error(`Server error: ${res.statusText}`);
    const data = await res.json();
    completedTasks = data.tasks || [];
    updateTaskUI();
    checkAllTasksCompleted();
    updateProgressBar();
  } catch (err) {
    console.warn("⚠️ loadUserTasks failed (Node.js):", err);
  }
}

async function saveTaskToDB(taskId, btn) {
  try {
    const updatedTasks = [...completedTasks, taskId];
    const res = await fetchWithTimeout(`${NODE_SERVER_URL}/save-tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: userWallet, tasks: updatedTasks })
    });
    const result = await res.json();

    if (result.success) {
      completedTasks = updatedTasks;
      btn.innerText = "Completed ✅";
      btn.style.background = "linear-gradient(90deg,#00ff99,#00cc66)";
      btn.disabled = true;
      showBanner(`✅ ${taskId.toUpperCase()} verified`, "green");
      checkAllTasksCompleted();
      updateProgressBar();
      // sayaç güncelle
      refreshParticipantsCounter();
    } else {
      throw new Error(result.message || "Unknown Node.js save error");
    }
  } catch (err) {
    console.error("Node.js Save error:", err);
    const task = TASKS.find(t => t.id === taskId);
    btn.innerText = task ? task.btnText : "Verify";
    btn.disabled = false;
    showBanner("⚠️ Task could not be saved (Node.js): " + err.message, "red");
  }
}

async function verifyTask(taskId) {
  if (!userWallet) {
    showBanner("⚠️ Connect your wallet first", "red");
    return;
  }
  const btnId = `verify-${taskId}`;
  const btn = document.getElementById(btnId);
  if (!btn) { console.warn(`❌ Button not found: ${btnId}`); return; }
  const task = TASKS.find(t => t.id === taskId);

  if (completedTasks.includes(taskId)) {
    showModal("This task is already completed ✅");
    return;
  }

  // Ortak: ilgili sosyal sayfayı/intent'i aç
  if (taskId === 'x') {
    // önce follow intent ve airdrop retweet intent’i açalım (kullanıcıya kolaylık)
    window.open(SOCIAL_URLS.xFollowIntent, '_blank');
    window.open(SOCIAL_URLS.xRetweetIntent, '_blank');
    // profil linki de dursun
    window.open(SOCIAL_URLS.x, '_blank');
  } else if (taskId === 'telegram') {
    // deep link dene, olmazsa web link
    try { window.open(SOCIAL_URLS.telegramDeep, '_blank'); } catch {}
    window.open(SOCIAL_URLS.telegram, '_blank');
  } else if (taskId === 'instagram') {
    window.open(SOCIAL_URLS.instagram, '_blank');
  }

  btn.innerText = "Verifying...";
  btn.disabled = true;

  // X doğrulaması (API)
  if (taskId === 'x') {
    try {
      const username = prompt("Please enter your X (Twitter) username (without the @):");
      if (!username) {
        btn.innerText = task ? task.btnText : "Verify";
        btn.disabled = false;
        return; 
      }
      btn.innerText = "Checking X...";

      const apiRes = await fetchWithTimeout(`${NODE_SERVER_URL}/verify-x`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() })
      });

      const apiData = await apiRes.json();
      if (!apiRes.ok) {
        const msg = apiData.message || apiData.error || 'X verification failed';
        throw new Error(msg);
      }

      btn.innerText = "Saving...";
      await saveTaskToDB(taskId, btn);

    } catch (err) {
      console.error("X Verification error:", err);
      btn.innerText = task ? task.btnText : "Verify";
      btn.disabled = false;
      showBanner("❌ X Verification Failed: " + (err.message || "Network error"), "red");
    }
  } 
  // Diğer görevler (güvene dayalı)
  else {
    btn.innerText = "Saving...";
    await saveTaskToDB(taskId, btn);
  }
}

/* ------------------ UI Updates ------------------ */
function updateTaskUI() {
  TASKS.forEach((task) => {
    const btn = document.getElementById(`verify-${task.id}`);
    if (!btn) return;
    if (completedTasks.includes(task.id)) {
      btn.innerText = "Completed ✅";
      btn.disabled = true;
      btn.style.background = "linear-gradient(90deg,#00ff99,#00cc66)";
    } else {
      btn.innerText = task.btnText;
      btn.disabled = false;
      btn.style.background = "linear-gradient(90deg,#4a67ff,#8338ec)";
    }
  });
}

function checkAllTasksCompleted() {
  const claimBtn = document.getElementById("claimTopBtn");
  const claimNowBtn = document.getElementById("claimNowBtn");
  if (!claimBtn || !claimNowBtn) return false;

  const all = TASKS.every((t) => completedTasks.includes(t.id));
  const buttons = [claimBtn, claimNowBtn];

  if (all) {
    buttons.forEach(btn => { btn.disabled = false; btn.textContent = "🚀 Claim $SKYL"; });
    document.getElementById("airdropStatus").textContent = "All tasks completed! You are eligible to claim.";
    showBanner("🎯 All tasks completed! You can claim now.", "green");
    return true;
  } else {
    buttons.forEach(btn => { btn.disabled = true; btn.textContent = "Complete Tasks to Claim"; });
    document.getElementById("airdropStatus").textContent = "Complete all tasks to become eligible.";
    return false;
  }
}

/* ------------------ Claim Process (GERÇEK İŞLEM) ------------------ */
async function claimTokens() {
  if (!userWallet || !signer) { showBanner("⚠️ Connect your wallet first", "red"); return; }
  if (!checkAllTasksCompleted()) { showBanner("⚠️ Complete all tasks before claiming.", "red"); return; }

  const networkOK = await checkAndSwitchNetwork();
  if (!networkOK) { showBanner("Please switch to BNB Smart Chain to claim.", "red"); return; }

  const buttons = [ document.getElementById("claimTopBtn"), document.getElementById("claimNowBtn") ];

  try {
    const airdropContract = new ethers.Contract(AIRDROP_CONTRACT, AIRDROP_ABI, signer);

    // ✅ Ön kontrol: already claimed?
    try {
      const already = await airdropContract.claimed(userWallet);
      if (already) { showBanner("⚠️ You have already claimed this airdrop.", "red"); return; }
    } catch (e) { log("claimed() precheck fail (non-fatal):", e); }

    buttons.forEach(btn => { if (btn) { btn.disabled = true; btn.innerText = "Waiting for signature..."; } });

    const tx = await airdropContract.claimAirdrop();

    buttons.forEach(btn => { if (btn) btn.innerText = "Transaction pending..."; });
    showBanner("Transaction submitted! Waiting for confirmation...", "green");

    await tx.wait();

    document.getElementById("claimSuccessPopup").style.display = "flex";
    buttons.forEach(btn => {
      if (btn) {
        btn.disabled = true;
        btn.innerText = "✅ Claimed";
        btn.style.background = "linear-gradient(90deg,#00ff99,#00cc66)";
      }
    });

    // başarı sonrası sayaç güncelle
    refreshParticipantsCounter();

  } catch (err) {
    console.error("❌ Claim error:", err);
    let errorMessage = "❌ Claim failed. Please try again.";
    if (err.code === 'ACTION_REJECTED') errorMessage = "⚠️ Transaction was rejected.";
    else if (err?.data?.message?.includes("Already claimed") || err?.message?.includes("Already claimed"))
      errorMessage = "⚠️ You have already claimed this airdrop.";
    else if (err?.data?.message?.includes("Insufficient airdrop balance"))
      errorMessage = "❌ Airdrop pool is empty. Please contact support.";

    showBanner(errorMessage, "red");
    buttons.forEach(btn => { if (btn) { btn.disabled = false; btn.innerText = "🚀 Claim $SKYL"; } });
  }
}

/* ------------------ Helper Functions ------------------ */
function updateProfilePanel(addr) {
  const panel = document.getElementById("profile-panel");
  if (!panel) return;
  if (addr) {
    panel.style.display = "block";
    panel.querySelector("p").textContent = "Wallet: " + addr.slice(0, 6) + "..." + addr.slice(-4);
  } else {
    panel.style.display = "none";
  }
}

function showModal(message) {
  const overlay = document.getElementById("modalOverlay");
  if (!overlay) return;
  overlay.innerHTML = `
    <div class="modal-box">
      <p>${message}</p>
      <button class="btn" onclick="closeModal()">OK</button>
    </div>`;
  overlay.style.display = "flex";
}

function closeModal() {
  const overlay = document.getElementById("modalOverlay");
  if (overlay) overlay.style.display = "none";
}

function showBanner(msg, color = "red") {
  const b = document.getElementById("topBanner");
  b.textContent = msg;
  b.style.background =
    color === "green"
      ? "linear-gradient(90deg, rgba(0,200,100,.9), rgba(0,150,50,.9))"
      : "linear-gradient(90deg, rgba(255,0,0,.9), rgba(255,100,0,.9))";
  b.classList.add("show");
  setTimeout(() => b.classList.remove("show"), 3000);
}

// Leaderboard
async function loadLeaderboard() {
  const container = document.getElementById("leaderboard-body");
  if (!container) return;

  try {
    const res = await fetchWithTimeout(`${NODE_SERVER_URL}/get-leaderboard`); 
    if (!res.ok) throw new Error("Could not load leaderboard data.");

    const leaders = await res.json(); 
    container.innerHTML = ""; 

    if (!leaders || leaders.length === 0) {
      container.innerHTML = `<p class="leaderboard-loading">No participants yet. Be the first!</p>`;
      return;
    }

    leaders.sort((a,b) => (b.points||0) - (a.points||0));
    const medals = ['🏆', '🥈', '🥉'];
    leaders.forEach((leader, index) => {
      const row = document.createElement("div");
      row.className = "leaderboard-row";
      const shortWallet = leader.wallet.slice(0, 6) + "..." + leader.wallet.slice(-4);
      row.innerHTML = `
        <span>${medals[index] || (index + 1)}</span>
        <span>${shortWallet}</span>
        <span>${leader.points}</span>`;
      container.appendChild(row);
    });

  } catch (err) {
    console.error("Leaderboard load failed:", err);
    container.innerHTML = `<p class="leaderboard-loading" style="color:red;">Error loading leaderboard.</p>`;
  }
}

/* ------------------ Init ------------------ */
document.addEventListener("DOMContentLoaded", () => {
  // UX widget’ları kur
  ensureUXWidgets();
  adjustPoolCopyTo500M();
  refreshParticipantsCounter();
  setInterval(refreshParticipantsCounter, 30000); // 30sn’de bir güncelle

  // Event Listeners
  const connectBtn = document.querySelector(".wallet-actions .btn");
  const disconnectBtn = document.getElementById("disconnectWalletBtn");
  const claimTopBtn = document.getElementById("claimTopBtn");
  const claimNowBtn = document.getElementById("claimNowBtn");
  const closePopupBtn = document.getElementById("closePopup");

  // Verify Buttons
  const verifyXBtn = document.getElementById("verify-x");
  const verifyTelegramBtn = document.getElementById("verify-telegram");
  const verifyInstagramBtn = document.getElementById("verify-instagram");

  if (!verifyXBtn) console.warn("❌ verify-x button NOT FOUND");
  if (!verifyTelegramBtn) console.warn("❌ verify-telegram button NOT FOUND");
  if (!verifyInstagramBtn) console.warn("❌ verify-instagram button NOT FOUND");
  
  if (connectBtn) connectBtn.addEventListener("click", connectWallet);
  if (disconnectBtn) disconnectBtn.addEventListener("click", disconnectWallet);
  if (claimTopBtn) claimTopBtn.addEventListener("click", claimTokens);
  if (claimNowBtn) claimNowBtn.addEventListener("click", claimTokens);
  
  if (verifyXBtn) verifyXBtn.addEventListener("click", () => verifyTask('x'));
  if (verifyTelegramBtn) verifyTelegramBtn.addEventListener("click", () => verifyTask('telegram'));
  if (verifyInstagramBtn) verifyInstagramBtn.addEventListener("click", () => verifyTask('instagram'));

  if (closePopupBtn) {
    closePopupBtn.addEventListener("click", () => {
      document.getElementById("claimSuccessPopup").style.display = "none";
    });
  }

  // Navigation
  const navItems = document.querySelectorAll(".nav-item");
  const sections = document.querySelectorAll(".section");

  navItems.forEach(item => {
    item.addEventListener("click", () => {
      const targetId = item.getAttribute("data-target");
      navItems.forEach(i => i.classList.remove("active"));
      item.classList.add("active");
      sections.forEach(s => { s.classList.remove("active"); if (s.id === targetId) s.classList.add("active"); });
      if (targetId === 'leaderboard') loadLeaderboard();
    });
  });

  updateTaskUI();
  checkAllTasksCompleted();
  updateProgressBar();
  startCountdown();
});

/* ------------------ Countdown Function ------------------ */
function startCountdown() {
  const countDownDate = new Date("2025-12-31T23:59:59Z").getTime(); 
  const countdownElement = document.getElementById("countdown");
  const claimBtn = document.getElementById("claimTopBtn");
  const claimNowBtn = document.getElementById("claimNowBtn");
  if (!countdownElement) return;

  const interval = setInterval(() => {
    const now = new Date().getTime();
    const distance = countDownDate - now;

    if (distance < 0) {
      clearInterval(interval);
      countdownElement.innerHTML = "Airdrop Ended";
      [claimBtn, claimNowBtn].forEach(btn => { if (btn) { btn.disabled = true; btn.textContent = "Airdrop Ended"; } });
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    countdownElement.innerHTML =
      days + "d " +
      hours.toString().padStart(2, "0") + "h " + 
      minutes.toString().padStart(2, "0") + "m " +
      seconds.toString().padStart(2, "0") + "s ";
  }, 1000);
}
