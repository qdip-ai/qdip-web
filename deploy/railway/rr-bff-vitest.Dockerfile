# One-shot isolated BFF contract test in the existing Railway staging test runner.
# No application server, production credentials, or new Railway service.
FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
CMD ["sh", "-c", "pnpm exec prettier --check 'src/app/api/rr-operator/kernel/[...path]/route.ts' src/lib/rr-economic-proxy.vitest.test.ts && pnpm exec tsc --noEmit && pnpm exec vitest run src/lib/rr-economic-proxy.vitest.test.ts"]
