# TradeSphere – Real-Time Trading Dashboard

TradeSphere is a full-stack web application that simulates real-time stock trading using modern web technologies. The application provides live market data updates, portfolio tracking, and trading functionality in a single-page interface.

## Live Application
https://stock-dashboard-clyc.onrender.com

## Key Features
- Secure user authentication using JWT
- Live stock price updates using WebSockets (Socket.IO)
- Supported stocks: GOOG, TSLA, AMZN, META, NVDA
- Buy and sell stocks with virtual currency
- Real-time unrealized profit/loss calculation
- Interactive stock price visualization
- Transaction history tracking
- Trending stock indication based on price movement
- Multi-user support with independent portfolios

## Technology Stack
Frontend:
- React.js
- Chart.js
- Socket.IO Client
- Custom CSS (dark themed UI)

Backend:
- Node.js
- Express.js
- Socket.IO
- SQLite database

## Local Setup
```bash
git clone https://github.com/<your-username>/stock-dashboard.git
cd stock-dashboard
cd server
npm install
node server.js
