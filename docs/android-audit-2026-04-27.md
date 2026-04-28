# Android App Audit — 2026-04-27

Audit of the Suprameds (`in.supracyn.app`) Android Capacitor app. Captures
what shipped in the v1.4 / versionCode 5 hardening pass and what remains as
follow-up work.

## What shipped in v1.4 (versionCode 5)

### Manifest hardening
- Added `<queries>` block for Android 11+ package visibility — fixes silently
  failing `tel:` / `mailto:` / external `https` intents on stricter OEM builds
- Dropped `ACCESS_FINE_LOCATION` (we only need pincode-level accuracy via
  `enableHighAccuracy: false`); keeps Data Safety label as "Approximate"
- Replaced `android.hardware.location.gps` feature with `.network` since
  coarse positioning uses Wi-Fi / cell towers, not GPS
- Added FCM `default_notification_icon`, `default_notification_color`,
  and `default_notification_channel_id` meta-data — eliminates the white
  square shown in status bar for incoming pushes

### Native resources
- `res/drawable/ic_stat_notify.xml` — monochrome pharmacy "+" silhouette,
  white-on-transparent for status bar
- `res/values/colors.xml` — added `notification_color` (brand teal)
- `res/values/strings.xml` — channel name + description strings (×4 channels)

### Notification channels (MainActivity.onCreate)
Four channels created on Android 8+ so users can mute selectively without
losing transactional pushes:
- `orders` — IMPORTANCE_HIGH, vibration on, badge on (also the default)
- `prescriptions` — IMPORTANCE_HIGH, vibration on, badge on
- `account` — IMPORTANCE_HIGH, vibration on, badge on
- `promotions` — IMPORTANCE_LOW, vibration off, badge off

FCM payloads should set `"channel_id"` to one of these to respect user
preferences.

### Permission rationale UI
- `components/permission-rationale.tsx` — promise-based imperative API
  (`const allow = await ask({...})`); bottom-sheet on mobile, centered modal
  on desktop, Esc-to-cancel, body-scroll lock, safe-area aware
- Mounted via `<PermissionRationaleProvider>` inside `Layout`
- Wired into `lib/hooks/use-location.ts` — shown before `getCurrentPosition`
- Wired into `pages/upload-rx.tsx::handleNativeCamera` — shown before
  `Camera.getPhoto`, gated on `Camera.checkPermissions().camera === "granted"`
  to skip on returning users

Expected impact: deny rate drops from ~60–70% (cold prompt) to ~20–30%.

### Secure storage for auth tokens
- `lib/utils/secure-storage.ts` — sync-read API backed by Capacitor
  Preferences on native + localStorage fallback on web
- One-time migration on native first-launch: copies any existing localStorage
  values into Preferences and removes from localStorage
- Hydration kicked off from `initCapacitorPlugins()` before first
  `useCustomer()` fetch
- `_suprameds_otp_jwt` migrated; sandboxed per-app UID, not readable from
  WebView JS context
- New dep: `@capacitor/preferences ^8.0.1`

### Layout
- Suppress global chrome on `/onboarding` so it owns the full screen
  (Navbar, Footer, BottomTabBar, WhatsAppButton, ConsentBanner all hidden)

---

## Follow-up punch list

These didn't ship in this pass — either too risky to do cold, blocked on
external work, or genuinely multi-day. Tracked here so they don't fall off.

### High priority

#### 1. Content Security Policy
**Risk:** Adding CSP cold breaks GA / GTM / Razorpay / Google Fonts
silently. Industry standard: ship `Content-Security-Policy-Report-Only`
first, collect violation reports for 1–2 weeks, then promote to enforced.

**Plan:** Add a Nitro server middleware that sets:
- `Content-Security-Policy-Report-Only` with a permissive baseline
- A `report-to` endpoint at `/api/csp-report` for aggregation
- After 2 weeks of violation review, tighten + flip to enforced

#### 2. `@sentry/capacitor` integration
**Why deferred:** ~3–4h native dep migration with rollback risk. Adds
gradle modules + iOS pods. Play Vitals catches native crashes/ANRs already,
so the marginal gain is unified Sentry dashboard.

**Plan when ready:**
- `pnpm add @sentry/capacitor`
- Replace `Sentry.init` in `mobile-entry.tsx` with `SentryCapacitor.init`
- Verify Sentry org `suprameds-storefront` project has Android platform
- Test crash reporting on a real device in internal testing track

#### 3. Auth-token follow-through
- Medusa SDK still uses `localStorage` for `medusa_auth_token` directly —
  this pass only migrated the OTP JWT bearer fallback. Wiring a custom
  `tokenStorage` adapter into the SDK config is the next step
- `suprameds_fcm_token` and `suprameds_biometric_*` flags: not security-
  critical, can stay in localStorage

#### 4. Indian language localization
**Effort:** multi-day per language pair. Big India-market unlock.
- Set up `i18next` or `@lingui/core` with route-aware locale switching
- Translate onboarding (3 slides) + key error messages + permission
  rationale strings + CTAs first
- Add Hindi, Telugu, Tamil — order by addressable market

### Medium priority

#### 5. www.supracyn.in deep links
Currently the apex is verified via assetlinks.json; `www.` is not listed
because the subdomain doesn't resolve in DNS. Adding the host to the
intent-filter without DNS would atomically break apex verification too.

**Steps to enable:**
1. Add CNAME `www.supracyn.in` → apex (or same Railway target)
2. Verify `https://www.supracyn.in/.well-known/assetlinks.json` returns 200
   with the same payload (Railway auto-serves both hosts identically since
   TanStack Start handles all hosts)
