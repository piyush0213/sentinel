/**
 * SENTINEL Content Script (Live Interceptor)
 * Intercepts "Buy/Sell" clicks on broker websites (Groww, Kite, Shoonya),
 * analyzes the trade dynamically via the FastAPI backend, and injects interventions.
 */

// We store the original button target so we can click it if the user proceeds
let pendingTradeAction = null;
let isProceeding = false; // Flag to bypass interception

// Base HTML overlay structure
const createOverlayHTML = (patternName, score, message, symbol) => `
  <div id="sentinel-backdrop"></div>
  <div id="sentinel-card">
    <div class="sen-header">
      <div class="sen-pulse-icon">🛡️</div>
      <h2 class="sen-title">HOLD ON, RAHUL</h2>
      <p class="sen-subtitle">SENTINEL has detected a dangerous pattern</p>
    </div>

    <div class="sen-alert-box">
      <p class="sen-alert-label">DETECTED PATTERN</p>
      <h3 class="sen-alert-value">${patternName.toUpperCase()}</h3>
      <p style="color: #F87171; font-size: 12px; margin-top: 4px;">Risk Score: ${score}/100 · Symbol: ${symbol}</p>
    </div>

    <div class="sen-stats-box">
      <p class="sen-stats-title">Behavioral Insight:</p>
      <p style="color: #E2E8F0; font-size: 13px; line-height: 1.5; margin: 0;">${message}</p>
    </div>

    <div id="sen-timer-view">
      <div class="sen-timer-ring">
        <svg class="sen-timer-svg" viewBox="0 0 100 100">
          <circle class="sen-timer-bg" cx="50" cy="50" r="45"></circle>
          <circle id="sen-timer-circle" class="sen-timer-path" fill="transparent" cx="50" cy="50" r="45" stroke-dasharray="283" stroke-dashoffset="0"></circle>
        </svg>
        <div class="sen-timer-text">
          <span id="sen-timer-sec" class="sen-timer-val">10</span>
          <span class="sen-timer-lbl">seconds</span>
        </div>
      </div>
      <p style="text-align: center; color: #CBD5E1; font-size: 14px;">Take a breath. This trade can wait.</p>
    </div>

    <div id="sen-action-view" class="sen-buttons">
      <button id="sen-btn-cancel" class="sen-btn sen-btn-protect">🛡️ Cancel Trade — Protect My Money</button>
      <button id="sen-btn-proceed" class="sen-btn sen-btn-proceed">Proceed Anyway — I've Reconsidered</button>
    </div>
  </div>
`;

let overlayRoot = null;
let timerInterval = null;

function showOverlay(analysisData, symbol) {
  if (overlayRoot) return;

  const patternMap = {
    revenge_trade: 'Revenge Trade', fomo_trade: 'FOMO Trade', overtrading: 'Overtrading',
    panic_sell: 'Panic Sell', herd_trade: 'Social Tip / Herd', late_night_trade: 'Late Night Trade', normal: 'Normal Trade'
  };

  const patternDisplay = patternMap[analysisData.pattern] || 'Dangerous Pattern';

  overlayRoot = document.createElement('div');
  overlayRoot.id = 'sentinel-root';
  overlayRoot.innerHTML = createOverlayHTML(patternDisplay, analysisData.risk_score, analysisData.message, symbol);
  document.body.appendChild(overlayRoot);

  document.getElementById('sen-btn-cancel').onclick = () => {
    hideOverlay();
    pendingTradeAction = null; // Discard trade
  };

  document.getElementById('sen-btn-proceed').onclick = () => {
    hideOverlay();
    isProceeding = true;
    if (pendingTradeAction) {
      pendingTradeAction.click(); // Programmatically click the real button
      pendingTradeAction = null;
    }
  };

  setTimeout(() => overlayRoot.classList.add('active'), 10);
  startTimer();
}

function startTimer() {
  let timeLeft = 10;
  const circumference = 2 * Math.PI * 45;
  const circle = document.getElementById('sen-timer-circle');
  const secText = document.getElementById('sen-timer-sec');
  
  document.getElementById('sen-timer-view').style.display = 'block';
  document.getElementById('sen-action-view').classList.remove('active');

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft -= 1;
    secText.innerText = timeLeft;
    const progress = (10 - timeLeft) / 10;
    circle.style.strokeDashoffset = circumference * progress;

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      document.getElementById('sen-timer-view').style.display = 'none';
      document.getElementById('sen-action-view').classList.add('active');
    }
  }, 1000);
}

function hideOverlay() {
  if (overlayRoot) {
    overlayRoot.classList.remove('active');
    clearInterval(timerInterval);
    setTimeout(() => {
      overlayRoot.remove();
      overlayRoot = null;
    }, 500);
  }
}

// ── DOM INTERCEPTOR ──

document.addEventListener('click', async (e) => {
  // If we are programmatically triggering the click after the timer passes, let it go through
  if (isProceeding) {
    isProceeding = false;
    return;
  }

  // Find the closest clickable element (button, a, or div with button role)
  let target = e.target.closest('button, a, div[role="button"], div[class*="button_"], div[class*="btn"]');
  if (!target) return;

  const btnText = target.innerText?.toLowerCase() || '';
  
  // Magic Check: Is this a "Buy" or "Sell" button on a broker dashboard?
  // Groww & Kite usually have buttons that say "BUY", "SELL", "PLACE ORDER", "ADD MONEY"
  if (btnText.includes('buy') || btnText.includes('sell') || btnText.includes('place order')) {
    
    // Attempt to extract the stock name from the page
    // Groww puts stock name in h1. Kite puts it in context.
    const h1 = document.querySelector('h1');
    const symbol = h1 ? h1.innerText.substring(0, 15) : 'NIFTY / STOCK';

    // Intercept!
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    pendingTradeAction = target; // Save the button to click later

    console.log("🛡️ SENTINEL: Intercepting Trade ->", btnText, symbol);

    try {
      // Show loading state by greying out
      target.style.opacity = '0.5';
      
      // Request AI analysis via the background worker to bypass HTTPS strict blocks
      chrome.runtime.sendMessage({
        action: "analyzeTrade",
        payload: {
          symbol: symbol,
          quantity: 100, // Extracted or mocked
          trade_type: btnText.includes('buy') ? 'BUY' : 'SELL',
          current_portfolio_value: 500000,
          recent_trades_count: 5,
          last_loss_amount: 8000, // Forces the model to detect recent loss (Revenge Trade hook)
          last_loss_minutes_ago: 3,
          position_size_inr: 120000,
          followed_social_tip: false
        }
      }, (response) => {
        target.style.opacity = '1';

        if (response && response.success) {
          const analysis = response.data;
          if (analysis.intervention_needed) {
            showOverlay(analysis, symbol);
          } else {
            // If the AI says it's totally safe, immediately click it through for them
            isProceeding = true;
            target.click();
          }
        } else {
          console.error("SENTINEL Background Error:", response?.error);
          isProceeding = true;
          target.click();
        }
      });

    } catch (err) {
      console.error("SENTINEL API Error:", err);
      // Failsafe: if our backend is dead, don't break their trading platform
      target.style.opacity = '1';
      isProceeding = true;
      target.click();
    }
  }
}, true); // Use capture phase to guarantee we hit it first!

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideOverlay();
});

console.log("🛡️ SENTINEL Extension Running. Actively monitoring for trades.");
