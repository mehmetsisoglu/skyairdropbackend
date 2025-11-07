/* ============================================================
   Skyline Logic — Airdrop Main Script (Full Version / Final)
   ============================================================ */

const DEV_MODE = false;

/* ------------------ Config ------------------ */
const AIRDROP_CONTRACT = "0x316549D421e454e08040efd8b7d331C7e5946724";
const AIRDROP_TWEET_ID = "1983278116723392817"; // TEST ID
const AIRDROP_ABI = [
  "function claimAirdrop() external",
  "function balanceOf(address) view returns(uint256)"
];

/* ------------------ State ------------------ */
let provider, signer, userWallet = null;
let completedTasks = [];

/* ------------------ Utils ------------------ */
function log(...args) { if (DEV_MODE) console.log(...args); }
function $(s) { return document.querySelector(s); }

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

/* ------------------ Countdown ------------------ */
function startCountdown() {
  const el = document.getElementById("countdown");
  if (!el) return;

  const target = new Date("December 31, 2025 23:59:00 UTC");

  function update() {
    const now = new Date();
    const diff = target - now;

    if (diff <= 0) {
      el.textContent = "00d 00h 00m 00s";
      return;
    }

    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / (1000 * 60)) % 60);
    const s = Math.floor((diff / 1000) % 60);

    el.textContent =
      `${d}d ${h.toString().padStart(2, "0")}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
  }

  update();
  setInterval(update, 1000);
}

window.startCountdown = startCountdown;

/* ------------------ Task List ------------------ */
const TASKS = [
  { id: "x", label: "Follow X & Retweet Post", btnText: "Verify" },
  { id: "telegram", label: "Join our Telegram channel", btnText: "Join" },
  { id: "instagram", label: "Follow our Instagram", btnText: "Follow" }
];

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

/* ------------------ Wallet ------------------ */
async function connectWallet() {
  if (!window.ethereum)
    return showBanner("MetaMask not detected", "red");

  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    userWallet = await signer.getAddress();

    $("#walletAddress").textContent = userWallet.slice(0, 6) + "..." + userWallet.slice(-4);
    showBanner("Wallet connected", "green");

    loadCompletedTasks();
    updateProfilePanel(userWallet);

  } catch (e) {
    showBanner("Wallet connection failed", "red");
  }
}

async function checkAndSwitchNetwork() {
  const chainId = "0x38"; // BNB Chain Mainnet
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  } catch (switchError) {
    showBanner("Switch to BNB Chain first!", "red");
    throw switchError;
  }
}

/* ------------------ Task Save ------------------ */
async function saveTaskToDB(taskId, btn) {
  try {
    const res = await fetch("/airdrop/api/save-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: userWallet, task: taskId })
    });

    const data = await res.json();
    if (!data.success) throw new Error("DB error");

    completedTasks.push(taskId);
    updateTaskUI();
    checkAllTasksCompleted();

    btn.innerText = "Completed ✅";
    btn.disabled = true;

    showBanner("Task completed!", "green");
  } catch (e) {
    showBanner("Database error: " + e.message, "red");
  }
}

/* ------------------ Task Verify ------------------ */
async function verifyTask(taskId) {
  const btn = document.getElementById(`verify-${taskId}`);
  if (!btn) return;

  if (!userWallet) return showBanner("Connect wallet first", "red");

  btn.disabled = true;
  btn.innerText = "Checking...";

  if (taskId === "x") {
    try {
      const username = prompt("Enter your X username (without @):");
      if (!username) throw new Error("Username required");

      const res = await fetch(`/airdrop/api/check-x?wallet=${userWallet}&username=${username}&tweet=${AIRDROP_TWEET_ID}`);
      const data = await res.json();

      if (!data.success) throw new Error(data.message || "Verification failed");

      btn.innerText = "Saving...";
      await saveTaskToDB(taskId, btn);

    } catch (e) {
      btn.innerText = "Verify";
      btn.disabled = false;
      return showBanner("X verification failed: " + e.message, "red");
    }
  }

  // OTHER TASKS
  else {
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
      btn.style.background = "linear-gradient(90deg,#00ff99,#00cc66)";
    } else {
      btn.innerText = t.btnText;
      btn.disabled = false;
    }
  });
}

function checkAllTasksCompleted() {
  const all = TASKS.every(t => completedTasks.includes(t.id));
  const b1 = $("#claimTopBtn");
  const b2 = $("#claimNowBtn");

  if (all) {
    b1.disabled = false;
    b2.disabled = false;
    b1.textContent = "🚀 Claim $SKYL";
    b2.textContent = "🚀 Claim $SKYL";
    return true;
  } else {
    b1.disabled = true;
    b2.disabled = true;
    b1.textContent = "Complete Tasks to Claim";
    b2.textContent = "Complete Tasks to Claim";
    return false;
  }
}

function updateProfilePanel(addr) {
  const p = $("#profile-panel");
  if (!p) return;
  p.style.display = "block";
  p.querySelector("p").textContent = "Wallet: " + addr.slice(0, 6) + "..." + addr.slice(-4);
}

function showModal(msg) {
  const o = $("#modalOverlay");
  o.innerHTML = `<div class="modal-box"><p>${msg}</p><button class="btn" onclick="closeModal()">OK</button></div>`;
  o.style.display = "flex";
}

function closeModal() { $("#modalOverlay").style.display = "none"; }

function showBanner(msg, color) {
  const b = $("#topBanner");
  b.textContent = msg;
  b.style.background = color === "green"
    ? "linear-gradient(90deg, rgba(0,200,100,.9), rgba(0,150,50,.9))"
    : "linear-gradient(90deg, rgba(255,0,0,.9), rgba(255,100,0,.9))";

  b.classList.add("show");
  setTimeout(() => b.classList.remove("show"), 3000);
}

/* ------------------ Claim ------------------ */
async function claimTokens() {
  if (!userWallet) return showBanner("Connect wallet", "red");
  if (!checkAllTasksCompleted()) return showBanner("Complete tasks first", "red");

  await checkAndSwitchNetwork();

  const b1 = $("#claimTopBtn");
  const b2 = $("#claimNowBtn");

  try {
    const c = new ethers.Contract(AIRDROP_CONTRACT, AIRDROP_ABI, signer);

    b1.textContent = "Waiting for signature...";
    b2.textContent = "Waiting for signature...";

    const tx = await c.claimAirdrop();

    b1.textContent = "Pending...";
    b2.textContent = "Pending...";
    await tx.wait();

    $("#claimSuccessPopup").style.display = "flex";

    b1.textContent = "✅ Claimed";
    b2.textContent = "✅ Claimed";
    b1.disabled = true;
    b2.disabled = true;

  } catch (e) {
    showBanner("Claim failed: " + e.message, "red");
    b1.textContent = "🚀 Claim $SKYL";
    b2.textContent = "🚀 Claim $SKYL";
  }
}

/* ------------------ Init ------------------ */
document.addEventListener("DOMContentLoaded", () => {

  adjustPoolCopyTo500M();

  const connectBtn = document.querySelector(".wallet-actions .btn");
  if (connectBtn) connectBtn.addEventListener("click", connectWallet);

  $("#claimTopBtn")?.addEventListener("click", claimTokens);
  $("#claimNowBtn")?.addEventListener("click", claimTokens);

  $("#closePopup")?.addEventListener("click", () => {
    $("#claimSuccessPopup").style.display = "none";
  });

  $("#verify-x")?.addEventListener("click", () => verifyTask("x"));
  $("#verify-telegram")?.addEventListener("click", () => verifyTask("telegram"));
  $("#verify-instagram")?.addEventListener("click", () => verifyTask("instagram"));

  // ✅ Countdown başlat
  window.startCountdown();
});
