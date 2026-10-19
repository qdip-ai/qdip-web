# Observatory user access (no Observatory organizations)

Observatory identity is the verified Zitadel `sub`. The Core Gateway service
tenant is an implementation detail; it must not appear as an Observatory
organization or be interpreted as a user's tenant.

Configure these **server-only** environment variables:

```env
QDIP_OBSERVATORY_ALLOWED_SUBJECTS=zitadel-sub-1,zitadel-sub-2
QDIP_OBSERVATORY_USER_CAPABILITIES={"zitadel-sub-1":["route.optimize"],"zitadel-sub-2":[]}
QDIP_OBSERVATORY_READ_API_KEY=<read-only-gateway-key>
QDIP_OBSERVATORY_EXECUTE_API_KEY=<execute-only-gateway-key>
DIP_API_BASE_URL=https://<trusted-gateway-host>
```

A missing, malformed or absent user entry denies access. Wildcards are not
supported. The catalog filters capabilities by the user's grants; invocation
rechecks the same grants on the server before calling Gateway. Never expose
these credentials or grants in `NEXT_PUBLIC_*` settings.

**Scope:** This is a controlled rollout with user-specific capability
authorization at the Observatory boundary. It does **not** establish per-user
storage, execution or audit isolation inside Core. Do not use a shared Gateway
service tenant for untrusted users with sensitive data. The next platform
feature is passing a verified user execution identity to Core and partitioning
history, replay and audit access by that identity.
