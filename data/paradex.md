---
title: Paradex Exchange
tags: [DEX, perpetuals, Starknet, non-custodial, orderbook, RPI, margin, liquidation, Paradex, options]
updated: 2025-06
language: en
---

# Paradex Exchange — Knowledge Base

Paradex is a non-custodial, orderbook-based perpetual futures exchange on Starknet L2, combining CEX-level performance with on-chain security and self-custody.

## 🚀 TL;DR (Key Facts)
- **Type**: Non-custodial, perpetuals DEX (orderbook)
- **Network**: Starknet Layer 2 (soon AppChain/SuperChain)
- **Wallets**: Argent, Braavos (Starknet-native, account abstraction)
- **No KYC**: Full self-custody, assets always under user control
- **Performance**: Fast matching via hybrid architecture, CEX-like UX
- **Innovations**: Retail Price Improvement (RPI), perpetual options, portfolio margin

---

## 1. Getting Started

### What is Paradex?
Paradex is a non-custodial orderbook for perpetual futures, built on Starknet. It delivers a centralized exchange (CEX)-like experience but keeps users in full control of their assets. All trades and settlements occur on Starknet L2; users deposit collateral in Paradex’s smart contract and trade any available market.

**Key features:**
- Near-CEX speed, orderbook experience
- Self-custody: user always controls assets
- Transparent, trust-minimized, on-chain logic
- Portfolio-level cross-margining
- Liquidations fully on L2 for maximum efficiency

### Roadmap
**Phase 1 (2024): SuperDEX**
- Perpetual options (high leverage, no liquidation risk)
- Passive yield vaults
- Retail Price Improvement (RPI)
- $DIME points program & future token

**Phase 2 (2025+): SuperChain**
- Migration to dedicated AppChain (custom L1)
- Full sequencer & governance decentralization
- Institutional privacy features
- Expansion: prediction markets, RWA, lending, more

