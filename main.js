// ---------- Config ----------
const AIRDROP_CONTRACT = "0x316549D421e454e08040efd8b7d331C7e5946724";
const AIRDROP_ABI = AIRDROP_ABI_DATA;

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
  if (!window.ethereum) return showBanner("MetaMask not found","red");

  const chainId = await ethereum.request({ method:"eth_chainId" });

  if (chainId !== "0x144") {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x144" }]
    });
  }
}

/* ------------------ Wallet ------------------ */
async function connectWallet() {
  try {
    if (!window.ethereum) return showBanner("MetaMask not installed", "red");

    const accounts = await ethereum.request({ method:"eth_requestAccounts" });
    userWallet = accounts[0];

    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();

    $("#walletStatus").textContent = "connected";
    $("#connectWalletBtn").style.display = "none";
    $("#disconnectWalletBtn").style.display = "inline-block";

    loadUserTasks();
    updateProfilePanel(userWallet);

    showBanner("Wallet connected", "green");
  }
  catch(e){
    showBanner("Wallet error: "+e.message, "red");
  }
}

function disconnectWallet() {
  userWallet = null;
  $("#walletStatus").textContent = "not connected";
  $("#connectWalletBtn").style.display = "inline-block";
  $("#disconnectWalletBtn").style.display = "none";
}

/* ------------------ TASK FUNCTIONS ------------------ */
async function loadUserTasks() {
  if (!userWallet) return;

  try {
    const r = await fetch(`/api/tasks/${userWallet}`);
    const d = await r.json();
    completedTasks = d.tasks || [];
    updateTaskUI();
    checkAllTasksCompleted();
  } catch(e){}
}

async function saveTaskToDB(taskId, btn) {
  try {
    const r = await fetch("/api/complete-task", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ wallet: userWallet, task: taskId })
    });
    const d = await r.json();
    if (!d.success) throw new Error("DB save failed");

    completedTasks.push(taskId);
    updateTaskUI();
    checkAllTasksCompleted();
  } catch(e) {
    showBanner("Database error", "red");
  }
}

async function verifyTask(taskId) {
  const btn = document.getElementById(`verify-${taskId}`);
  btn.disabled = true;

  try {
    if (taskId === "x") {
      btn.innerText = "Saving...";
      await saveTaskToDB(taskId, btn);
    } else {
      btn.innerText = "Saving...";
      await saveTaskToDB(taskId, btn);
    }
  }
  catch(e){
    btn.innerText = "Verify";
    btn.disabled = false;
    return showBanner("Verification failed: "+e.message, "red");
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
  } else {
    b1.disabled = true;
    b2.disabled = true;
    b1.textContent = "Complete Tasks to Claim";
    b2.textContent = "Complete Tasks to Claim";
  }
}

function updateProfilePanel(addr) {
  const p = $("#profile-panel");
  if (!p) return;
  p.style.display = "block";
  p.querySelector("p").textContent = "Wallet: " + addr.slice(0,6)+"..."+addr.slice(-4);
}

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

    b1.textContent="Waiting...";
    b2.textContent="Waiting...";

    const tx = await c.claimAirdrop();

    b1.textContent="Pending...";
    b2.textContent="Pending...";
    await tx.wait();

    $("#claimSuccessPopup").style.display="flex";

    b1.textContent="✅ Claimed";
    b2.textContent="✅ Claimed";
    b1.disabled = true;
    b2.disabled = true;
  }
  catch(e){
    showBanner("Claim failed: "+e.message, "red");
    b1.textContent="🚀 Claim $SKYL";
    b2.textContent="🚀 Claim $SKYL";
  }
}

/* ------------------ Init ------------------ */
document.addEventListener("DOMContentLoaded",() => {

  adjustPoolCopyTo500M();

  $("#connectWalletBtn")?.addEventListener("click", connectWallet);
  $("#disconnectWalletBtn")?.addEventListener("click", disconnectWallet);

  $("#claimTopBtn")?.addEventListener("click", claimTokens);
  $("#claimNowBtn")?.addEventListener("click", claimTokens);

  $("#verify-x")?.addEventListener("click",()=>verifyTask("x"));
  $("#verify-telegram")?.addEventListener("click",()=>verifyTask("telegram"));
  $("#verify-instagram")?.addEventListener("click",()=>verifyTask("instagram"));

  loadUserTasks();
});
