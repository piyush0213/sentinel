# 🛡️ SENTINEL
**AI-Powered Behavioral Finance Protection Layer for Retail Traders**

[![Python 3.11](https://img.shields.io/badge/Python-3.11-blue.svg)](https://www.python.org/downloads/release/python-3110/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![React 18](https://img.shields.io/badge/React-18-blue.svg?logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF.svg?logo=vite)](https://vitejs.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Built for **Finvasia Innovation Hackathon 2026** at Chitkara University

## 🚨 The Problem
Indian retail options traders (F&O) face massive losses, with 90% of individual traders losing money according to SEBI. The root cause usually isn't a lack of technical knowledge, but **emotional and behavioral failures** during live trading. 

When traders experience a loss, they are prone to revenge trading, FOMO, panic selling, and overtrading. Traditional trading platforms execute these harmful orders without friction, leading to massive capital destruction. 

## 🛡️ The Solution: SENTINEL
**"Don't block trades. Give traders a mirror."**

SENTINEL wraps around existing brokerage platforms (like Shoonya) as an intelligent, real-time protection layer. Instead of outright blocking users, SENTINEL analyzes every action, detects dangerous behavioral patterns, and intervenes with psychological circuit breakers before the mistake is made.

### 🌟 Key Features
- **🧠 Behavioral ML Model**: A Random Forest Classifier trained to detect 7 distinct emotional trading patterns (revenge trading, FOMO, overtrading, late-night trading, panic selling, herd trading).
- **⏱️ Psychological Circuit Breaker**: The "CoolDown Card" intercepts dangerous trades with a 60-second breathing exercise and confronts the user with their own historical loss rates for that specific pattern.
- **⚡ Live Risk Scoring**: Real-time composite risk score (0-100) combining loss recency, trade frequency, position sizing, time of day, and social media influence.
- **📉 Portfolio Stress Tester**: Simulates how existing portfolios would behave under historical crashes (2008 Crisis, 2020 COVID Crash, flash crashes) and recommends hedges.
- **🕵️ Misinformation Shield**: NLP-powered tip checker that analyzes forwarded tips for pump-and-dump signals, urgency manipulation, and SEBI compliance red flags.
- **💬 AI Finance Coach**: Interactive chatbot powered by OpenAI that explains trading concepts simply (with Indian market context) but never provides specific buy/sell advice.
- **🌐 Browser Extension Layer**: A dynamic MV3 Chrome extension that acts as a real-time DOM interceptor. It natively listens for 'Buy/Sell' clicks on live broker websites (Groww, Shoonya, Kite) and directly injects the Sentinel intervention UI over the active DOM to prevent the trade.

---

## 🏗️ Architecture

```mermaid
graph TD
    User([🧑‍💻 Retail Trader]) <-->|Interacts| Frontend
    
    subgraph "Frontend Layer"
        Frontend[⚛️ React Dashboard<br/>Vite + Tailwind + Recharts]
        Extension[🧩 Chrome Extension<br/>Live Click Interceptor]
    end

    Frontend <-->|REST API / JSON| Backend
    Extension <-->|Service Worker Fetch| Backend
    
    subgraph "SENTINEL Backend (Python/FastAPI)"
        Backend[⚡ FastAPI Gateway]
        Backend --> MLEngine[🧠 ML Engine<br/>RandomForest Classifier]
        Backend --> RiskEngine[🚦 Risk Engine<br/>Composite Scoring]
        Backend --> Misinfo[🕵️ Misinfo Shield<br/>NLP & Heuristics]
    end
    
    Backend <--> Data[(Brokerage Data<br/>Shoonya API)]
```

---

## 🛠️ Tech Stack
| Tier | Technologies |
|------|--------------|
| **Backend** | Python 3.11, FastAPI, Uvicorn |
| **Data/ML** | Scikit-Learn, Pandas, NumPy, Joblib |
| **Frontend** | React 18, Vite, TailwindCSS (v3), Recharts, Lucide Icons |
| **AI Services** | OpenAI API (gpt-4o-mini) |

---

## 🚀 Setup Instructions

### Prerequisites
- Node.js 20+
- Python 3.11+
- OpenAI API Key (for the chatbot)

### 1. Backend Setup
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt

# Start the FastAPI server (will auto-train ML model & generate mock data on first run)
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend Setup
```bash
cd frontend
npm install

# Create environment variables (Optional but needed for AI Coach)
echo "VITE_OPENAI_API_KEY=your_key_here" > .env

# Start the Vite development server
npm run dev
```
The application will be available at `http://localhost:5173/` or `http://localhost:5174/`.

---

## 🔌 API Documentation / Examples

Start the backend and then test with `curl` or `httpie`:

**1. Analyze a Trade**
```bash
curl -X POST http://localhost:8000/api/analyze-trade \
  -H "Content-Type: application/json" \
  -d '{"symbol": "BANKNIFTY", "quantity": 50, "trade_type": "BUY", "current_portfolio_value": 500000, "recent_trades_count": 4, "last_loss_amount": 3200, "last_loss_minutes_ago": 4, "position_size_inr": 85000, "followed_social_tip": false}'
```

**2. Check Stock Tip for Misinformation**
```bash
curl -X POST http://localhost:8000/api/check-tip \
  -H "Content-Type: application/json" \
  -d '{"tip_text": "🚀🚀 BUY XYZ PHARMA NOW!! Will give 10x returns. Guaranteed profits!!"}'
```

**3. Get Live Risk Score**
```bash
curl http://localhost:8000/api/risk-score/user_001
```

**4. Run Portfolio Stress Test**
```bash
curl -X POST http://localhost:8000/api/stress-test \
  -H "Content-Type: application/json" \
  -d '{"portfolio_value": 500000, "positions": [{"symbol": "HDFC", "value": 75000, "sector": "Banking"}], "scenario": "2008_crisis"}'
```

---

### 3. Chrome Extension Setup (Real-Time UI Blocking)
If you wish to demo the real-time interceptor instead of the main React Dashboard:
1. Open Google Chrome and go to `chrome://extensions/`.
2. Turn on **Developer mode** in the top right.
3. Click **Load unpacked** and select the `sentinel/extension` folder.
4. Open a broker site (e.g., `groww.in/options/nifty/...`). Keep your local FastAPI server running.
5. Watch the magic happen when you click a "Buy" button!

---

## 🎬 Live Demo Instructions
During the Hackathon judging, you have two pitch options:

**1. The Application Pitch:** Click the **"Live Demo Mode"** button in the React dashboard sidebar. This triggers a sequenced story:
* **Safe State:** Dashboard loads with a low risk score.
* **First Loss:** A normal trade registers a loss. Risk score increments.
* **Revenge Trade:** 3 seconds later, a massive trade is placed. The AI intercepts it, triggers the breathing exercise overlay, and shows the user their historical win rate for Revenge Trades (~12%).

**2. The Native Pitch:** Load the **Chrome Extension**. Tell the judges that Finvasia could run this as a native DOM wrapper. Go to `groww.in` and click "Buy". The extension will violently blur the UI and blast the Cool-Down sequence natively onto the live web page!

---

## 👥 Meet the Team
**Finvasia Hackathon 2026**
- *Prachi Bhardwaj* - Frontend Developer
- *Piyush Prajapati* - Backend Developer

## 📄 License
[MIT License](LICENSE)
