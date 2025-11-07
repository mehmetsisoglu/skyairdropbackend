/* ==========================
   Skyline Logic Airdrop v3
   Stabil • Hardened • Countdown Fixed
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
let provider, signer, userWallet = null;
let completedTasks = [];

/* ------------------ Utils ------------------ */
function log(...args){ if (DEV_MODE) console.log(...args); }
function $(s){ return document.querySelector(s); }

async function fetchWithTimeout(resource, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(resource, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (e) { clearTimeout(id); throw e; }
}

/* ------------------ Task List ------------------ */
const TASKS = [
  { id:"x", label:"Follow X & Retweet Post", btnText:"Verify" },
  { id:"telegram", label:"Join our Telegram channel", btnText:"Join" },
  { id:"instagram", label:"Follow our Instagram", btnText:"Follow" }
];

/* ------------------ Countdown ------------------ */
function startCountdown() {
  const countdownElement = document.getElementById("countdown");
  if (!countdownElement) return;

  const target = new Date("2025-12-31T23:59:59Z").getTime();

  function update() {
    const now = Date.now();
    const diff = target - now;

    if (diff <= 0) {
      countdownElement.textContent = "Airdrop Ended";
      return;
    }

    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    countdownElement.textContent =
      `${d}d ${String(h).padStart(2,"0")}h ${String(m).padStart(2,"0")}m ${String(s).padStart(2,"0")}s`;
  }

  update();
  setInterval(update, 1000);
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

/* ------------------ Wallet Connection ------------------ */
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

async function connectWallet() {
  try {
    if (!window.ethereum) return showModal("Install MetaMask first.");

    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    userWallet = (await signer.getAddress()).toLowerCase();

    await checkAndSwitchNetwork();

    document.querySelector(".wallet-actions .btn").style.display = "none";
    $("#statusMsg").textContent = "Network: Connected";
    updateProfilePanel(userWallet);

    await loadUserTasks();

  } catch(e){
    showBanner("Wallet connection failed","red");
  }
}

/* ------------------ Load & Save Tasks ------------------ */
async function loadUserTasks() {
  if (!userWallet) return;
  try {
    const r = await fetchWithTimeout(`${NODE_SERVER_URL}/get-tasks?wallet=${userWallet}`);
    const d = await r.json();
    completedTasks = d.tasks || [];
    updateTaskUI();
    checkAllTasksCompleted();
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
    } else throw new Error(d.message);

  } catch(e){
    btn.innerText = TASKS.find(t=>t.id===taskId).btnText;
    btn.disabled = false;
  }
}

/* ------------------ VERIFY TASK ------------------ */
async function verifyTask(taskId) {

  if (!userWallet) return showBanner("Connect wallet first","red");
  const btn = document.getElementById(`verify-${taskId}`);

  if (!btn) return;
  if (completedTasks.includes(taskId)) return showModal("Already completed ✅");

  // Open social URLs
  if (taskId === 'x') {
    window.open(SOCIAL_URLS.xFollowIntent,'_blank');
    window.open(SOCIAL_URLS.xRetweetIntent,'_blank');
    window.open(SOCIAL_URLS.x,'_blank');
  }
  if (taskId === 'telegram') {
    try{ window.open(SOCIAL_URLS.telegramDeep,'_blank'); }catch{}
    window.open(SOCIAL_URLS.telegram,'_blank');
  }
  if (taskId === 'instagram') {
    window.open(SOCIAL_URLS.instagram,'_blank');
  }

  btn.innerText = "Verifying...";
  btn.disabled = true;

  /* ✅ X TASK: USERNAME PROMPT + BACKEND VERIFY */
  if (taskId === 'x') {
    try {
      const username = prompt("Enter your X (Twitter) username (without @):");
      if (!username) {
        btn.innerText = "Verify";
        btn.disabled = false;
        return;
      }

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
      return showBanner("X verification failed: "+e.message, "red");
    }
  }

  /* ✅ OTHER TASKS — AUTO COMPLETE */
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
      btn.style.background="linear-gradient(90deg,#00ff99,#00cc66)";
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
  p.querySelector("p").textContent = "Wallet: " + addr.slice(0,6)+"..."+addr.slice(-4);
}

function showModal(msg) {
  const o = $("#modalOverlay");
  o.innerHTML = `<div class="modal-box"><p>${msg}</p><button class="btn" onclick="closeModal()">OK</button></div>`;
  o.style.display = "flex";
}
function closeModal(){ $("#modalOverlay").style.display = "none"; }

function showBanner(msg,color){
  const b=$("#topBanner");
  b.textContent=msg;
  b.style.background = color==="green"
    ? "linear-gradient(90deg, rgba(0,200,100,.9), rgba(0,150,50,.9))"
    : "linear-gradient(90deg, rgba(255,0,0,.9), rgba(255,100,0,.9))";
  b.classList.add("show");
  setTimeout(()=>b.classList.remove("show"),3000);
}

/* ------------------ Claim ------------------ */
async function claimTokens() {
  if (!userWallet) return showBanner("Connect wallet", "red");
  if (!checkAllTasksCompleted()) return showBanner("Complete tasks first","red");

  await checkAndSwitchNetwork();

  const b1 = $("#claimTopBtn");
  const b2 = $("#claimNowBtn");

  try {
    const c = new ethers.Contract(AIRDROP_CONTRACT, AIRDROP_ABI, signer);

    b1.textContent="Waiting for signature...";
    b2.textContent="Waiting for signature...";

    const tx = await c.claimAirdrop();

    b1.textContent="Pending...";
    b2.textContent="Pending...";
    await tx.wait();

    $("#claimSuccessPopup").style.display="flex";

    b1.textContent="✅ Claimed";
    b2.textContent="✅ Claimed";
    b1.disabled = true;
    b2.disabled = true;

  } catch(e){
    showBanner("Claim failed: "+e.message, "red");
    b1.textContent="🚀 Claim $SKYL";
    b2.textContent="🚀 Claim $SKYL";
  }
}

/* ------------------ Init ------------------ */
document.addEventListener("DOMContentLoaded",() => {

  adjustPoolCopyTo500M();
  startCountdown();

  const connectBtn = document.querySelector(".wallet-actions .btn");
  if (connectBtn) connectBtn.addEventListener("click", connectWallet);

  $("#claimTopBtn")?.addEventListener("click", claimTokens);
  $("#claimNowBtn")?.addEventListener("click", claimTokens);

  $("#closePopup")?.addEventListener("click",()=>{
    $("#claimSuccessPopup").style.display="none";
  });

  $("#verify-x")?.addEventListener("click",()=>verifyTask("x"));
  $("#verify-telegram")?.addEventListener("click",()=>verifyTask("telegram"));
  $("#verify-instagram")?.addEventListener("click",()=>verifyTask("instagram"));
});
