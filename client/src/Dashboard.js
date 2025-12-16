import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
} from 'chart.js';
import './index.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const getToken = () => localStorage.getItem('token');
const getEmail = () => localStorage.getItem('email');

function recalcPortfolio(p, prices) {
  const holdings = p.holdings.map(h => {
    const cp = prices[h.ticker] ?? h.current_price ?? 0;
    const pl = +((cp - h.avg_cost) * h.qty).toFixed(2);
    return { ...h, current_price: cp, unrealized: pl };
  });
  return {
    ...p,
    holdings,
    unrealized: +holdings.reduce((s, h) => s + h.unrealized, 0).toFixed(2)
  };
}

export default function Dashboard() {
  const token = getToken();
  const email = getEmail();

  const [connected, setConnected] = useState(false);
  const [prices, setPrices] = useState({});
  const [supported, setSupported] = useState(['GOOG','TSLA','AMZN','META','NVDA']);
  const [portfolio, setPortfolio] = useState({ cash:0, holdings:[], unrealized:0 });
  const [ticker, setTicker] = useState('GOOG');
  const [history, setHistory] = useState([]);
  const [qty, setQty] = useState(1);
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
      setPortfolio(prev => recalcPortfolio(prev, p));
    });

    socket.on('historyUpdate', h => {
      if (h[ticker]) setHistory(h[ticker]);
    });

    socket.on('portfolioUpdate', p => {
      setPortfolio(recalcPortfolio(p, prices));
    });

    fetch('/me', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => {
        setSupported(d.supported);
        setPortfolio(recalcPortfolio(d.portfolio, prices));
      });

    return () => socket.disconnect();
  }, [token, ticker]);

  async function trade(type) {
    await fetch('/trade', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({ type, ticker, qty: Number(qty) })
    });
  }

  const chartData = {
    labels: history.map((_, i) => i),
    datasets: [{
      label: `${ticker} Price`,
      data: history,
      borderColor: '#14b8a6',
      backgroundColor: 'rgba(20,184,166,0.15)',
      tension: 0.35
    }]
  };

  return (
    <div className="neo-container">
      <aside className="neo-sidebar">
        <h2>TradeSphere</h2>
        <p className="neo-muted">Market Control Panel</p>

        <div className="neo-status">
          Status: <span className={connected ? 'live' : 'offline'}>
            {connected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>

        <div className="neo-user">{email}</div>

        <button className="neo-logout" onClick={() => {
          localStorage.clear();
          window.location.href = '/login';
        }}>
          Logout
        </button>
      </aside>

      <main className="neo-main">
        <section className="neo-market">
          <h3>Market Snapshot</h3>
          <div className="neo-cards">
            {supported.map(s => (
              <div
                key={s}
                className={`neo-card ${ticker === s ? 'active' : ''}`}
                onClick={() => setTicker(s)}
              >
                <div>{s}</div>
                <strong>${prices[s]?.toFixed(2) || '--'}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="neo-chart">
          <Line data={chartData} />
        </section>

        <section className="neo-trade">
          <h3>Execute Trade</h3>
          <input type="number" value={qty} onChange={e => setQty(e.target.value)} />
          <div className="neo-actions">
            <button onClick={() => trade('buy')}>BUY</button>
            <button onClick={() => trade('sell')}>SELL</button>
          </div>
        </section>

        <section className="neo-portfolio">
          <h3>Holdings Overview</h3>
          <table>
            <thead>
              <tr><th>Stock</th><th>Qty</th><th>Price</th><th>P/L</th></tr>
            </thead>
            <tbody>
              {portfolio.holdings.map(h => (
                <tr key={h.ticker}>
                  <td>{h.ticker}</td>
                  <td>{h.qty}</td>
                  <td>${h.current_price.toFixed(2)}</td>
                  <td className={h.unrealized >= 0 ? 'pos' : 'neg'}>
                    {h.unrealized.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="neo-summary">
            Cash: ${portfolio.cash.toFixed(2)} | Unrealized: {portfolio.unrealized.toFixed(2)}
          </div>
        </section>
      </main>
    </div>
  );
}