3. Add `<data android:scheme="https" android:host="www.supracyn.in" />`
   to the existing intent-filter
4. Bump versionCode + rebuild AAB

#### 6. Razorpay pre-warm
**Blocked on:** UI re-enable. Currently `checkout-payment-step.tsx` filters
Razorpay/Paytm out so only COD shows. When re-enabled, add a `<link
rel="preload" as="script" href="https://checkout.razorpay.com/v1/checkout.js">`
on the cart route head — drops payment-sheet open from ~2s to ~200ms.

#### 7. Battery optimization OEM whitelist
Xiaomi / Realme / OnePlus / OPPO / Vivo aggressively kill background
processes. FCM push delivery drops to 60–70% on those OEMs.

**Plan:**
- Add `lib/utils/oem-detection.ts` — detect OEM via `Capacitor.Device.getInfo()`
- After `useCustomer()` resolves on native, show a soft prompt linking to
  per-OEM settings docs ("Open Settings → Battery → Suprameds → Allow
  background activity")
- Standard intent for stock Android: `android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS`
- Xiaomi / Vivo need their own intents — document per-OEM map

#### 8. Dynamic shortcuts
Currently 3 static (`shortcuts.xml`). Add dynamic ones based on user
context — e.g., "Reorder Atorcyn 10" if they bought it 30+ days ago,
"Track #SPM-2461" while an order is in transit.

**Plan:**
- Add a Capacitor plugin or write a thin native module exposing
  `ShortcutManagerCompat.pushDynamicShortcut`
- Trigger from `useOrders()` resolver after fetch

### Lower priority / further out

#### 9. Themed (Material You) icon
Add `<monochrome>` layer to `mipmap-anydpi-v26/ic_launcher.xml` so Android
12+ users with themed icons see a properly tinted glyph instead of a
white blob. The `ic_launcher_monochrome.xml` drawable already exists —
wire it into the adaptive icon descriptor.

#### 10. Play Integrity API
Detect rooted / modified APKs / debugger attached to gate fraudulent
order / refund paths. Adds a Java SDK + a backend verification endpoint.
Worth it at scale, not at v1.4.

#### 11. Certificate pinning
Pin Cloudflare's leaf cert for `api.supracyn.in` + `supracyn.in`. Catches
MITM attacks on hostile networks. **Risk:** rotation requires server-side
remote-config to push new pins before old certs expire — without that,
a cert rotation breaks every existing install. Skip unless we build the
rotation pipeline first.

#### 12. Home screen widget
"Reorder last order" / "Track active order" widget = retention gold,
especially in India where home-screen real estate is heavily curated.
Capacitor doesn't support widgets natively — requires a Glance or
AppWidget native module.

#### 13. Accessibility sweep
- TalkBack labels on icon-only buttons (cart, theme toggle, hamburger,
  back) — partial coverage today
- Dynamic font scaling — audit no text uses `px`, all `rem`
- Color contrast — verify AA minimum on body, AAA on critical text
- Touch target 44dp — onboarding has it, audit checkout buttons

#### 14. Prescription image retention
DPDP Act requires defined retention. Add a backend cron that purges
prescription images N years after order completion, where N matches
statutory minimum for Schedule H/H1 (typically 5y). Owns: backend.

---

## Manual Play Console items (not code)

These can't be addressed in the codebase — they live in the Play Console
dashboard. Punch list for the manual session:

- [ ] **App access** — provide a working test login (phone + static OTP
  override or backup credentials) so reviewers can access core flows.
  Without this, review fails on day 7 with "couldn't access core
  functionality."
- [ ] **Health app declaration** — Policy → App content. Mark as health
  app, list Drug License No. TS/HYD/2021-82149 (Form 20 & 21), pharmacist
  Mirza Askary Ali (#031171/A1).
- [ ] **Data Safety form** — audit current declarations against actual
  collection: name, email, phone, address, **coarse location**, **camera
  images** (Rx), payment via Razorpay, FCM token, ad ID, device IDs
  (Sentry breadcrumbs). All third-party shares must be listed
  (Razorpay, Resend, Google Ads, Sentry, Firebase, AfterShip).
- [ ] **Content Rating questionnaire** — pharma-correct answers:
  references drugs (yes), provides medical advice (no), 18+ (yes due to
  Schedule H/H1).
- [ ] **Pre-launch report review** — Quality → Pre-launch reports. Look
  for crashes / ANRs Firebase Test Lab caught on the AAB upload.
- [ ] **Staged rollout** — Production → Releases → Rollout slider.
  Recommended: 5% (24h watch Play Vitals: crash-free ≥ 99.5%, ANR ≤
  0.47%) → 20% → 50% → 100%.
- [ ] **Listing assets quality** — short description (80 chars: first
  thing users read), 4–8 screenshots with text overlays ("Save 80%",
  "Pharmacist verified"), 30s app preview video (+15-20% conversion).

## Verification gates before promoting v1.4 → production

1. Internal testing → install on a real device, verify:
   - First-launch onboarding shows full-screen (no chrome)
   - Notification icon shows the "+" glyph (not white square)
   - Test FCM push lands in correct channel; mute one channel, verify
     others still deliver
   - Permission rationale modals appear before camera + location prompts
   - Force-quit & relaunch: secure storage hydrated correctly (still
     logged in)
2. `adb shell pm get-app-links in.supracyn.app` returns `verified: supracyn.in`
3. Pre-launch report shows zero crashes / ANRs on the AAB
4. Production rollout starts at 5% with Play Vitals monitor active
