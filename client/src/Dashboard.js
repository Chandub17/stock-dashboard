import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import './index.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// -----------------------
// Helpers
// -----------------------
const getToken = () => localStorage.getItem('token');
const getEmail = () => localStorage.getItem('email');

function normalizePortfolio(portfolio) {
  if (!portfolio) return { cash: 0, realized: 0, holdings: [], unrealized: 0 };
  return {
    cash: Number(portfolio.cash || 0),
    realized: Number(portfolio.realized || 0),
    holdings: portfolio.holdings || [],
    unrealized: Number(portfolio.unrealized || 0)
  };
}

function recalcPortfolioWithPrices(portfolio, prices) {
  const holdings = portfolio.holdings.map(h => {
    const current = prices[h.ticker] ?? h.current_price ?? 0;
    const unrealized = +((current - h.avg_cost) * h.qty).toFixed(2);
    return { ...h, current_price: current, unrealized };
  });
  const unrealized = holdings.reduce((s, h) => s + h.unrealized, 0);
  return { ...portfolio, holdings, unrealized: +unrealized.toFixed(2) };
}

// -----------------------
// Chart options
// -----------------------
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#fff' } },
    tooltip: {
      backgroundColor: '#0b1220',
      titleColor: '#fff',
      bodyColor: '#e5e7eb'
    }
  },
  scales: {
    x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } },
    y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } }
  }
};

// -----------------------
// MAIN
// -----------------------
export default function Dashboard() {
  const email = getEmail();
  const token = getToken();

  const [connected, setConnected] = useState(false);
  const [supported, setSupported] = useState(['GOOG','TSLA','AMZN','META','NVDA']);
  const [prices, setPrices] = useState({});
  const [portfolio, setPortfolio] = useState({ cash:0, realized:0, holdings: [], unrealized:0 });
  const [selectedTicker, setSelectedTicker] = useState('GOOG');
  const [history, setHistory] = useState([]);
  const [qty, setQty] = useState(1);
  const [tradeMsg, setTradeMsg] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token) {
      window.location.href = '/login';
      return;
    }

    const socket = io({
      auth: { token },
      transports: ['websocket']
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('stockUpdate', p => {
      setPrices(p);
      setPortfolio(prev => recalcPortfolioWithPrices(prev, p));
    });

    socket.on('historyUpdate', all => {
      if (all[selectedTicker]) setHistory(all[selectedTicker]);
    });

    socket.on('portfolioUpdate', p => {
      setPortfolio(recalcPortfolioWithPrices(normalizePortfolio(p), prices));
    });

    fetch('/me', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => {
        setSupported(d.supported || supported);
        setPortfolio(recalcPortfolioWithPrices(normalizePortfolio(d.portfolio), prices));
      });

    return () => socket.disconnect();
  }, [token, selectedTicker]);

  async function doTrade(type) {
    setTradeMsg('');
    const res = await fetch('/trade', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({ type, ticker: selectedTicker, qty: Number(qty) })
    });
    const data = await res.json();
    setTradeMsg(res.ok ? `Order placed: ${type.toUpperCase()} ${qty} ${selectedTicker}` : data.error);
  }

  async function depositCash() {
    await fetch('/deposit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({ amount: Number(depositAmount) })
    });
    setDepositAmount('');
  }

  const chartData = {
    labels: history.map((_, i) => i + 1),
    datasets: [{
      label: selectedTicker,
      data: history,
      borderColor: '#c084fc',
      backgroundColor: 'rgba(192,132,252,0.1)',
      tension: 0.25
    }]
  };

  return (
    <div className="container">
      <div className="header">
        <div>
          <h2>MarketPulse</h2>
          <p className="muted">Live Trading & Portfolio Simulator</p>
        </div>
        <div>
          <strong>{email}</strong>
          <button className="btn small" onClick={() => {
            localStorage.clear();
            window.location.href = '/login';
          }}>
            Logout
          </button>
        </div>
      </div>

      <div className="note">
        📊 Simulated market environment for educational purposes
      </div>

      <div className="status">
        Market Feed: <span className={connected ? 'connected' : 'disconnected'}>
          {connected ? 'Live' : 'Offline'}
        </span>
      </div>

      <div className="cols">
        <div className="col">
          <h3>Market Watch</h3>
          <ul className="list">
            {supported.map(t => (
              <li key={t} className="list-item">
                <strong>{t}</strong>
                <span>${prices[t]?.toFixed(2) || '—'}</span>
                <button className="btn small" onClick={() => setSelectedTicker(t)}>View</button>
              </li>
            ))}
          </ul>
        </div>

        <div className="col">
          <h3>Price Movement — {selectedTicker}</h3>
          <div className="chart-card" style={{height:320}}>
            <Line data={chartData} options={chartOptions} />
          </div>

          <h3>Quick Trade</h3>
          <div style={{display:'flex',gap:8}}>
            <input type="number" value={qty} onChange={e => setQty(e.target.value)} />
            <button className="btn" onClick={() => doTrade('buy')}>Buy</button>
            <button className="btn" onClick={() => doTrade('sell')}>Sell</button>
          </div>
          <div className="muted">{tradeMsg}</div>

          <h3>My Holdings</h3>
          <table className="table">
            <thead>
              <tr><th>Stock</th><th>Qty</th><th>Price</th><th>P/L</th></tr>
            </thead>
            <tbody>
              {portfolio.holdings.map(h => (
                <tr key={h.ticker}>
                  <td>{h.ticker}</td>
                  <td>{h.qty}</td>
                  <td>${h.current_price.toFixed(2)}</td>
                  <td className={h.unrealized >= 0 ? 'pl-positive' : 'pl-negative'}>
                    {h.unrealized.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{marginTop:8}}>
            <strong>Cash:</strong> ${portfolio.cash.toFixed(2)} &nbsp;
            <strong>Unrealized:</strong> {portfolio.unrealized.toFixed(2)}
          </div>

          <div style={{marginTop:10}}>
            <input
              type="number"
              placeholder="Add funds"
              value={depositAmount}
              onChange={e => setDepositAmount(e.target.value)}
            />
            <button className="btn" onClick={depositCash}>Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}
