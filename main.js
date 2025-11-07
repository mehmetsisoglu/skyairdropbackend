/* ==========================
   Skyline Logic Airdrop v1.0 Final Stable
========================== */

// ---------- Config ----------
const DEV_MODE = false;
const NODE_SERVER_URL = "https://skyairdropbackend.onrender.com";
const AIRDROP_TWEET_ID = "1983278116723392817";

const SOCIAL_URLS = {
  x: "https://x.com/SkylineLogicAI",
  xFollowIntent: "https://twitter.com/intent/user?screen_name=SkylineLogicAI",
  xRetweetIntent: `https://twitter.com/intent/retweet?tweet_id=${AIRDROP_TWEET_ID}`,
  telegram: "https://t.me/skylinelogic",
  telegramDeep: "tg://resolve?domain=skylinelogic",
  instagram: "https://www.instagram.com/skyline.logic",
};

// Network
const AIRDROP_CONTRACT = "0x316549D421e454e08040efd8b7d331C7e5946724";
const TOKEN_CONTRACT   = "0xa7c4436c2Cf6007Dd03c3067697553bd51562f2c";

const REQUIRED_CHAIN_ID = '0x38';
const BNB_CHAIN_PARAMS = {
  chainId: '0x38',
  chainName: 'BNB Smart Chain',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: ['https://bsc-dataseed.binance.org/'],
  blockExplorerUrls: ['https://bscscan.com']
};

const AIRDROP_ABI = [
  {"inputs":[{"internalType":"address","name":"_token","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"wallet","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"AirdropClaimed","type":"event"},
  {"inputs":[],"name":"amountPerWallet","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"claimed","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"claimAirdrop","outputs":[],"stateMutability":"nonpayable","type":"function"}
];

// ---------- State ----------
let provider, signer, userWallet = null;
let completedTasks = [];

function $(s){ return document.querySelector(s); }

/* ==========================
   COUNTDOWN
========================== */
window.startCountdown = function () {
  const target = new Date("2025-12-31T23:59:59Z").getTime();
  const el = document.getElementById("countdown");
  if (!el) return;

  function update() {
    const now = Date.now();
    let diff = target - now;
    if (diff <= 0) {
      el.textContent = "00d 00h 00m 00s";
      return;
    }

    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff / 3600000) % 24);
    const m = Math.floor((diff / 60000) % 60);
    const s = Math.floor((diff / 1000) % 60);

    el.textContent = `${d}d ${String(h).padStart(2,"0")}h ${String(m).padStart(2,"0")}m ${String(s).padStart(2,"0")}s`;
  }

  update();
  setInterval(update, 1000);
};

/* ==========================
   PARTICIPANTS COUNTER
========================== */
async function refreshParticipants() {
  try {
    const r = await fetch(`${NODE_SERVER_URL}/get-leaderboard`);
    const d = await r.json();
    const el = document.getElementById("participants");
    if (el) el.textContent = d.length.toString();
  } catch(e){}
}

/* ==========================
   POOL FIX
========================== */
function adjustPoolCopyTo500M() {
  const stats = document.querySelectorAll(".airdrop-stats .stat-item .stat-title");
  stats.forEach(t => {
    if (t.textContent.trim().toLowerCase() === "airdrop pool") {
      const val = t.parentElement.querySelector(".stat-value");
      if (val) val.textContent = "500,000,000 $SKYL";
    }
  });
}

