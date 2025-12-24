# Cloudflare Setup Guide for CreatorVault.fun

## 🎯 Overview
Connect your `creatorvault.fun` domain from Cloudflare to your Vercel deployment.

---

## 📋 Prerequisites

- ✅ Domain: `creatorvault.fun` registered on Cloudflare
- ✅ Vercel project deployed at: `creator-vault-blush.vercel.app`
- ✅ Access to Cloudflare dashboard

---

## 🔧 Step 1: Add Domain in Vercel

1. Go to: https://vercel.com/akita-llc/creator-vault/settings/domains
2. Click **"Add"**
3. Enter: `creatorvault.fun`
4. Click **"Add"**
5. Vercel will show you the DNS records needed

**Expected Output:**
```
A Record:    76.76.21.21
CNAME:       cname.vercel-dns.com
```

---

## 🌐 Step 2: Configure Cloudflare DNS

### Go to Cloudflare Dashboard
https://dash.cloudflare.com/ → Select `creatorvault.fun`

### DNS Records to Add

#### **Option A: Using A Record (Recommended for Cloudflare)**

1. Click **DNS** in left sidebar
2. Click **Add record**
3. Add these records:

**Root Domain (@):**
```
Type:    A
Name:    @
IPv4:    76.76.21.21
Proxy:   ✅ Proxied (Orange cloud)
TTL:     Auto
```

**WWW Subdomain:**
```
Type:    CNAME
Name:    www
Target:  creatorvault.fun
Proxy:   ✅ Proxied (Orange cloud)
TTL:     Auto
```

#### **Option B: Using CNAME (Alternative)**

**Root Domain (@):**
```
Type:    CNAME
Name:    @
Target:  cname.vercel-dns.com
Proxy:   ✅ Proxied (Orange cloud)
TTL:     Auto
```

**WWW:**
```
Type:    CNAME
Name:    www
Target:  cname.vercel-dns.com
Proxy:   ✅ Proxied (Orange cloud)
TTL:     Auto
```

---

## 🔒 Step 3: SSL/TLS Settings

### In Cloudflare Dashboard:

1. Go to **SSL/TLS** section
2. Set encryption mode:
   ```
   SSL/TLS Encryption Mode: Full (strict)
   ```

3. Enable these settings:
   - ✅ Always Use HTTPS
   - ✅ Automatic HTTPS Rewrites
   - ✅ Minimum TLS Version: 1.2
   - ✅ TLS 1.3: Enabled

4. **Edge Certificates:**
   - ✅ Always Use HTTPS: ON
   - ✅ HTTP Strict Transport Security (HSTS): Enable
     - Max Age: 12 months
     - Include subdomains: ON
     - Preload: ON
     - No-Sniff header: ON

---

## ⚡ Step 4: Performance Optimization

### Speed Settings

Go to **Speed** → **Optimization**

Enable:
- ✅ Auto Minify
  - ✅ JavaScript
  - ✅ CSS
  - ✅ HTML
- ✅ Brotli (better compression than gzip)
- ✅ Early Hints
- ✅ HTTP/2 to Origin
- ✅ HTTP/3 (QUIC)

### Caching

Go to **Caching** → **Configuration**

```
Browser Cache TTL: Respect Existing Headers
```

**Cache Rules** (optional, for static assets):
```
Rule: Cache Everything
If: URI Path matches *.js OR *.css OR *.svg OR *.png
Then: Cache Level = Standard
       Edge TTL = 1 month
```

---

## 🛡️ Step 5: Security Settings

### Firewall Rules

Go to **Security** → **WAF**

**Recommended Settings:**
- Security Level: Medium
- Bot Fight Mode: ON
- Challenge Passage: 30 minutes

### Page Rules (Optional)

Go to **Rules** → **Page Rules**

**Rule 1: Force HTTPS**
```
URL: http://*creatorvault.fun/*
Setting: Always Use HTTPS
```

**Rule 2: Cache Static Assets**
```
URL: *creatorvault.fun/*.svg
Settings: 
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 month
  - Browser Cache TTL: 1 month
```

---

## 🎨 Step 6: Web3/Crypto Specific Settings

### Network Settings

Go to **Network**

