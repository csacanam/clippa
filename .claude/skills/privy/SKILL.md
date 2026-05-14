---
name: Privy
description: Use when building authentication systems, creating embedded wallets, managing wallet controls and policies, signing transactions, or integrating wallet infrastructure into web3 applications. Reach for this skill when implementing user onboarding, wallet creation, transaction signing, policy enforcement, or multi-signature authorization flows.
metadata:
    mintlify-proj: privy
    version: "1.0"
---

# Privy Skill Reference

## Product summary

Privy is a wallet and authentication infrastructure platform that enables developers to onboard users, create embedded wallets, and manage transaction signing with granular controls. Use Privy to authenticate users via email, social login, passkeys, or wallets; provision self-custodial embedded wallets across 50+ blockchains; and enforce policies that constrain what actions wallets can perform. The platform uses secure enclaves and key splitting to ensure only authorized parties can access wallet keys.

**Key files and commands:**
- Dashboard: https://dashboard.privy.io
- App ID and App Secret: Retrieved from Dashboard > Configuration > App settings
- Client SDKs: React (`@privy-io/react-auth`), React Native (`@privy-io/expo`), Swift, Android, Flutter, Unity
- Server SDKs: Node.js (`@privy-io/node`), Python (`privy-client`), Java, Go, Rust
- REST API: `https://api.privy.io/v1/` with Basic Auth (app ID:app secret)
- Primary docs: https://docs.privy.io

## When to use

Reach for this skill when:
- **Authenticating users**: Implementing login flows with email, SMS, OAuth, passkeys, or wallet-based authentication
- **Creating wallets**: Provisioning embedded wallets for users or application-controlled wallets via API
- **Signing transactions**: Executing RPC calls (eth_sendTransaction, signTransaction, etc.) on embedded or server-side wallets
- **Enforcing policies**: Setting transaction limits, allowlisting recipients, restricting contract interactions, or implementing time-bound rules
- **Managing signers**: Adding server-side signers to wallets for automated actions (limit orders, subscriptions, rebalancing)
- **Multi-signature flows**: Configuring key quorums that require multiple parties to approve transactions
- **Migrating users**: Importing existing users and wallets from other systems
- **Handling wallet events**: Setting up webhooks for transaction status, balance changes, or user authentication events

## Quick reference

### SDK initialization (React)

```tsx
import {PrivyProvider} from '@privy-io/react-auth';

<PrivyProvider
  appId="your-app-id"
  clientId="your-client-id"
  config={{
    embeddedWallets: {
      ethereum: {createOnLogin: 'users-without-wallets'}
    }
  }}
>
  {children}
</PrivyProvider>
```

### API authentication

All REST API requests require:
- **Authorization header**: `Authorization: Basic base64(appId:appSecret)`
- **App ID header**: `privy-app-id: your-app-id`
- **Optional signature header**: `privy-authorization-signature: <signature>` (for authorization key requests)

### Wallet creation (REST API)

```bash
curl -X POST https://api.privy.io/v1/wallets \
  -u "app-id:app-secret" \
  -H "privy-app-id: app-id" \
  -H "Content-Type: application/json" \
  -d '{
    "chain_type": "ethereum",
    "owner": {"user_id": "did:privy:xxxxx"},
    "policy_ids": ["policy-id"]
  }'
```

### Core concepts table

| Concept | Purpose | Example |
|---------|---------|---------|
| **User** | Authenticated identity with linked accounts (email, wallet, OAuth) | User logs in via email, can also link Discord account |
| **Embedded wallet** | Privy-managed wallet created for a user or app | User gets auto-created Ethereum wallet on login |
| **Owner** | Entity with full control (user, authorization key, or key quorum) | User owns their wallet; app owns treasury wallet |
| **Signer** | Additional party with scoped permissions to sign transactions | Server signer executes limit orders within policy limits |
| **Policy** | Rules constraining what actions a wallet can perform | Max $1000 per transfer; only to allowlisted addresses |
| **Authorization key** | P-256 keypair for server-side wallet control | App backend signs transactions with private key |
| **Key quorum** | Multi-signature threshold (m-of-n) for approval | 2-of-3 signers required to approve large transfers |

