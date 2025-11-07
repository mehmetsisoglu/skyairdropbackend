/* ==========================
   Skyline Logic Airdrop v2.0 (Render Sürümü)
   ========================== */

// GÜNCELLENDİ: 'localhost' yerine canlı Render backend URL'si
const NODE_SERVER_URL = "https://skyairdropbackend.onrender.com"; 

const AIRDROP_CONTRACT = "0x316549D421e454e08040efd8b7d331C7e5946724";
const TOKEN_CONTRACT   = "0xa7c4436c2Cf6007Dd03c3067697553bd51562f2c";

// Gerekli Ağ (BNB Smart Chain)
const REQUIRED_CHAIN_ID = '0x38'; // 56 (BNB Mainnet)
const BNB_CHAIN_PARAMS = {
    chainId: '0x38',
    chainName: 'BNB Smart Chain',
    nativeCurrency: {
        name: 'BNB',
        symbol: 'BNB',
        decimals: 18
    },
    rpcUrls: ['https://bsc-dataseed.binance.org/'],
    blockExplorerUrls: ['https://bscscan.com']
};

// Airdrop Kontratınızın ABI'si
const AIRDROP_ABI = [
  {"inputs": [{"internalType": "address", "name": "_token", "type": "address"}], "stateMutability": "nonpayable", "type": "constructor"},
  {"anonymous": false, "inputs": [{"indexed": true, "internalType": "address", "name": "wallet", "type": "address"}, {"indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256"}], "name": "AirdropClaimed", "type": "event"},
  {"anonymous": false, "inputs": [{"indexed": true, "internalType": "address", "name": "owner", "type": "address"}, {"indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256"}], "name": "WithdrawRemaining", "type": "event"},
  {"inputs": [], "name": "amountPerWallet", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
  {"inputs": [{"internalType": "address", "name": "", "type": "address"}], "name": "claimed", "outputs": [{"internalType": "bool", "name": "", "type": "bool"}], "stateMutability": "view", "type": "function"},
  {"inputs": [], "name": "claimAirdrop", "outputs": [], "stateMutability": "nonpayable", "type": "function"},
  {"inputs": [], "name": "owner", "outputs": [{"internalType": "address", "name": "", "type": "address"}], "stateMutability": "view", "type": "function"},
  {"inputs": [{"internalType": "uint256", "name": "newAmount", "type": "uint256"}], "name": "setAmountPerWallet", "outputs": [], "stateMutability": "nonpayable", "type": "function"},
  {"inputs": [], "name": "token", "outputs": [{"internalType": "contract IERC20", "name": "", "type": "address"}], "stateMutability": "view", "type": "function"},
  {"inputs": [{"internalType": "address", "name": "newOwner", "type": "address"}], "name": "transferOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function"},
  {"inputs": [], "name": "withdrawRemainingTokens", "outputs": [], "stateMutability": "nonpayable", "type": "function"}
];


let provider, signer, airdrop, userWallet = null;

/* ------------------ Task List ------------------ */
const TASKS = [
  { id: "x", label: "Follow our X account & retweet the airdrop post", btnText: "Verify" },
  { id: "telegram", label: "Join our Telegram channel", btnText: "Join" },
  { id: "instagram", label: "Follow our Instagram and repost the airdrop post", btnText: "Follow" }
];
let completedTasks = [];

// === AĞ KONTROL VE DEĞİŞTİRME FONKSİYONU ===
async function checkAndSwitchNetwork() {
    if (!window.ethereum) return false;

    try {
        const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
        
        if (currentChainId === REQUIRED_CHAIN_ID) {
            return true;
        }

        showBanner("Please switch to BNB Smart Chain", "red");
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: REQUIRED_CHAIN_ID }],
        });

        return true;

    } catch (switchError) {
        if (switchError.code === 4902) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [BNB_CHAIN_PARAMS],
                });
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
      showBanner("Please install MetaMask", "red");
      return;
    }

    // GÜNCELLENDİ: Ethers v6, window.ethereum'u doğrudan alır
    provider = new ethers.BrowserProvider(window.ethereum);
    
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    userWallet = (await signer.getAddress()).toLowerCase();

    const networkOK = await checkAndSwitchNetwork();
    if (!networkOK) {
        showBanner("Please connect to BNB Smart Chain to continue.", "red");
    }
    
    // UI Update
    document.querySelector(".wallet-actions .btn").style.display = "none";
    document.getElementById("statusMsg").textContent = "Network: Connected";
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
// Veritabanından görevleri yükle
async function loadUserTasks() {
  if (!userWallet) return;
  try {
    // GÜNCELLENDİ: Artık canlı Render URL'sine bağlanıyor
    const res = await fetch(`${NODE_SERVER_URL}/get-tasks?wallet=${userWallet}`);
    if (!res.ok) {
      throw new Error(`Server error: ${res.statusText}`);
    }
    const data = await res.json();
    completedTasks = data.tasks || [];
    updateTaskUI();
    checkAllTasksCompleted();
  } catch (err) {
    console.warn("⚠️ loadUserTasks failed (Backend):", err);
  }
}