Enable:
- ✅ WebSockets (needed for wallet connections)
- ✅ gRPC
- ✅ HTTP/3 (QUIC)

### Custom Headers (Optional)

Go to **Rules** → **Transform Rules** → **Modify Response Header**

Add Web3 security headers:
```yaml
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

---

## ✅ Step 7: Verify Setup

### DNS Propagation Check
1. Go to: https://www.whatsmydns.net/
2. Enter: `creatorvault.fun`
3. Check Type: `A`
4. Should show: `76.76.21.21` globally (may take 5-60 min)

### Test Your Site
```bash
# Check DNS
dig creatorvault.fun

# Check HTTPS
curl -I https://creatorvault.fun

# Check redirect
curl -I http://creatorvault.fun
```

**Expected Results:**
- ✅ DNS resolves to Cloudflare IP
- ✅ HTTPS works (200 OK)
- ✅ HTTP redirects to HTTPS (301/302)

### Browser Test
1. Open: https://creatorvault.fun
2. Check:
   - ✅ Site loads
   - ✅ Lock icon shows (SSL valid)
   - ✅ Wallet connects on Base network
   - ✅ No mixed content warnings

---

## 🔄 Step 8: Vercel Configuration (Final)

### In Vercel Dashboard

1. Go to: https://vercel.com/akita-llc/creator-vault/settings/domains
2. Verify both domains show:
   ```
   ✅ creatorvault.fun (Valid Configuration)
   ✅ www.creatorvault.fun (Valid Configuration)
   ```

3. Set primary domain:
   - Click **•••** next to `creatorvault.fun`
   - Select **"Set as Primary"**

---

## 🚀 Quick Setup Checklist

```
□ Add creatorvault.fun in Vercel
□ Note Vercel's DNS requirements
□ Add A record in Cloudflare (76.76.21.21)
□ Add CNAME for www → creatorvault.fun
□ Set SSL to "Full (strict)"
□ Enable "Always Use HTTPS"
□ Enable Auto Minify (JS, CSS, HTML)
□ Enable Brotli compression
□ Enable HTTP/3
□ Enable WebSockets
□ Wait 5-60 min for DNS propagation
□ Test https://creatorvault.fun
□ Verify SSL certificate is valid
□ Test wallet connection
```

---

## 🐛 Troubleshooting

### Issue: "Too many redirects"
**Solution:** Change SSL mode to "Full (strict)" in Cloudflare

### Issue: "DNS_PROBE_FINISHED_NXDOMAIN"
**Solution:** Wait for DNS propagation (up to 48h, usually 5-60 min)

### Issue: "Mixed content warnings"
**Solution:** Enable "Automatic HTTPS Rewrites" in Cloudflare SSL

### Issue: "Wallet won't connect"
**Solution:** Ensure WebSockets are enabled in Cloudflare Network settings

### Issue: "Site loads but shows Vercel 404"
**Solution:** 
1. Check Vercel deployment is live
2. Verify domain shows "Valid Configuration" in Vercel
3. Redeploy in Vercel if needed

---

## 📊 Performance Tips

### Cloudflare Workers (Advanced)
For ultra-fast loading, consider adding Cloudflare Workers:
- Serve HTML from edge
- A/B testing
- Custom routing

### Analytics
Enable Cloudflare Web Analytics:
1. Go to **Analytics** → **Web Analytics**
2. Add site
3. Copy snippet (optional, Vercel already has analytics)

---

## 🎯 Final Result

After setup, your site will:
- ✅ Be accessible at https://creatorvault.fun
- ✅ Auto-redirect from http:// to https://
- ✅ Auto-redirect from www to non-www (or vice versa)
- ✅ Be protected by Cloudflare's CDN
- ✅ Be optimized with Brotli compression
- ✅ Support WebSockets for wallet connections
- ✅ Have DDoS protection
- ✅ Have SSL certificate auto-renewal

---

## 📞 Need Help?

**Cloudflare Docs:** https://developers.cloudflare.com/dns/
**Vercel Docs:** https://vercel.com/docs/custom-domains

**Quick Support:**
- Cloudflare Status: https://www.cloudflarestatus.com/
- Vercel Status: https://www.vercel-status.com/