### Common SDK methods

| Task | React | Node.js |
|------|-------|---------|
| Get authenticated user | `usePrivy().user` | `privyClient.users().get(userId)` |
| Create wallet | `useCreateWallet().createWallet()` | `privyClient.wallets().create({...})` |
| Send transaction | `useEmbeddedWallet().sendTransaction()` | `privyClient.wallets().ethereum().sendTransaction()` |
| Get wallet balance | `useWallets().wallets[0].getBalance()` | `privyClient.wallets().getBalance(walletId)` |
| Create policy | Dashboard or API | `privyClient.policies().create({...})` |

## Decision guidance

### When to use embedded wallets vs. external wallets

| Scenario | Embedded | External |
|----------|----------|----------|
| New users with no crypto experience | ✓ Auto-create on login | ✗ Requires existing wallet |
| Users want to bring existing wallets | ✗ Not applicable | ✓ Connect MetaMask, Phantom |
| App controls wallet (treasury, agents) | ✓ Server-owned wallet | ✗ User retains control |
| Seamless UX without wallet setup | ✓ Keys in secure enclave | ✗ Requires wallet extension |
| User self-custody requirement | ✓ Can export keys | ✓ User always controls keys |

### When to use user owners vs. authorization keys

| Use case | User owner | Authorization key |
|----------|-----------|-------------------|
| Consumer app (user controls wallet) | ✓ User approves transactions | ✗ Not applicable |
| Server automation (limit orders, rebalancing) | ✓ With signer delegation | ✓ Server signs directly |
| Treasury/agent wallets (app controls) | ✗ Not applicable | ✓ App backend controls |
| Multi-sig approval (2-of-2 user + server) | ✓ User + auth key in quorum | ✓ Both sign requests |

### When to use policies vs. MFA

| Requirement | Policy | MFA |
|-------------|--------|-----|
| Prevent transactions over $1000 | ✓ Enforced in enclave | ✗ User can override |
| Require user confirmation for large transfers | ✗ No user interaction | ✓ User enters code |
| Restrict to allowlisted addresses | ✓ Automatic enforcement | ✗ No address checking |
| Protect against compromised keys | ✓ Limits damage scope | ✓ Adds verification step |

## Workflow

### 1. Set up your Privy app

1. Create app in Privy Dashboard
2. Copy **App ID** and **App Secret** from Configuration > App settings
3. Configure login methods (email, OAuth, wallet, etc.) in Authentication settings
4. Set allowed domains and redirect URIs for your app
5. Store App Secret securely (never expose in client code)

### 2. Implement user authentication

1. **Client-side (React)**: Wrap app with `PrivyProvider`, use `usePrivy().login()` to trigger login modal
2. **Server-side**: Verify user's access token using Privy's JWKS endpoint or SDK
3. **Custom auth**: If using your own auth provider, register JWKS endpoint in Dashboard > Authentication
4. Access authenticated user via `usePrivy().user` (client) or `privyClient.users().get(userId)` (server)

### 3. Create and manage wallets

1. **Auto-create on login**: Set `embeddedWallets.ethereum.createOnLogin: 'users-without-wallets'` in PrivyProvider config
2. **Manual creation**: Call `createWallet()` from client SDK or `wallets().create()` from server SDK
3. **Specify owner**: User ID for user-owned wallets; authorization key for app-controlled wallets
4. **Add signers**: Attach server signers to enable automated actions (limit orders, subscriptions)
5. **Retrieve wallet**: Use `useWallets().wallets` (client) or `wallets().get(walletId)` (server)

### 4. Configure policies and controls

1. **Create policy** in Dashboard or via API with rules for each RPC method
2. **Define rules**: Specify conditions (amount limits, recipient allowlists, contract restrictions)
3. **Attach to wallet**: Include `policy_ids` when creating wallet or updating wallet
4. **Test policy**: Send test transaction to verify policy enforcement
5. **Monitor violations**: Check API error responses for `policy_violation` errors