// Veritabanına görev kaydet
async function saveTaskToDB(taskId, btn) {
  try {
    const updatedTasks = [...completedTasks, taskId];
    
    // GÜNCELLENDİ: Artık canlı Render URL'sine bağlanıyor
    const res = await fetch(`${NODE_SERVER_URL}/save-tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: userWallet, tasks: updatedTasks })
    });
    const result = await res.json();

    if (result.success) {
      completedTasks = updatedTasks;
      btn.innerText = "Completed ✅";
      // CSS'teki .btn[disabled] stilini kullanmak için 'style.background'ı kaldır
      btn.disabled = true;
      showBanner(`✅ ${taskId.toUpperCase()} verified`, "green");
      checkAllTasksCompleted();
    } else {
      throw new Error(result.message || "Unknown Backend save error");
    }
  } catch (err) {
    console.error("Backend Save error:", err);
    const task = TASKS.find(t => t.id === taskId);
    btn.innerText = task ? task.btnText : "Verify";
    btn.disabled = false;
    showBanner("⚠️ Task could not be saved (Backend): " + err.message, "red");
  }
}

async function verifyTask(taskId) {
  if (!userWallet) {
    showBanner("⚠️ Connect your wallet first", "red");
    return;
  }
  
  const btnId = `verify-${taskId}`;
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const task = TASKS.find(t => t.id === taskId);

  if (completedTasks.includes(taskId)) {
    showModal("This task is already completed ✅");
    return;
  }

  // Tüm görevler için harici linki aç (X, Telegram, Instagram için ortak)
  if (taskId === 'x') window.open('https://x.com/SkylineLogicAI', '_blank');
  if (taskId === 'telegram') window.open('https://t.me/skylinelogic', '_blank');
  if (taskId === 'instagram') window.open('https://www.instagram.com/skyline.logic', '_blank');
  
  btn.innerText = "Verifying...";
  btn.disabled = true;

  // ******* X API LOGIC (Backend API kontrollü) *******
  if (taskId === 'x') {
    try {
      const username = prompt("Please enter your X (Twitter) username (without the @):");
      if (!username) {
        btn.innerText = task ? task.btnText : "Verify";
        btn.disabled = false;
        return; 
      }
      
      btn.innerText = "Checking X...";

      // GÜNCELLENDİ: Artık canlı Render URL'sine bağlanıyor
      const apiRes = await fetch(`${NODE_SERVER_URL}/verify-x`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username })
      });

      const apiData = await apiRes.json();

      if (!apiRes.ok) {
        throw new Error(apiData.message || 'X verification failed');
      }

      btn.innerText = "Saving...";
      await saveTaskToDB(taskId, btn);

    } catch (err) {
      console.error("X Verification error:", err);
      btn.innerText = task ? task.btnText : "Verify";
      btn.disabled = false;
      showBanner("❌ X Verification Failed: " + err.message, "red");
    }
  } 
  // ******* DİĞER GÖREVLER (Güvene Dayalı, ANINDA KAYIT) *******
  else {
    
    btn.innerText = "Saving...";
    // Güvene dayalı görevler için anında kaydet
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
      // CSS'teki .btn[disabled] stilinin uygulanması için style'ı kaldır
      // btn.style.background = "linear-gradient(90deg,#00ff99,#00cc66)";
    } else {
      btn.innerText = task.btnText;
      btn.disabled = false;
      // btn.style.background = "linear-gradient(90deg,#4a67ff,#8338ec)";
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
    buttons.forEach(btn => {
      btn.disabled = false;
      btn.textContent = "🚀 Claim $SKYL";
    });
    document.getElementById("airdropStatus").textContent = "All tasks completed! You are eligible to claim.";
    showBanner("🎯 All tasks completed! You can claim now.", "green");
    return true;
  } else {
    buttons.forEach(btn => {
      btn.disabled = true;
      btn.textContent = "Complete Tasks to Claim";
    });
    document.getElementById("airdropStatus").textContent = "Complete all tasks to become eligible.";
    return false;
  }
}

/* ------------------ Claim Process (GÜNCELLENDİ) ------------------ */

// YENİ: Başarılı claim'i backend'e bildirmek için yardımcı fonksiyon
async function notifyBackendOfClaim(wallet, airdropContract) {
  try {
    // 1. Claim miktarını kontrattan oku
    const amountWei = await airdropContract.amountPerWallet();
    
    // 2. Miktarı $SKYL formatına çevir (Token 18 decimal varsayılarak)
    // Ethers v6, formatUnits kullanır (v5'teki formatEther yerine)
    const amountSkyl = ethers.formatUnits(amountWei, 18); 

    // 3. Backend'e bildir (Telegram botunu tetiklemek için)
    await fetch(`${NODE_SERVER_URL}/notify-claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet: wallet,
        amount: amountSkyl 
      }),
    });
    console.log("Backend'e claim bildirimi gönderildi.");
  } catch (err) {
    console.warn("Backend'e bildirim gönderilemedi:", err);
    // Bu hatanın ana claim akışını durdurmaması önemli.
  }
}

