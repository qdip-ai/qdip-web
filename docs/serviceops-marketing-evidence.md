# ServiceOps — evidence-first marketing decision

Status: WEB-SERVICEOPS-01; 2026-11-24. Conversion hypothesis, not a measured benefit.

## Product boundary and source register

| Claim | Evidence | Marketing status |
| --- | --- | --- |
| Manual-first orders, customer records, workflow builder, assignments and board | qdip-ai/qdip-serviceops README.md, docs/APPLICATION.md, docs/DASHBOARD_DOMAIN_CONTRACT.md (main, 2026-11-24) | Source-supported, not proof of an externally validated deployment |
| Worker PWA: cached shell, offline actions and explicit conflict resolution | ServiceOps README.md / docs/APPLICATION.md / web/src/worker | Source-supported; iOS background sync must not be promised |
| Customer portal: one-order, expiring/revocable token and server-confirmed progress | ServiceOps docs/APPLICATION.md | Source-supported |
| Twelve editable service templates, demo seed of 6 clients, 3 staff and 6 orders | ServiceOps README.md / docs/OWNER_REQUIREMENTS_2026-11-24.md | Sample data only |
| Demo links /demo/owner, /demo/worker, /demo/customer | ServiceOps PR #39 main source, Railway ops commit 4fc165f deployment SUCCESS | Live deployment metadata; browser E2E of full journey not independently verified |
| Kernel / Gateway automatic assignment for ServiceOps | ServiceOps README.md / docs/KERNEL_ASSIGNMENT_RESEARCH.md | NOT IMPLEMENTED / NOT VERIFIED; prohibit optimization claim |
| Public self-service signup, price, reliable persistence and customer ROI | No verified supporting evidence | UNKNOWN; do not promise |
| Interactive product demos improve QDIP conversion | No QDIP conversion measurements | Hypothesis only |

## Scientific Review — question, alternatives and falsification

Question: Does an ungated role-specific ServiceOps demo plus a user guide before a pilot form increase qualified service-business leads, compared with a static explanation followed by an inquiry form?

H1: A business owner who can inspect owner → worker → customer workflow and compare it with their own process is more likely to submit a qualified pilot request.

H0: Demo visitors are merely curious or confuse local simulation with actual integration, without increasing qualified requests.

Alternative explanations: channel mix, language, segment, seasonality, device, traffic intent, site speed and personal referral. A higher raw demo click rate does NOT establish higher qualified conversions.

Falsifier: in comparable traffic (ideally controlled test with preregistered qualified-lead definition), no increase in qualified leads per eligible session, or a higher share of demo-misled leads. Track error and abandonment rates.

Scientific conclusion: novelty UNASSESSED (self-serve demo is a known approach); support DIRECTIONAL EXTERNAL OBSERVATIONAL EVIDENCE; reproducibility for QDIP NOT TESTED; verdict UNRESOLVED.

External evidence is directional only, mostly vendor sample based; no causal or ROI transfer to QDIP is justified:
- https://www.navattic.com/report/state-of-the-interactive-product-demo-2025
- https://www.navattic.com/report/state-of-the-interactive-product-demo-2026
- https://developers.google.com/search/docs/fundamentals/creating-helpful-content

## Positioning

ServiceOps: independently usable MANUAL-FIRST service-business SaaS in the QDIP ecosystem. It is distinct from QDIP Decision Engine applications (Resource Allocation, Supply Network Optimization, GTM Lab). It demonstrates the business workflow and three-role UI, not a verified Kernel or economic optimization. No measured savings, accuracy, auto scheduling, enterprise reliability, free trial or pricing claims.

Audience: owners/operators of small service businesses, especially Ukrainian-speaking businesses in Poland. Secondary: Polish/English buyers. Business examples include vehicle repair, cleaning, maintenance and field services.

## Funnel map

1. Discover: qdip.ai/{locale} ecosystem card or /{locale}/use-cases; placements serviceops_home_case and serviceops_usecases_case.
2. Understand: /{locale}/serviceops; role comparison, 12 templates, status boundary.
3. Explore: ops.qdip.ai/demo/owner, /demo/worker, /demo/customer; browser-local isolated simulation without sign-in. Demo clicks captured via existing marketing_demo_click placements serviceops_demo_owner/worker/customer.
4. Learn: /{locale}/serviceops/guide; 8 detailed sections about real access, setup, worker offline and customer tokens.
5. Convert: /{locale}/serviceops#pilot uses existing DecisionInquiryForm with ServiceOps labels; POST /api/decision-inquiry; product context in submitted message (ServiceOps pilot inquiry). No new API or service.
6. Pilot: manual response to scoped inquiry, discovery of needs, baseline and acceptance criteria, then optional onboarding. NO automatic signup.

Analytics: existing dataLayer receives event, locale, placement; contact information and process descriptions are not exported to analytics. Form emits decision_form_started/submit/success/error. An event contract is not evidence that an analytics collector is connected. Do not claim user conversion measurements until raw counts and denominators are available.

Primary future KPI: qualified ServiceOps pilot inquiries / eligible landing sessions. Secondary: open demo clicks per landing session, guide clicks, form start→success, qualification share of received inquiries. Predefine a qualified lead as a reachable service business in the target market with recurring orders and a specific pilot workflow. Observe source and language separately. Report missing denominators and sample sizes rather than inferring uplift.

## Implementation and release contract

Localized EN/UA/PL case and guide routes, canonical/hreflang and sitemap. Reuse QDIP DesignSystem, MarketingHeader/Footer, event tracking and protected contact endpoint. Preserve existing DI demos, SDK and Observatory names. No additional infra/auth/billing/payments, no Kernel integration claim and no personal data in analytics. Owner visual UI review separate from engineering checks. Source implementation and static assertions are not user-journey E2E.