/* ==========================
   WALLET CONNECT
========================== */
async function checkAndSwitchNetwork() {
  if (!window.ethereum) return false;

  try {
    const cid = await window.ethereum.request({ method:'eth_chainId' });
    if (cid === REQUIRED_CHAIN_ID) return true;

    await window.ethereum.request({
      method:'wallet_switchEthereumChain',
      params:[{ chainId: REQUIRED_CHAIN_ID }]
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

    const btn = document.querySelector(".wallet-actions .btn");
    if (btn) btn.style.display = "none";
    $("#statusMsg").textContent = "Network: Connected";
    updateProfilePanel(userWallet);

    await loadUserTasks();
    showBanner("Wallet connected","green");

  } catch(e){
    showBanner("Wallet connection failed","red");
  }
}

/* ==========================
   TASKS
========================== */
const TASKS = [
  { id:"x", label:"Follow X & Retweet Post", btnText:"Verify" },
  { id:"telegram", label:"Join our Telegram channel", btnText:"Join" },
  { id:"instagram", label:"Follow our Instagram", btnText:"Follow" }
];

async function loadUserTasks() {
  if (!userWallet) return;
  try {
    const r = await fetch(`${NODE_SERVER_URL}/get-tasks?wallet=${userWallet}`);
    const d = await r.json();
    completedTasks = d.tasks || [];
    updateTaskUI();
    checkAllTasksCompleted();
  } catch(e){}
}

async function saveTaskToDB(taskId, btn) {
  try {
    const updated = [...completedTasks, taskId];

    const r = await fetch(`${NODE_SERVER_URL}/save-tasks`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ wallet:userWallet, tasks:updated })
    });
    const d = await r.json();

    if (!d.success) throw new Error("DB error");

    completedTasks = updated;
    btn.innerText = "Completed ✅";
    btn.disabled = true;

    checkAllTasksCompleted();

  } catch(e){
    btn.innerText = TASKS.find(t=>t.id===taskId).btnText;
    btn.disabled = false;
  }
}

/* ==========================
   VERIFY TASK
========================== */
async function verifyTask(taskId) {
  if (!userWallet) return showBanner("Connect wallet first","red");

  const btn = document.getElementById(`verify-${taskId}`);
  if (!btn) return;
  if (completedTasks.includes(taskId)) return showModal("Already completed ✅");

  // open links
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

  // X verification
  if (taskId === "x") {
    try {
      const username = prompt("Enter your X (Twitter) username (without @):");
      if (!username) {
        btn.innerText = "Verify";
        btn.disabled = false;
        return;
      }

      const r = await fetch(`${NODE_SERVER_URL}/verify-x`, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({ username:username.trim() })
      });
      const d = await r.json();

      if (!r.ok) throw new Error(d.message);

      btn.innerText = "Saving...";
      await saveTaskToDB(taskId, btn);

    } catch(e){
      btn.innerText = "Verify";
      btn.disabled = false;
      showBanner("X verification failed","red");
    }
  }

  // Others → auto complete
  else {
    btn.innerText = "Saving...";
    await saveTaskToDB(taskId, btn);
  }
}

/* ==========================
   UI
========================== */
function updateTaskUI() {
  TASKS.forEach(t => {
    const btn = document.getElementById(`verify-${t.id}`);
    if (!btn) return;

    if (completedTasks.includes(t.id)) {
      btn.innerText = "Completed ✅";
      btn.disabled = true;
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

  if (!b1 || !b2) return false;

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

/* ==========================
   CLAIM
========================== */
async function claimTokens() {
  if (!userWallet) return showBanner("Connect wallet", "red");
  if (!checkAllTasksCompleted()) return showBanner("Complete tasks first","red");

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

  } catch(e){
    showBanner("Claim failed: "+e.message, "red");
  }
}

/* ==========================
   INIT
========================== */
document.addEventListener("DOMContentLoaded", () => {

  adjustPoolCopyTo500M();

  // Wallet connect
  const connectBtn = document.querySelector(".wallet-actions .btn");
  if (connectBtn) connectBtn.addEventListener("click", connectWallet);

  // Verify actions
  $("#verify-x")?.addEventListener("click",()=>verifyTask("x"));
  $("#verify-telegram")?.addEventListener("click",()=>verifyTask("telegram"));
  $("#verify-instagram")?.addEventListener("click",()=>verifyTask("instagram"));

  // Claim actions
  $("#claimTopBtn")?.addEventListener("click", claimTokens);
  $("#claimNowBtn")?.addEventListener("click", claimTokens);
  $("#closePopup")?.addEventListener("click",()=>{
    $("#claimSuccessPopup").style.display="none";
  });

  // Start countdown
  if (typeof window.startCountdown === "function") window.startCountdown();

  // Participants counter
  refreshParticipants();
  setInterval(refreshParticipants, 30000);
});