### Wallet Integration
- Use Argent or Braavos wallet (Starknet)
- Connect at [trade.paradex.trade](https://trade.paradex.trade)
- Approve on browser extension
- On first connection, deploy your on-chain account
- Optionally, set up a "trading key" for gasless trading

### Official Links
- [Main Exchange](https://www.paradex.trade/)
- [Docs](https://docs.paradex.trade/)
- [Twitter](https://twitter.com/tradeparadex)
- [Discord](https://discord.gg/tradeparadex)
- [Blog](https://www.paradex.trade/blog)
- [GitHub](https://github.com/tradeparadex)

---

## 2. Architecture Overview

Paradex uses a **hybrid model**:
- **Frontend**: User trading interface
- **Sequencer**: Off-chain orderbook, matches orders, submits to L2 for settlement
- **Starknet smart contracts**: On-chain custody, margin, liquidation, settlement
- **Bridge contract (L1 Ethereum)**: Move funds between Ethereum and Starknet

**Benefits**:  
- CEX-like UX and speed  
- True self-custody  
- Full transparency and auditability  
- No risk of sequencer theft (all assets secured by smart contract)

---

## 3. Trading Features

### Retail Price Improvement (RPI)
RPI orders guarantee that retail users get execution at equal or better prices than top CEXs (Binance, OKX, etc).  
**How it works:**
- When placing an RPI order, it’s not matched immediately with the public book
- Professional market makers compete in a private auction to fill your order
- Fill only happens if price is *inside* the spread of reference CEXs
- No fill? Order expires, nothing is executed

**Advantages:**
- 0% taker fees
- Guaranteed no negative slippage
- Protected from MEV and front-running

**Limitations:**
- No guaranteed execution if no matching liquidity

### Perpetual Options
Paradex offers "perpetual options" — derivatives with:
- **No expiry**: Hold as long as you want
- **No liquidation**: Max loss is your paid premium
- **Implied leverage**: Small premium for large underlying exposure
- **Funding rate**: Instead of expiry, positions pay/earn funding (as with perps)

Perfect for speculation with limited risk or hedging.

### Order Types
- **Market order**: Immediate execution at best available price
- **Limit order**: Set your price, may not fill immediately
- **Stop loss / Take profit**: Conditional close orders
- **Reduce only**: Only closes/reduces your position, never reverses direction

### Trading Fees
- **RPI orders**: 0% fee
- **Maker**: -0.005% (you’re paid to add liquidity)
- **Taker**: 0.03%
- **Liquidation**: Extra penalty applies

Fees are volume-based (30d rolling); XP points and token holdings can bring further discounts.

### Margin Calculator
In-app tool to simulate the impact of trades:
- Input size, entry price, leverage
- See required margin, estimated liquidation price, health of portfolio

---

## 4. Risk & Liquidations

### Margin System
- **Cross-margin portfolio**: All positions share a single collateral pool; profits offset losses automatically.
- **Portfolio margin**: System considers correlations, netting risk across all positions for more efficient capital usage.
    - **Initial margin**: Required to open new positions
    - **Maintenance margin**: Required to keep positions open (drop below = liquidation)

### Mark Price
- Based on price indices from multiple CEXs (Binance, OKX, Bybit)
- Includes a funding basis component
- Formula: `Mark Price = Index Price + Funding Basis`
- Protects against manipulation, prevents unfair liquidations

### Liquidations
- Triggered when margin < maintenance margin
- Account is locked; no new orders or withdrawals
- Paradex liquidation engine takes over, closes positions orderly (via limit orders)
- Liquidation penalty goes to insurance fund

### Funding Mechanism
- Funding rate paid/received periodically between longs and shorts (typically hourly)
- Keeps perp prices anchored to spot
    - Positive rate: Longs pay shorts (perp > spot)
    - Negative: Shorts pay longs (perp < spot)
- Peer-to-peer; Paradex takes no cut

### Auto-Deleveraging (ADL)
- If insurance fund is depleted, profitable/highly-leveraged traders on the other side may have positions forcibly closed at bankruptcy price to cover losses.

---

## 5. XP, Referrals & Affiliates

### XP (Xperience Points)
- Core of Paradex’s rewards system
- Earned from trading (proportional to fees paid × multiplier), and via referrals
- Will play a central role in future airdrops (esp. $DIME token)
- Leaderboards and potential fee/feature unlocks

### Referral Program
- Each user gets a referral code
- Earn % of your referrals’ XP as passive rewards
- Referrals also receive welcome bonuses or fee discounts

### Affiliate Program
- Tailored for influencers/content creators
- Higher reward rates (up to 40%+)
- Detailed analytics dashboard, dedicated support
- Customizable commission structures

---

## 6. Security & Trust

### Security Lockdown
- Optional security mode: Imposes a 48h delay on sensitive actions (withdrawals, adding guardian keys, disabling lockdown)
- If your main key is compromised, you’re notified and can use your Guardian Key to veto malicious actions during the window

### Guardian Keys
- Secondary recovery key, separate from main wallet
- Can only veto pending sensitive actions, not transact/trade

### Audits & Pentests
- All contracts audited by leading firms (Nethermind, Real-time Verification)
- Public audit reports, regular pentests on infra/API

### Bug Bounty
- Ongoing bug bounty (Immunefi, etc.), significant rewards for critical bug discovery

---

## 7. Paradex Chain & Ecosystem

### Paradex Chain (SuperChain)
- Vision: Dedicated, customizable AppChain for max performance (no blockspace competition, tailored gas/fee structure)
- Decentralized sequencer (removes last centralization point)
- Built for censorship resistance and high-frequency trading

### Starknet Ecosystem
- Wallets: Argent, Braavos (support account abstraction)
- Bridges: StarkGate (official), Orbiter Finance (third-party)
- Price Oracles: Uses Stork (Starknet native) and Pyth, aggregating multiple CEX/DEX feeds for reliability and anti-manipulation

---

## 8. Fees Summary

| Action             | Fee         | Notes                                      |
|--------------------|-------------|--------------------------------------------|
| Maker              | -0.005%     | You’re paid to add liquidity (limit orders)|
| Taker              | 0.03%       | Immediate execution (market orders)        |
| RPI Order          | 0%          | Zero fees, only if price improved vs CEX   |
| Liquidation        | Extra fee   | Paid to insurance fund                     |

---

## 9. FAQ (LLM-ready)

**Q: Do I need KYC to trade?**  
A: No, Paradex is fully non-custodial and KYC-free. Use a supported Starknet wallet.

**Q: What wallets are supported?**  
A: Argent, Braavos (Starknet-native).

**Q: Is my collateral safe?**  
A: Yes; all user funds are managed by audited smart contracts, never by Paradex itself.

**Q: How does the RPI work?**  
A: Professional market makers compete to fill retail orders at better-than-CEX prices. If no match, the order simply expires.

**Q: Can I earn passive rewards?**  
A: Yes; XP points for trading, referral rewards, and affiliate program. Future airdrops likely based on XP.

---

## 10. Useful Links

- [Paradex Exchange](https://www.paradex.trade/)
- [Docs](https://docs.paradex.trade/)
- [Trade](https://trade.paradex.trade)
- [Discord](https://discord.gg/tradeparadex)
- [Audit Reports](https://docs.paradex.trade/security/audits)
- [Twitter/X](https://twitter.com/tradeparadex)

---

_Last updated: June 2025_
