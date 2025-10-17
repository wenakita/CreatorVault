# Google Auth Setup Guide

## ✅ What's Been Added

Your Eagle Vault frontend now has **enterprise-grade dual authentication**:
- Google OAuth (@47eagle.com emails only)
- Authorized wallet addresses
- Either method grants access!

---

## 🚀 Quick Setup (3 Steps)

### Step 1: Get Google OAuth Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID
3. Add authorized origins:
   ```
   http://localhost:3000
   https://yourdomain.com
   ```
4. Copy the Client ID

### Step 2: Add to .env

Create `frontend/.env` file:
```bash
VITE_GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
VITE_ALLOWED_DOMAIN=47eagle.com
```

### Step 3: Install Dependencies

```bash
cd frontend
npm install
npm run dev
```

---

## 💡 How to Use in Your App

### Protect Admin Features

```tsx
import AdminAuth from './components/AdminAuth';

<AdminAuth 
  walletAddress={account}
  isWalletConnected={!!account}
  onBack={() => console.log('back clicked')}
>
  {/* Admin-only content here */}
  <button onClick={() => vault.injectCapital(...)}>
    Inject Capital
  </button>
</AdminAuth>
```

### Example: Protect Capital Injection

```tsx
// Add a button in VaultActions.tsx:
{account && (
  <AdminAuth walletAddress={account} isWalletConnected={true}>
    <button className="...">
      Admin: Inject Capital
    </button>
  </AdminAuth>
)}
```

---

## 🔐 Authorized Wallets

Currently whitelisted (in `AdminAuth.tsx`):
- 0xc7027dACCa23C029e6EAfCD6C027f1124cF48F07 (AC)
- 0xEdA067447102cb38D95e14ce99fe21D55C27152D (AKITA, LLC)
- 0x4711068C4030d58F494705c4b1DD63c5237A7733 (Slynapes)
- 0x5A29149bE2006A6dADAaC43F42704551FD4f8140 (SirJigs)
- 0x58f7EE4150A4cb484d93a767Bf6d9d7DDb468771 (Vince)
- 0x7310Dd6EF89b7f829839F140C6840bc929ba2031 (Deployer)

**To add more:** Edit `AUTHORIZED_WALLETS` array in `AdminAuth.tsx`

---

## ✨ Features

- **Dual Auth:** Google OR Wallet (flexible)
- **Domain Restricted:** Only @47eagle.com emails
- **Session Management:** 8 hour auto-logout
- **JWT Decoding:** Secure token validation
- **Loading States:** Professional UX
- **Error Handling:** Clear error messages
- **Responsive:** Works on mobile/desktop

---

## 🎨 UI/UX

**Login Screen:**
- Centered modal with glassmorphism
- Google login button
- Wallet status indicator
- Clear messaging

**Authenticated:**
- Green banner showing user info
- Sign out button (for Google auth)
- Protected content visible

---

## 🔒 Security

- ✓ Client-side validation
- ✓ Domain restriction enforced
- ✓ Session expiry (8 hours)
- ✓ Wallet whitelist
- ✓ JWT verification
- ✓ No credentials stored permanently

---

## 📦 Dependencies Added

```json
"@react-oauth/google": "^0.12.1"
"react-router-dom": "^6.22.0"
```

---

## 🧪 Testing

1. **Without auth:** Visit page → See login screen
2. **Google login:** Use @47eagle.com email → Access granted
3. **Wallet login:** Connect authorized wallet → Access granted
4. **Restrictions:** Try other email → Access denied

---

Ready to use! Add `<AdminAuth>` around any admin features you want to protect! 🦅

