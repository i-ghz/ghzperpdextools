---
title: Vest Exchange
tags: [DEX, perpetuals, zkRisk, AMM, funding, L2, trading, crypto, Vest, RWA]
updated: 2025-06
language: en
---

# Vest Exchange — Deep Dive

Vest is a **trustless, composable perpetual DEX** powered by zkRisk, a zero-knowledge risk engine, built for deep liquidity, extreme capital efficiency, and explicit risk transparency.

## 🚀 TL;DR (Key Facts)
- **DEX type**: Perpetuals-only, taker-only, no classic orderbook
- **Pricing engine**: zkRisk (risk-based, EVaR, fully zk-SNARK verified)
- **Liquidity**: Internal AMM + LP pool (no peer-to-peer, no open interest caps)
- **Assets**: 40+ pairs (crypto, indices, FX, commodities, RWAs)
- **KYC**: None (connect EVM/Solana wallet)
- **Networks**: Arbitrum, Base, BSC, Ethereum, Optimism, Polygon, zkSync

---

## 1. **Introduction**
**Vest** is a next-generation decentralized derivatives exchange, built on the zkRisk engine, offering trustless trading and risk management. Vest aims to eliminate systemic risk, market manipulation, and liquidity bottlenecks found in legacy DeFi protocols.

---

## 2. **Architecture & Technology**

### **2.1 zkRisk Engine**
- **zkRisk** is Vest’s transparent, risk-based pricing engine leveraging zero-knowledge proofs (ZKPs)
- Continuously monitors positions, exposures, and system risk across all products
- All computations (funding, liquidation, mark price) are zk-SNARK verified on-chain

### **2.2 AMM Design**
- **Taker-only AMM**: All trades executed against Vest's internal liquidity pool
- **No maker/taker rebates**, no on-chain order book, instant execution
- **No OI caps**: Unlimited position sizing (subject to margin)

### **2.3 On-chain vs Off-chain**
- **On-chain**: Balances, margins, open positions, liquidation thresholds, risk proofs, price oracles
- **Off-chain**: Order matching/routing, price updates, risk scoring

### **2.4 Oracle Mechanism**
- Median price from Binance, OKX, Bybit (depth-weighted, manipulation-resistant)
- Validators publish prices on-chain, subject to slashing

---

## 3. **Supported Assets & Networks**
- **Markets**: 40+ perpetual pairs (BTC, ETH, SOL, indices, FX, RWAs)
- **Chains**: Arbitrum, Base, BSC, Ethereum, Optimism, Polygon, zkSync
- **Wallets**: MetaMask, Rabby, Coinbase, Phantom, Solflare

---

## 4. **Trading Details**

### **Order Types**
- Market, Limit, Reduce Only, GTC, FOK, Take Profit, Stop Loss

### **Margin & Leverage**
- **Default**: Cross margin (capital shared across all positions)
- **Initial margin**: Market-specific (check UI or API)
- **Maintenance margin**: 50% of initial margin
- **Liquidation**: Always partial, zero penalty, optimized for minimum loss

### **Fees & Funding**
- **Trading fee**: 0.01% (on open & close, no difference taker/maker)
- **Risk premium**: Charged if position increases system risk (EVaR); rebate if risk is reduced
- **Funding rate**: Per-market, dynamic, proportional to share of system risk (Euler allocation)
- **No withdrawal fee** (except LPs: 8h lockup on withdrawals)

### **Deposits & Withdrawals**
- **USDC only**, multiple networks supported
- **No minimum deposit**
- Withdrawals: instant for users, 8h lockup for LPs

---

## 5. **Risk Management & Security**

### **Risk Controls**
- **Mark price**: Calculated with EVaR, manipulation-resistant
- **Partial liquidation**: Minimizes losses, prevents cascades
- **Protection buffer**: Absorbs trader losses before LP capital

### **Smart Contract Security**
- Audited by OtterSec ([Audit link](https://osec.io/))
- zk-SNARKs enforce solvency and fair pricing
- All margin, balance, and liquidation logic on-chain

### **Known Risks**
- Smart contract bugs
- Oracle manipulation
- L2 infrastructure risk
- Low-liquidity tail assets (some are isolated from main pool)

---

## 6. **LPs & Yield**

### **How to Provide Liquidity**
- **Deposit USDC** into unified pool
- Earn yield from trading fees, risk premia, funding

### **LP Protections**
- LPs do NOT lose from aggregate trader losses (unlike PvP DEXs)
- Buffer absorbs most volatility spikes
- 8h withdrawal lock for stability

---

## 7. **Points, Referrals, and Community**

- **Points**: Weekly rewards for traders & LPs (can be checked on Vest Points page)
- **Referrals**: Earn a % of referrals’ points
- **Ignite Rewards**: Boosted LP yield campaign
- **No explicit airdrop announced as of 06/2025**

---

## 8. **Advanced / API**

- **REST & WS API**: All market, user, LP, funding data available ([API docs](https://docs.vest.exchange/api))
- **No API key required** for public endpoints (trades, ticker, funding)
- Private endpoints: require registration with wallet signature

---

## 9. **Strengths / Weaknesses**

### **Strengths**
- No KYC, direct wallet connection
- Fast (500ms latency, 1,000+ tps)
- Manipulation-proof pricing
- Transparent, verifiable risk and solvency
- LPs protected from PvP
- Partial liquidations only, no penalties
- Rich API, easy data access
- Multi-chain support

### **Weaknesses**
- No classic orderbook, no spot market (yet)
- Some assets with low liquidity
- Single validator (progressive decentralization roadmap)
- No custom margin mode selection (as of 06/2025)

---

## 10. **Common Questions (LLM ready)**

### Q: What are the trading fees on Vest?
A: 0.01% (1bps) on each trade, both open and close.

### Q: Does Vest require KYC?
A: No. Only a supported EVM or Solana wallet is needed.

### Q: How is risk managed?
A: All risk is dynamically managed via the zkRisk engine, with on-chain proofs, partial liquidation, and real-time funding.

### Q: Can I provide liquidity as an LP?
A: Yes, LPs supply USDC, earn fees, and benefit from protection buffers. LP withdrawals are locked for 8 hours.

### Q: How is funding rate calculated?
A: Funding is proportional to each market’s share of total system risk (see Funding > Euler allocation).

### Q: Are funds safe?
A: Vest is audited, but DeFi risk remains. zkSNARKs ensure transparency; all funds are managed by smart contracts.

---

## 11. **Links & Resources**

- [Main Site](https://vest.exchange)
- [Trading UI](https://trade.vest.exchange)
- [Docs](https://docs.vest.exchange)
- [API](https://docs.vest.exchange/api)
- [Discord](https://discord.gg/vestexchange)
- [Audit OtterSec](https://osec.io/)
- [Twitter/X](https://x.com/vestexchange)

---

_Last updated: June 2025_
