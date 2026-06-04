# TimeBox

**Decentralized time capsule. Encrypted on Walrus. Time-locked by Sui.**

Write a message. Pick a reveal date. Your words are encrypted in the browser, stored permanently on Walrus, and locked by a Move smart contract on Sui. No company holds the key. No server can unlock it early. Only the clock decides.

---

## How It Works

```
Browser              Backend              Walrus              Sui
  │                     │                    │                  │
  │── write message ──► │                    │                  │
  │                     │── AES-256-GCM ──►  │                  │
  │                     │   encrypt          │                  │
  │                     │── PUT /v1/blobs ──► │                  │
  │                     │◄── blobId ─────────│                  │
  │◄── blobId + key ────│                    │                  │
  │── seal(blobId, unlockTs) ───────────────────────────────►   │
  │   wallet signs tx                                           │
  │◄── Capsule object owned by wallet ─────────────────────── │
```

On reveal day: wallet connects → contract checks timestamp → Walrus serves blob → browser decrypts with locally stored key.

**The encryption key never touches the chain or the server.**

---

## Stack

| Layer | Technology | Role |
|---|---|---|
| Storage | [Walrus](https://walrus.xyz) | Encrypted blob storage, permanent and tamper-proof |
| Time-lock | [Sui](https://sui.io) | Move contract enforces unlock timestamp via on-chain clock |
| RPC | [Tatum](https://tatum.io) | Sui RPC endpoint for wallet queries and contract calls |
| Backend | Node.js + Express | Encryption, Walrus upload, Sui object queries |
| Frontend | Vanilla HTML/JS | Sui Wallet Standard, client-side AES-GCM decryption |

---

## Project Structure

```
timebox/
├── timebox-contract/       # Sui Move smart contract
│   ├── sources/
│   │   └── timebox.move    # Capsule object: seal / reveal / burn
│   └── Move.toml
├── timebox-backend/        # Express API
│   └── src/
│       ├── server.js
│       ├── config.js
│       ├── routes/
│       │   └── capsule.js  # POST /capsule, GET /capsule/:blobId/blob
│       └── services/
│           ├── walrus.js   # Walrus blob upload/download
│           ├── sui.js      # Sui object queries via @mysten/sui
│           └── encryption.js  # AES-256-GCM
└── timebox-frontend/       # Single-page app
    └── index.html          # Sui Wallet Standard, Web Crypto API
```

---

## Smart Contract

The `Capsule` object stores:
- `blob_id` — Walrus blob ID of the encrypted payload
- `unlock_timestamp_ms` — Unix ms after which the capsule is readable
- `owner` — original sealer address

Entry functions: `seal`, `reveal`, `burn`. The `reveal` function checks `clock::timestamp_ms(clock) >= unlock_timestamp_ms` — this is the only gate, and it's enforced by the Sui network clock, not any server.

---

## Setup

### 1. Deploy the contract

```bash
cd timebox-contract
sui client publish --gas-budget 100000000
# copy the published package ID
```

### 2. Backend

```bash
cd timebox-backend
cp .env.example .env
# fill in CONTRACT_ADDRESS, TATUM_API_KEY
npm install
npm run dev
```

### Environment variables

| Variable | Description |
|---|---|
| `PORT` | API port (default `4000`) |
| `FRONTEND_URL` | CORS origin for the frontend |
| `TATUM_API_KEY` | Tatum API key for Sui RPC |
| `CONTRACT_ADDRESS` | Deployed Move package ID |
| `SUI_NETWORK` | `testnet` or `mainnet` |
| `WALRUS_PUBLISHER_URL` | Walrus publisher endpoint |
| `WALRUS_AGGREGATOR_URL` | Walrus aggregator endpoint |
| `WALRUS_EPOCHS_DEFAULT` | Minimum storage epochs |

### 3. Frontend

Serve `timebox-frontend/` from any static server:

```bash
# set CONTRACT_ADDRESS in the module script at the bottom of index.html
python3 -m http.server --directory timebox-frontend 3333
```

Or set `window.TIMEBOX_API` at the top of `index.html` to point to your deployed backend.

---

## API

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Server status |
| `GET` | `/api/capsule/fee?unlockDate=YYYY-MM-DD` | Estimate WAL storage fee |
| `POST` | `/api/capsule` | Encrypt + upload to Walrus → returns `blobId` + `encryptionKey` |
| `GET` | `/api/capsule/address/:address` | List capsules owned by a Sui address |
| `GET` | `/api/capsule/:blobId/blob` | Fetch encrypted blob (checks time-lock if `capsuleId` provided) |

---

## Costs

| Action | Token | Why |
|---|---|---|
| Seal a capsule | **WAL** | Pays for Walrus blob storage epochs |
| Seal a capsule | **SUI** | Gas for the `seal()` contract call |
| Reveal / Burn | **SUI** | Gas for the `reveal()` / `burn()` contract call |

On testnet, the Walrus publisher is free and SUI gas is from the faucet.
