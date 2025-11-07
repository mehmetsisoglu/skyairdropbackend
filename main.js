/* ------------------ CONFIG ------------------ */
const AIRDROP_CONTRACT = "0x316549D421e454e08040efd8b7d331C7e5946724";

const AIRDROP_ABI = [
  "function claimAirdrop() public",
  "function owner() public view returns (address)"
];

const BACKEND_URL = "/api";

/* ------------------ STATE ------------------ */
let provider = null;
let signer = null;
let userWallet = null;
let completedTasks = [];

/* ------------------ UTILS ------------------ */
function $(s) { return document.querySelector(s); }

function showBanner(msg, color) {
  const b = $("#topBanner");
  b.textContent = msg;
  b.style.background = color === "green"
    ? "linear-gradient(90deg,#00c864,#00994a)"
    : "linear-gradient(90deg,#ff0033,#ff6600)";
  b.classList.add("show");
  setTimeout(() => b.classList.remove("show"), 3000);
}

async function fetchJSON(url, data = null) {
  const res = await fetch(url, {
    method: data ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: data ? JSON.stringify(data) : undefined
  });
  return res.json();
}

/* ------------------ COUNTDOWN ------------------ */
function startCountdown() {
  const elem = $("#countdown");
  if (!elem) return;

  const target = new Date("2025-12-31T23:59:00Z").getTime();

  function tick() {
    const now = Date.now();
    let diff = target - now;

    if (diff <= 0) {
      elem.textContent = "00d 00h 00m 00s";
      return;
    }

    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / (1000 * 60)) % 60);
    const s = Math.floor((diff / 1000) % 60);

    elem.textContent = `${d}d ${h}h ${m}m ${s}s`;
  }

  tick();
  setInterval(tick, 1000);
}
window.startCountdown = startCountdown;

/* ------------------ WALLET ------------------ */
async function connectWallet() {
  if (!window.ethereum) {
    return showBanner("No wallet found", "red");
  }

  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });
    provider = new ethers.providers.Web3Provider(window.ethereum);
    signer = provider.getSigner();
    userWallet = await signer.getAddress();

    $("#walletAddress").textContent =
      userWallet.slice(0, 6) + "..." + userWallet.slice(-4);

    $("#disconnectBtn").style.display = "inline-block";
    $("#connectWalletBtn").style.display = "none";

    showBanner("Wallet connected", "green");
  } catch (e) {
    showBanner("Wallet connection failed", "red");
  }
}
window.connectWallet = connectWallet;

function disconnectWallet() {
  userWallet = null;
  signer = null;

  $("#walletAddress").textContent = "Not connected";
  $("#disconnectBtn").style.display = "none";
  $("#connectWalletBtn").style.display = "inline-block";

  showBanner("Disconnected", "red");
}
window.disconnectWallet = disconnectWallet;

/* ------------------ TASKS ------------------ */
const TASKS = [
  { id: "x", label: "Follow X & Retweet Post", btnText: "Verify" },
  { id: "telegram", label: "Join our Telegram channel", btnText: "Join" },
  { id: "instagram", label: "Follow our Instagram", btnText: "Follow" }
];

async function saveTaskToDB(taskId, btn) {
  const res = await fetchJSON(`${BACKEND_URL}/complete`, {
    wallet: userWallet,
    task: taskId
  });

  if (res.success) {
    completedTasks.push(taskId);
    updateTaskUI();
    showBanner("Task completed", "green");
  } else {
    showBanner("Failed to save task", "red");
  }

  btn.disabled = false;
  btn.textContent = TASKS.find(t => t.id === taskId).btnText;
}

async function verifyTask(taskId) {
  const btn = document.getElementById(`verify-${taskId}`);
  if (!btn) return;

  if (!userWallet) return showBanner("Connect wallet first", "red");
  btn.disabled = true;
  btn.textContent = "Checking...";

  try {
    await saveTaskToDB(taskId, btn);
  } catch (e) {
    btn.disabled = false;
    btn.textContent = TASKS.find(t => t.id === taskId).btnText;
    showBanner("Verification failed", "red");
  }
}

function updateTaskUI() {
  TASKS.forEach(t => {
    const btn = document.getElementById(`verify-${t.id}`);
    if (!btn) return;

    if (completedTasks.includes(t.id)) {
      btn.textContent = "Completed ✅";
      btn.disabled = true;
      btn.style.background = "linear-gradient(90deg,#00ff99,#00cc66)";
    } else {
      btn.textContent = t.btnText;
      btn.disabled = false;
    }
  });
}

/* ------------------ CLAIM ------------------ */
async function claimTokens() {
  if (!userWallet) return showBanner("Connect wallet first", "red");

  const c = new ethers.Contract(AIRDROP_CONTRACT, AIRDROP_ABI, signer);

  const b1 = $("#claimTopBtn");
  const b2 = $("#claimNowBtn");
  b1.textContent = "Pending...";
  b2.textContent = "Pending...";

  try {
    const tx = await c.claimAirdrop();
    await tx.wait();

    $("#claimSuccessPopup").style.display = "flex";
    b1.textContent = "✅ Claimed";
    b2.textContent = "✅ Claimed";
    b1.disabled = true;
    b2.disabled = true;

  } catch (e) {
    showBanner("Claim failed", "red");
    b1.textContent = "Claim Tokens";
    b2.textContent = "Claim Tokens";
  }
}
window.claimTokens = claimTokens;

/* ------------------ PATCHES ------------------ */
function adjustPoolCopyTo500M() {
  const list = document.querySelectorAll(".stat-value");
  list.forEach(el => {
    if (el.textContent.includes("100,000,000")) {
      el.textContent = "500,000,000 $SKYL";
    }
  });
}

/* ------------------ INIT ------------------ */
document.addEventListener("DOMContentLoaded", () => {
  adjustPoolCopyTo500M();

  $("#connectWalletBtn")?.addEventListener("click", connectWallet);
  $("#disconnectBtn")?.addEventListener("click", disconnectWallet);

  $("#verify-x")?.addEventListener("click", () => verifyTask("x"));
  $("#verify-telegram")?.addEventListener("click", () => verifyTask("telegram"));
  $("#verify-instagram")?.addEventListener("click", () => verifyTask("instagram"));

  $("#claimTopBtn")?.addEventListener("click", claimTokens);
  $("#claimNowBtn")?.addEventListener("click", claimTokens);

  $("#closePopup")?.addEventListener("click", () => {
    $("#claimSuccessPopup").style.display = "none";
  });

  startCountdown();
});
