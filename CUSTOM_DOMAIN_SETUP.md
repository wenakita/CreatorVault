# 🌐 Custom Domain Setup: creatorvault.fun

## Current Status
- ✅ Site deployed: https://frontend-5l3icd6y1-akita-llc.vercel.app
- 🎯 Target domain: **creatorvault.fun**

---

## 📋 Step-by-Step Setup

### **Step 1: Add Domain to Vercel**

#### **Option A: Via Vercel Dashboard** (Easiest)

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/akita-llc/frontend
   - Click on "Settings" tab
   - Click on "Domains" in sidebar

2. **Add Your Domain**
   - Click "Add Domain"
   - Enter: `creatorvault.fun`
   - Click "Add"

3. **Add www Subdomain** (Optional but recommended)
   - Click "Add Domain" again
   - Enter: `www.creatorvault.fun`
   - Click "Add"
   - Vercel will automatically redirect www → root

#### **Option B: Via Vercel CLI**

```bash
cd /home/akitav2/projects/CreatorVault/frontend
vercel domains add creatorvault.fun
vercel domains add www.creatorvault.fun
```

---

### **Step 2: Configure DNS Settings**

After adding the domain, Vercel will show you DNS records to add. You need to configure these in your domain registrar (where you bought creatorvault.fun).

#### **Required DNS Records:**

**For Root Domain (creatorvault.fun):**
```
Type: A
Name: @
Value: 76.76.21.21
TTL: 3600
```

**For www Subdomain (www.creatorvault.fun):**
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: 3600
```

**For Verification (if Vercel requires):**
```
Type: TXT
Name: _vercel
Value: [Vercel will provide this]
TTL: 3600
```

---

### **Step 3: Update DNS at Your Registrar**

#### **Common Registrars:**

##### **Namecheap:**
1. Go to: https://ap.www.namecheap.com/domains/list/
2. Click "Manage" next to creatorvault.fun
3. Go to "Advanced DNS" tab
4. Add the records above

##### **GoDaddy:**
1. Go to: https://dcc.godaddy.com/manage/
2. Click "DNS" next to creatorvault.fun
3. Add the records above

##### **Cloudflare:**
1. Go to: https://dash.cloudflare.com/
2. Select creatorvault.fun
3. Go to "DNS" tab
4. Add the records above
5. **Important:** Set Proxy status to "DNS only" (gray cloud)

##### **Google Domains / Squarespace:**
1. Go to: https://domains.google.com/registrar/
2. Click on creatorvault.fun
3. Go to "DNS" tab
4. Add the records above

---

### **Step 4: Wait for DNS Propagation**

- **Typical Time:** 5-30 minutes
- **Maximum Time:** 48 hours (rare)
- **Average Time:** 15 minutes

#### **Check DNS Propagation:**

```bash
# Check A record
dig creatorvault.fun

# Check CNAME record
dig www.creatorvault.fun

# Or use online tool
# Visit: https://dnschecker.org/
```

---

### **Step 5: Verify SSL Certificate**

Once DNS propagates, Vercel automatically provisions an SSL certificate:

1. **Check Status in Vercel**
   - Go to: Settings → Domains
   - Should show: ✓ Valid Certificate

2. **Test HTTPS**
   - Visit: https://creatorvault.fun
   - Should show green padlock 🔒

---

## 🎯 Quick Setup Commands

```bash
# Add domains via CLI
cd /home/akitav2/projects/CreatorVault/frontend
vercel domains add creatorvault.fun
vercel domains add www.creatorvault.fun

# Check domain status
vercel domains ls

# Inspect deployment
vercel inspect
```

---

## 🔧 DNS Configuration Summary

**Add these records to your DNS provider:**

| Type  | Name | Value                  | TTL  |
|-------|------|------------------------|------|
| A     | @    | 76.76.21.21           | 3600 |
| CNAME | www  | cname.vercel-dns.com  | 3600 |

---

## ✅ Verification Checklist

After DNS propagates:

- [ ] https://creatorvault.fun loads correctly
- [ ] https://www.creatorvault.fun redirects to https://creatorvault.fun
- [ ] SSL certificate is valid (green padlock)
- [ ] No mixed content warnings
- [ ] All pages work correctly
- [ ] Wallet connections work
- [ ] Contract interactions work

---

## 🚨 Troubleshooting

### **Issue: "Domain not verified"**
**Solution:** Wait for DNS propagation (15-30 minutes)

### **Issue: "SSL certificate pending"**
**Solution:** Vercel auto-provisions SSL after DNS verifies (can take 5-10 minutes)

### **Issue: "Too many redirects"**
**Solution:** If using Cloudflare, set SSL mode to "Full" not "Flexible"

### **Issue: "DNS_PROBE_FINISHED_NXDOMAIN"**
**Solution:** DNS records not propagated yet, wait 15 minutes and try again

### **Issue: Old site still showing**
**Solution:** Clear browser cache or use incognito mode

---

## 🎨 Update Brand Materials

Once live on creatorvault.fun, update:

### **Social Media:**
```
🚀 CreatorVault is LIVE!
https://creatorvault.fun

Turn your creator coins into earnings.
Join the AKITA fair launch! 🎯
```

### **GitHub README:**
Update the project URL in your README.md

### **Documentation:**
Update all references from vercel.app to creatorvault.fun

---

## 🔐 Security Best Practices

After domain is live:

1. **Enable Vercel Protection** (optional)
   - Settings → Protection
   - Add password or allowlist IPs

2. **Monitor Analytics**
   - Vercel → Analytics
   - Track visitors and performance

3. **Set up Monitoring**
   - https://vercel.com/docs/observability

---

## 📊 Expected Timeline

| Step | Time | Status |
|------|------|--------|
| Add domain to Vercel | 1 min | ⏳ |
| Configure DNS records | 5 min | ⏳ |
| DNS propagation | 15-30 min | ⏳ |
| SSL certificate provisioning | 5-10 min | ⏳ |
| **Total** | **~30-45 min** | ⏳ |

---

## 🎉 After Setup Complete

Your site will be accessible at:
- ✅ https://creatorvault.fun (primary)
- ✅ https://www.creatorvault.fun (redirects to primary)
- ✅ https://frontend-5l3icd6y1-akita-llc.vercel.app (still works)

All three URLs will point to the same deployment!

---

## 🚀 Ready to Launch!

Once your custom domain is live:

1. **Share on Social Media**
   ```
   🎉 CreatorVault is LIVE at https://creatorvault.fun!
   
   🔥 Turn idle creator coins into earnings
   💰 Join the AKITA fair launch auction
   ⚡ Built on Base
   
   #CreatorVault #Base #DeFi
   ```

2. **Launch the Auction**
   - Go to: https://creatorvault.fun/activate-akita
   - Connect wallet
   - Launch CCA!

3. **Monitor & Engage**
   - Watch bids come in
   - Engage with community
   - Share auction progress

---

## 📞 Need Help?

**Vercel Support:**
- https://vercel.com/support

**DNS Tools:**
- Check propagation: https://dnschecker.org/
- Debug DNS: https://mxtoolbox.com/

**Your Current URLs:**
- Deployment: https://frontend-5l3icd6y1-akita-llc.vercel.app
- Target: https://creatorvault.fun

---

**Let's get creatorvault.fun live! 🚀**