async function claimTokens() {
  if (!userWallet || !signer) {
    showBanner("⚠️ Connect your wallet first", "red");
    return;
  }

  if (!checkAllTasksCompleted()) {
    showBanner("⚠️ Complete all tasks before claiming.", "red");
    return;
  }

  // Ağı kontrol et, doğru değilse dur
  const networkOK = await checkAndSwitchNetwork();
  if (!networkOK) {
      showBanner("Please switch to BNB Smart Chain to claim.", "red");
      return;
  }

  const buttons = [
    document.getElementById("claimTopBtn"),
    document.getElementById("claimNowBtn")
  ];

  try {
    buttons.forEach(btn => {
      if (btn) {
        btn.disabled = true;
        btn.innerText = "Waiting for signature..."; 
      }
    });

    const airdropContract = new ethers.Contract(AIRDROP_CONTRACT, AIRDROP_ABI, signer);

    const tx = await airdropContract.claimAirdrop();

    buttons.forEach(btn => {
      if (btn) btn.innerText = "Transaction pending...";
    });
    
    showBanner("Transaction submitted! Waiting for confirmation...", "green");

    await tx.wait(); // İşlemin onaylanmasını bekle

    // GÜNCELLENDİ: İşlem onaylandı, Telegram botunu tetikle
    // Bu, işlemin geri kalanını engellemez (await kullanıldı ama hata yakalama içinde)
    await notifyBackendOfClaim(userWallet, airdropContract);

    document.getElementById("claimSuccessPopup").style.display = "flex";

    buttons.forEach(btn => {
      if (btn) {
        btn.disabled = true;
        btn.innerText = "✅ Claimed";
        // CSS'teki .btn[disabled] stilinin uygulanması için style'ı kaldır
        // btn.style.background = "linear-gradient(90deg,#00ff99,#00cc66)";
      }
    });

  } catch (err) {
    console.error("❌ Claim error:", err);

    let errorMessage = "❌ Claim failed. Please try again.";
    
    // Ethers v6 hata yönetimi (reason veya shortMessage arar)
    if (err.code === 'ACTION_REJECTED') { 
      errorMessage = "⚠️ Transaction was rejected.";
    } 
    else if (err.reason) {
      if (err.reason.includes("Already claimed")) {
        errorMessage = "⚠️ You have already claimed this airdrop.";
      } else if (err.reason.includes("Insufficient airdrop balance")) {
        errorMessage = "❌ Airdrop pool is empty. Please contact support.";
      }
    }
    else if (err.message) {
      if (err.message.includes("Already claimed")) { 
        errorMessage = "⚠️ You have already claimed this airdrop.";
      }
    }

    showBanner(errorMessage, "red");

    buttons.forEach(btn => {
      if (btn) {
        btn.disabled = false;
        btn.innerText = "🚀 Claim $SKYL";
      }
    });
  }
}

