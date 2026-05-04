# Security Report - Exposed Credentials

## CRITICAL ISSUE: Exposed API Keys in Git History

### Status: ⚠️ COMPROMISED - IMMEDIATE ACTION REQUIRED

Sensitive credentials have been committed to git history:

**Exposed Credentials:**
- Supabase Project URL: `umssjtkqiiegnmjauhpu.supabase.co`
- Supabase Publishable Key: `sb_publishable_NvgvlKDCAJdcueOqvSDGwA_Ki3oQs-C` (partial)
- Internal API URL: `140.238.126.166:3001`
- OpenRouter API Key (if in .env.local)

**Commit(s):**
- 13e2cdd: Fix UUID generation, IndexedDB errors, and API routing
- c6bef12: Changes

### Why This Is Critical

1. **Supabase Keys**: Can be used to:
   - Read/write all database records
   - Modify user accounts
   - Bypass authentication
   - Access or delete all garden plans and user data

2. **API URLs**: Reveals infrastructure topology and endpoints

3. **OpenRouter Keys**: Could incur unauthorized charges and expose API quotas

### Immediate Actions Required

#### 1. Rotate ALL Credentials (URGENT - Do this first!)

**Supabase:**
- Go to Supabase Dashboard → Project Settings → API Keys
- Regenerate "Publishable Key" (anon key)
- Regenerate "Service Role Key" if exposed
- Update `.env` with new keys

**OpenRouter (if applicable):**
- Go to https://openrouter.ai/account/api-keys
- Delete the compromised key
- Generate a new API key
- Update `.env.local`

#### 2. Prevent Future Leaks

✓ **Already done:**
- Updated `.gitignore` to exclude `.env*` files
- Created `.env.example` template

**Still need to do:**
- Install pre-commit hook to detect secrets:
  ```bash
  npm install --save-dev husky @commitlint/config-conventional detect-secrets
  npx husky install
  npx husky add .husky/pre-commit "npx detect-secrets scan --baseline .secrets.baseline"
  ```

#### 3. Clean Git History

If this is a public/shared repository:
```bash
# Option A: Rewrite history (destructive - only if not widely shared)
git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch .env .env.local' --prune-empty -d -- --all

# Option B: Use BFG Repo Cleaner (better for large repos)
bfg --delete-files .env
bfg --delete-files .env.local
```

#### 4. Notify Team Members

If this repository is shared:
- Alert all users to use new credentials
- Review access logs for unauthorized access
- Check Supabase audit logs

### Moving Forward

**Never commit:**
- `.env` files (use `.env.example` for templates)
- API keys or tokens
- Private URLs or infrastructure details
- SSH keys or certificates

**Best Practices:**
1. Use `.env.example` for documentation of required variables
2. Load secrets from environment at runtime, not from files
3. Use secrets management (GitHub Secrets, 1Password, Vault)
4. Enable branch protection requiring reviews before merge
5. Regular security audits of committed files

### References

- [OWASP: Secrets Management](https://owasp.org/www-project-api-security/vulnerable-api-1-broken-object-level-authorization/)
- [GitHub: Secret Scanning](https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning)
- [Git: Removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)

---

**Report Generated:** 2026-04-14
**Severity:** CRITICAL
**Action Required:** Yes - Rotate credentials immediately