### 5. Sign and send transactions

1. **Client-side**: Use wallet SDK methods (`sendTransaction()`, `signMessage()`, etc.)
2. **Server-side with user owner**: Request user signing key via `/wallets/authenticate`, sign with user key + auth key
3. **Server-side with auth key owner**: Sign request with authorization key private key
4. **Multi-sig**: Collect signatures from all required signers, pass as comma-separated header
5. **Handle errors**: Check for `policy_violation`, `insufficient_funds`, `insufficient_correct_authorization_signatures`

### 6. Monitor and react to events

1. **Set up webhooks** in Dashboard > Webhooks tab
2. **Subscribe to events**: user.created, user.authenticated, transaction.confirmed, wallet.funds_deposited, etc.
3. **Implement handlers**: Process webhook payloads to update your app state
4. **Verify signatures**: Validate webhook signature using your app secret
5. **Handle retries**: Implement idempotency to handle duplicate webhook deliveries

## Common gotchas

- **App Secret exposure**: Never include App Secret in client code or version control. Use environment variables and server-side only.
- **Policy misconfiguration**: If a wallet has a policy, it must include rules for every RPC method the wallet will use. Missing rules default to DENY.
- **Missing authorization signatures**: Server-side requests to wallets with authorization key owners require `privy-authorization-signature` header. Omitting it returns `missing_or_empty_authorization_header`.
- **User key expiry**: User signing keys are time-bound. Don't cache them; request fresh keys for each transaction.
- **Signature payload mismatch**: When signing requests, ensure you're signing the exact payload (method, params, headers). Signing wrong data returns `zero_correct_authorization_signatures`.
- **Policy evaluation in enclave**: Policies are evaluated in the secure enclave before signing. A policy violation blocks the transaction before it reaches the network.
- **Automatic wallet creation limitations**: Auto-create only works with Privy's login modal, not with direct login methods (`loginWithCode`, `useLoginWithOAuth`). Use manual `createWallet()` for those flows.
- **Chain type mismatch**: Policies are chain-specific. A policy created for Ethereum won't apply to Solana wallets. Create separate policies per chain.
- **Rate limiting on wallet creation**: Wallet creation endpoints are rate-limited. Implement exponential backoff for retries.
- **Webhook delivery guarantees**: Webhooks are delivered at-least-once. Implement idempotency keys to handle duplicates.

## Verification checklist

Before submitting work with Privy:

- [ ] App ID and App Secret are correctly configured (Secret not exposed in client code)
- [ ] PrivyProvider wraps the entire app and `ready` state is checked before consuming Privy hooks
- [ ] Login methods are enabled in Dashboard and match your implementation
- [ ] Wallets are created with correct owner (user ID for user wallets, auth key for app wallets)
- [ ] Policies are attached to wallets and include rules for all RPC methods the wallet will use
- [ ] Authorization signatures are included in headers for requests requiring them
- [ ] User signing keys are requested fresh for each transaction (not cached)
- [ ] Error handling covers `policy_violation`, `insufficient_funds`, and authorization signature errors
- [ ] Webhooks are configured and handlers verify webhook signatures
- [ ] Transaction signing works end-to-end (test with small amounts first)
- [ ] Multi-sig flows collect all required signatures before submitting
- [ ] Idempotency keys are used for wallet creation and critical operations

## Resources

**Comprehensive navigation**: https://docs.privy.io/llms.txt

**Critical documentation pages**:
1. [Key Concepts](https://docs.privy.io/basics/key-concepts) — Understand authentication, wallets, owners, signers, and policies
2. [API Reference](https://docs.privy.io/api-reference/introduction) — Complete REST API with authentication and error codes
3. [Controls & Policies Overview](https://docs.privy.io/controls/overview) — Design wallet authorization and policy enforcement

---

> For additional documentation and navigation, see: https://docs.privy.io/llms.txt