/* ------------------ Helper Functions ------------------ */
function updateProfilePanel(addr) {
  const panel = document.getElementById("profile-panel");
  if (!panel) return;
  if (addr) {
    panel.style.display = "block";
    panel.querySelector("p").textContent =
      "Wallet: " + addr.slice(0, 6) + "..." + addr.slice(-4);
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
    </div>
  `;
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

// Leaderboard'u Veritabanından yükle
async function loadLeaderboard() {
    const container = document.getElementById("leaderboard-body");
    if (!container) return;

    try {
        // GÜNCELLENDİ: Artık canlı Render URL'sine bağlanıyor
        const res = await fetch(`${NODE_SERVER_URL}/get-leaderboard`); 
        if (!res.ok) throw new Error("Could not load leaderboard data.");

        const leaders = await res.json(); 
        
        container.innerHTML = ""; 

        if (leaders.length === 0) {
             container.innerHTML = `<p class="leaderboard-loading">No participants yet. Be the first!</p>`;
             return;
        }

        const medals = ['🏆', '🥈', '🥉'];

        leaders.forEach((leader, index) => {
            const row = document.createElement("div");
            row.className = "leaderboard-row";

            const shortWallet = leader.wallet.slice(0, 6) + "..." + leader.wallet.slice(-4);
            
            row.innerHTML = `
                <span>${medals[index] || (index + 1)}</span>
                <span>${shortWallet}</span>
                <span>${leader.points}</span>
            `;
            container.appendChild(row);
        });

    } catch (err) {
        console.error("Leaderboard load failed:", err);
        container.innerHTML = `<p class="leaderboard-loading" style="color:red;">Error loading leaderboard.</p>`;
    }
}


/* ------------------ Init ------------------ */
document.addEventListener("DOMContentLoaded", () => {
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

      sections.forEach(s => {
        s.classList.remove("active");
        if (s.id === targetId) {
          s.classList.add("active");
        }
      });
      
      if(targetId === 'leaderboard') {
          loadLeaderboard();
      }
    });
  });

  updateTaskUI();
  checkAllTasksCompleted();
  startCountdown();
});


/* ------------------ Countdown Function ------------------ */
function startCountdown() {
  // Set the date we're counting down to
  const countDownDate = new Date("2025-12-31T23:59:59Z").getTime(); 

  // Update the count down every 1 second
  const countdownElement = document.getElementById("countdown");
  if (!countdownElement) return;

  const interval = setInterval(() => {
    const now = new Date().getTime();
    const distance = countDownDate - now;

    if (distance < 0) {
      clearInterval(interval);
      countdownElement.innerHTML = "Airdrop Ended";
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    countdownElement.innerHTML =
      days +
      "d " +
      hours.toString().padStart(2, "0") +
      "h " + 
      minutes.toString().padStart(2, "0") +
      "m " +
      seconds.toString().padStart(2, "0") +
      "s ";
  }, 1000);
}