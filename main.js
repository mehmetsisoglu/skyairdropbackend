/* ==========================
   Skyline Logic Airdrop v1.0 (Stabil + Hardened + UX Upgrades)
   ========================== */

// ---------- Config ----------
const DEV_MODE = false;

// Backend (Render)
const NODE_SERVER_URL = "https://skyairdropbackend.onrender.com";

// X Tweet ID
const AIRDROP_TWEET_ID = "1983278116723392817";

// Social links + intents
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
const REQUIRED_CHAIN_ID = '0x38';
const BNB_CHAIN_PARAMS = {
  chainId: '0x38',
  chainName: 'BNB Smart Chain',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: ['https://bsc-dataseed.binance.org/'],
  blockExplorerUrls: ['https://bscscan.com']
};

// Airdrop Contract ABI
const AIRDROP_ABI_DATA = [
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
let provider, signer, userWallet = null;
let completedTasks = [];

/* ------------------ Utils ------------------ */
function log(...args){ if (DEV_MODE) console.log(...args); }
function $(s){ return document.querySelector(s); }
function $all(s){ return document.querySelectorAll(s); }

async function fetchWithTimeout(resource, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(resource, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (e) { clearTimeout(id); throw e; }
}

function showBanner(msg,color){
  const b=$("#topBanner");
  if (!b) return;
  b.textContent=msg;
  b.style.background = color==="green"
    ? "linear-gradient(90deg, rgba(0,200,100,.9), rgba(0,150,50,.9))"
    : "linear-gradient(90deg, rgba(255,0,0,.9), rgba(255,100,0,.9))";
  b.classList.add("show");
  setTimeout(()=>b.classList.remove("show"),3000);
}

function showModal(msg) {
  const o = $("#modalOverlay");
  if (!o) return;
  o.innerHTML = `<div class="modal-box"><p>${msg}</p><button class="btn" onclick="closeModal()">OK</button></div>`;
  o.style.display = "flex";
}
function closeModal(){ const o=$("#modalOverlay"); if (o) o.style.display="none"; }

/* ------------------ Task List ------------------ */
const TASKS = [
  { id:"x", label:"Follow X & Retweet Post", btnText:"Verify" },
  { id:"telegram", label:"Join our Telegram channel", btnText:"Join" },
  { id:"instagram", label:"Follow our Instagram", btnText:"Follow" }
];

/* ------------------ UX Widgets ------------------ */
function ensureUXWidgets() {
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

  if (!$("#participants-box")) {
    const cc = document.querySelector(".countdown-container");
    if (cc) {
      const div = document.createElement("div");
      div.id = "participants-box";
      div.style.cssText = "margin-top:10px;color:#cfe1ff;font-size:13px;opacity:.95;";
      div.innerHTML = `<div id="participants-line" style="margin-top:4px;">Participants: -- / 5,000 • Remaining: --</div>`;
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

/* ------------------ Participants Counter (LOCAL) ------------------ */
function refreshParticipantsCounter() {
  const participants = Math.floor(Math.random() * 3000) + 500; // geçici sahte sayaç
  const remaining = 5000 - participants;

  const line = $("#participants-line");
  if (line)
    line.textContent = `Participants: ${participants.toLocaleString()} / 5,000 • Remaining: ${remaining.toLocaleString()}`;
}

/* ------------------ Pool Fix ------------------ */
function adjustPoolCopyTo500M() {
  const stats = document.querySelectorAll(".airdrop-stats .stat-item .stat-title");
  stats.forEach(t => {
    if (t.textContent.trim().toLowerCase() === "airdrop pool") {
      const val = t.parentElement.querySelector(".stat-value");
      if (val) val.textContent = "500,000,000 $SKYL";
    }
  });
}

/* ------------------ Network ------------------ */
async function checkAndSwitchNetwork() {
  if (!window.ethereum) return false;
  try {
    const cid = await window.ethereum.request({ method:'eth_chainId' });
    if (cid === REQUIRED_CHAIN_ID) return true;

    showBanner("Switch to BNB Smart Chain", "red");
    await window.ethereum.request({
      method:'wallet_switchEthereumChain',
      params:[{ chainId:REQUIRED_CHAIN_ID }]
    });
    return true;

  } catch(e){
    if (e.code === 4902) {
      await window.ethereum.request({
        method:'wallet_addEthereumChain',
        params:[BNB_CHAIN_PARAMS]
      });
      return true;
    }
    return false;
  }
}

/* ------------------ Wallet ------------------ */
async function connectWallet() {
  try {
    if (!window.ethereum) return showModal("Please install MetaMask or open in a Web3 browser.");

    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    userWallet = (await signer.getAddress()).toLowerCase();

    await checkAndSwitchNetwork();

    const connectBtn = document.querySelector(".wallet-actions .btn");
    if (connectBtn) connectBtn.style.display = "none";
    $("#statusMsg").textContent = "Network: Connected";
    updateProfilePanel(userWallet);

    await loadUserTasks();
  } catch(e){
    showBanner("Wallet connection failed","red");
  }
}

function updateProfilePanel(addr) {
  const p = $("#profile-panel");
  if (!p) return;
  p.style.display = "block";
  p.querySelector("p").textContent = "Wallet: " + addr.slice(0,6)+"..."+addr.slice(-4);
}

/* ------------------ Tasks: Load/Save ------------------ */
async function loadUserTasks() {
  if (!userWallet) return;
  try {
    const r = await fetchWithTimeout(`${NODE_SERVER_URL}/get-tasks?wallet=${userWallet}`);
    const d = await r.json();
    completedTasks = d.tasks || [];
    updateTaskUI();
    checkAllTasksCompleted();
    updateProgressBar();
  } catch(e){}
}

async function saveTaskToDB(taskId, btn) {
  try {
    const updated = [...completedTasks, taskId];
    const r = await fetchWithTimeout(`${NODE_SERVER_URL}/save-tasks`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ wallet:userWallet, tasks:updated })
    });
    const d = await r.json();

    if (d.success) {
      completedTasks = updated;
      btn.innerText = "Completed ✅";
      btn.disabled = true;
      btn.style.background="linear-gradient(90deg,#00ff99,#00cc66)";
      checkAllTasksCompleted();
      updateProgressBar();
    } else throw new Error(d.message || "Save error");

  } catch(e){
    const base = TASKS.find(t=>t.id===taskId)?.btnText || "Verify";
    btn.innerText = base;
    btn.disabled = false;
    showBanner("Task save error","red");
  }
}

/* ------------------ VERIFY TASK ------------------ */
async function verifyTask(taskId) {
  if (!userWallet) return showBanner("Connect wallet first","red");
  const btn = document.getElementById(`verify-${taskId}`);
  if (!btn) return;
  if (completedTasks.includes(taskId)) return showModal("This task is already completed ✅");

  if (taskId === 'x') {
    window.open(SOCIAL_URLS.xFollowIntent,'_blank');
    window.open(SOCIAL_URLS.xRetweetIntent,'_blank');
    window.open(SOCIAL_URLS.x,'_blank');
  } else if (taskId === 'telegram') {
    try { window.open(SOCIAL_URLS.telegramDeep,'_blank'); } catch {}
    window.open(SOCIAL_URLS.telegram,'_blank');
  } else if (taskId === 'instagram') {
    window.open(SOCIAL_URLS.instagram,'_blank');
  }

  btn.innerText = "Verifying...";
  btn.disabled = true;

  if (taskId === 'x') {
    try {
      const username = prompt("Enter your X (Twitter) username (without @):");
      if (!username) { btn.innerText = "Verify"; btn.disabled = false; return; }

      btn.innerText = "Checking X...";

      const r = await fetchWithTimeout(`${NODE_SERVER_URL}/verify-x`, {
        method:'POST',
        headers:{ "Content-Type": "application/json" },
        body:JSON.stringify({ username:username.trim(), wallet:userWallet })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "X verification failed");

      btn.innerText = "Saving...";
      await saveTaskToDB(taskId, btn);

    } catch(e){
      btn.innerText = "Verify";
      btn.disabled = false;
      return showBanner("X verification failed: "+(e.message||"Network error"), "red");
    }
  } else {
    btn.innerText = "Saving...";
    await saveTaskToDB(taskId, btn);
  }
}

/* ------------------ UI ------------------ */
function updateTaskUI() {
  TASKS.forEach(t => {
    const btn = document.getElementById(`verify-${t.id}`);
    if (!btn) return;
    if (completedTasks.includes(t.id)) {
      btn.innerText = "Completed ✅";
      btn.disabled = true;
      btn.style.background="linear-gradient(90deg,#00ff99,#00cc66)";
    } else {
      btn.innerText = t.btnText;
      btn.disabled = false;
      btn.style.background="linear-gradient(90deg,#4a67ff,#8338ec)";
    }
  });
}

function checkAllTasksCompleted() {
  const all = TASKS.every(t => completedTasks.includes(t.id));
  const b1 = $("#claimTopBtn");
  const b2 = $("#claimNowBtn");

  if (all) {
    if (b1) { b1.disabled = false; b1.textContent = "🚀 Claim $SKYL"; }
    if (b2) { b2.disabled = false; b2.textContent = "🚀 Claim $SKYL"; }
    $("#airdropStatus").textContent = "All tasks completed! You are eligible to claim.";
    return true;
  } else {
    if (b1) { b1.disabled = true; b1.textContent = "Complete Tasks to Claim"; }
    if (b2) { b2.disabled = true; b2.textContent = "Complete Tasks to Claim"; }
    $("#airdropStatus").textContent = "Complete all tasks to become eligible.";
    return false;
  }
}

/* ------------------ Claim ------------------ */
async function checkAndSwitchThenClaim() {
  const ok = await checkAndSwitchNetwork();
  if (!ok) { showBanner("Please switch to BNB Smart Chain to claim.", "red"); return false; }
  return true;
}

async function claimTokens() {
  if (!userWallet) return showBanner("Connect wallet", "red");
  if (!checkAllTasksCompleted()) return showBanner("Complete tasks first","red");

  const ok = await checkAndSwitchThenClaim();
  if (!ok) return;

  const b1 = $("#claimTopBtn");
  const b2 = $("#claimNowBtn");

  try {
    const c = new ethers.Contract(AIRDROP_CONTRACT, AIRDROP_ABI, signer);

    if (b1) b1.textContent="Waiting for signature...";
    if (b2) b2.textContent="Waiting for signature...";

    const tx = await c.claimAirdrop();

    if (b1) b1.textContent="Pending...";
    if (b2) b2.textContent="Pending...";
    await tx.wait();

    const popup = $("#claimSuccessPopup");
    if (popup) popup.style.display="flex";

    if (b1) { b1.textContent="✅ Claimed"; b1.disabled = true; }
    if (b2) { b2.textContent="✅ Claimed"; b2.disabled = true; }

    refreshParticipantsCounter();

  } catch(e){
    showBanner("Claim failed: "+e.message, "red");
    if (b1) b1.textContent="🚀 Claim $SKYL";
    if (b2) b2.textContent="🚀 Claim $SKYL";
  }
}

/* ------------------ Countdown ------------------ */
function startCountdown() {
  const countdownElement = document.getElementById("countdown");
  const claimBtn = document.getElementById("claimTopBtn");
  const claimNowBtn = document.getElementById("claimNowBtn");
  if (!countdownElement) return;

  const countDownDate = new Date("2025-12-31T23:59:59Z").getTime();

  const interval = setInterval(() => {
    const now = Date.now();
    const distance = countDownDate - now;

    if (distance < 0) {
      clearInterval(interval);
      countdownElement.innerHTML = "Airdrop Ended";
      [claimBtn, claimNowBtn].forEach(btn => { if (btn) { btn.disabled = true; btn.textContent = "Airdrop Ended"; } });
      return;
    }

    const days = Math.floor(distance / 86400000);
    const hours = Math.floor((distance % 86400000) / 3600000);
    const minutes = Math.floor((distance % 3600000) / 60000);
    const seconds = Math.floor((distance % 60000) / 1000);

    countdownElement.innerHTML =
      days + "d " +
      hours.toString().padStart(2, "0") + "h " +
      minutes.toString().padStart(2, "0") + "m " +
      seconds.toString().padStart(2, "0") + "s ";
  }, 1000);
}
window.startCountdown = startCountdown;

/* ------------------ Init ------------------ */
document.addEventListener("DOMContentLoaded",() => {
  ensureUXWidgets();
  adjustPoolCopyTo500M();

  refreshParticipantsCounter();
  setInterval(refreshParticipantsCounter, 30000);

  const connectBtn = document.querySelector(".wallet-actions .btn");
  if (connectBtn) connectBtn.addEventListener("click", connectWallet);

  $("#claimTopBtn")?.addEventListener("click", claimTokens);
  $("#claimNowBtn")?.addEventListener("click", claimTokens);

  $("#closePopup")?.addEventListener("click",()=>{ $("#claimSuccessPopup").style.display="none"; });

  $("#verify-x")?.addEventListener("click",()=>verifyTask("x"));
  $("#verify-telegram")?.addEventListener("click",()=>verifyTask("telegram"));
  $("#verify-instagram")?.addEventListener("click",()=>verifyTask("instagram"));

  window.startCountdown();
});
