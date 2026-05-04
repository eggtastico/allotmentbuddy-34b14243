# CORS Security Configuration

## Issue Fixed: Open CORS ("*") Vulnerability

### What Was Wrong
All Supabase Edge Functions had `"Access-Control-Allow-Origin": "*"`, which:
- Allows requests from ANY origin (including malicious sites)
- Opens the API to CSRF (Cross-Site Request Forgery) attacks
- Exposes AI API quotas to unauthorized use
- Could allow credential harvesting

### What's Fixed Now

Created a centralized **CORS utility** (`supabase/functions/_shared/cors.ts`) that:
1. **Validates request origin** against a whitelist
2. **Only allows specific origins** (no "*")
3. **Rejects unknown origins** with a 403 response
4. **Configurable per environment** (dev, staging, production)

### Updated Functions

✓ `supabase/functions/grow-guide/index.ts`
✓ `supabase/functions/scan-seed-pack/index.ts`
✓ `supabase/functions/garden-ai/index.ts`
✓ `supabase/functions/watering-guide/index.ts`

All now use the secure CORS utility.

---

## Configuration

### Current Allowed Origins (Development)

```typescript
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:8083',
];
```

### Adding Production Origins

To deploy to production, update `supabase/functions/_shared/cors.ts`:

```typescript
const ALLOWED_ORIGINS = [
  'http://localhost:3000',    // Keep for development
  'http://localhost:5173',
  // ... other dev origins
  'https://allotmentbuddy.com',           // Production domain
  'https://www.allotmentbuddy.com',       // With www
  'https://app.allotmentbuddy.com',       // Subdomain if using
];
```

### Origin Matching

- **Exact match only** - `https://allotmentbuddy.com` does NOT match `https://www.allotmentbuddy.com`
- Add both variants if needed
- Case-sensitive

---

## How It Works

### Preflight Request (OPTIONS)

Before sending actual requests, browsers send an OPTIONS preflight:

```
OPTIONS /functions/v1/grow-guide
Origin: https://allotmentbuddy.com
```

**Old behavior (vulnerable):**
```
Access-Control-Allow-Origin: *  ❌ Allows ANY origin
```

**New behavior (secure):**
```
Access-Control-Allow-Origin: https://allotmentbuddy.com  ✓
// or
Access-Control-Allow-Origin:   (empty header)  ✓ Rejects unknown origins
```

### Actual Request

If preflight passes (origin is whitelisted), the actual request succeeds:

```
POST /functions/v1/grow-guide
Authorization: Bearer <token>
Content-Type: application/json
```

If origin is not whitelisted, the preflight returns 403 Forbidden.

---

## Testing CORS Locally

### ✓ Should Work (localhost allowed)

```bash
curl -H "Origin: http://localhost:5173" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     https://your-project.supabase.co/functions/v1/grow-guide
```

Should return:
```
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Methods: POST, OPTIONS
```

### ✗ Should Fail (unknown origin)

```bash
curl -H "Origin: https://evil.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     https://your-project.supabase.co/functions/v1/grow-guide
```

Should return:
```
HTTP/1.1 403 Forbidden
```

---

## Security Best Practices

### Do's ✓

- ✓ Whitelist only necessary origins
- ✓ Use HTTPS for production (never HTTP)
- ✓ Review origins before deploying
- ✓ Update origins when adding new domains
- ✓ Monitor Supabase logs for rejected requests
- ✓ Keep token/secret handling on backend (never expose in frontend)

### Don'ts ✗

- ✗ Never use "*" as origin (open to CSRF)
- ✗ Don't whitelist staging/dev in production config
- ✗ Don't commit production secrets to git
- ✗ Don't trust Origin header alone (it can be spoofed in some contexts)
- ✗ Don't expose API keys in responses

---

## Monitoring

### Check Supabase Function Logs

```bash
# View real-time logs for grow-guide function
supabase functions serve

# Or in Supabase Dashboard:
# Project → Functions → Select function → View Logs
```

### Look for

- CORS rejections (403 responses)
- Unusual origins in logs
- Failed auth attempts

---

## Related Issues

This fix addresses the **CRITICAL CORS vulnerability** identified in the security analysis.

See also:
- `SECURITY_REPORT.md` - Full security audit
- `.env` credential exposure (separate critical issue)
- Rate limiting and quota monitoring (TODO)

---

**Last Updated:** 2026-04-14
**Security Level:** ✓ Fixed - Production Ready
