/**
 * OTP provider-identity regression test.
 *
 * Reproduces the exact class of bug that caused the user-visible
 *   "Provider identity with entity_id: …, provider: phone-otp, already exists."
 * error in production on 2026-05-19.
 *
 * Root cause: the OTP verify route looked up the existing auth identity via
 *   authModule.listAndCountAuthIdentities({
 *     provider_identities: { entity_id, provider }
 *   })
 * which is a nested filter through a one-to-many relation that Medusa
 * v2.13's filter pipeline does not reliably resolve — it returned an empty
 * array regardless of whether a matching identity existed. Every login
 * fell through to `createAuthIdentities`, and the SECOND login per user
 * tripped the UNIQUE(provider, entity_id) constraint on `provider_identity`.
 *
 * What we want this test to guarantee, forever:
 *   1. `listProviderIdentities({ provider, entity_id })` actually returns
 *      the row when it exists. (Catches any regression of the original
 *      bug class — broken filter shape, wrong method name, etc.)
 *   2. The bulletproof fallback (list-all + client-side filter) finds the
 *      same row. (Catches any future Medusa filter-pipeline change that
 *      stops honoring the filter.)
 *
 * Both checks are direct against the auth module so the test stays valid
 * even if the route handler is rewritten.
 */
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"

jest.setTimeout(60 * 1000)

const PROVIDER = "phone-otp"

/**
 * Generate a unique entity_id per test invocation so re-runs against the
 * same DB don't collide with rows from previous runs.
 */
function makeEntityId(suffix: string): string {
  // E.164-without-+ format that the OTP verify route uses
  return `9199${Date.now().toString().slice(-7)}${suffix}`
}

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ getContainer }) => {
    describe("Auth module — provider_identity lookup behaviour", () => {
      it("listProviderIdentities({ provider, entity_id }) finds a just-created identity", async () => {
        const container = getContainer()
        const authModule = container.resolve(Modules.AUTH) as any

        const entityId = makeEntityId("1")

        // Pre-condition: nothing exists for this entity_id
        const before = await authModule.listProviderIdentities({
          provider: PROVIDER,
          entity_id: entityId,
        })
        expect(before.length).toBe(0)

        // Create an auth identity, like the OTP verify route does on first login
        const created = await authModule.createAuthIdentities({
          provider_identities: [
            { provider: PROVIDER, entity_id: entityId, user_metadata: { phone: entityId } },
          ],
          app_metadata: { customer_id: `cus_test_${Date.now()}` },
        })
        expect(created?.id).toBeTruthy()

        // The regression assertion: the SECOND login simulation. If the filter
        // pipeline silently returns empty here, we'd try to create again and
        // hit "already exists". This is the exact failure mode that bit us.
        const found = await authModule.listProviderIdentities({
          provider: PROVIDER,
          entity_id: entityId,
        })
        expect(found.length).toBe(1)
        expect(found[0].entity_id).toBe(entityId)
        expect(found[0].provider).toBe(PROVIDER)
        expect(found[0].auth_identity_id).toBe(created.id)
      })

      it("recreating the same (provider, entity_id) throws an 'already exists' / unique-constraint error", async () => {
        // This confirms the DB-level guarantee that backs our recovery logic.
        // If this assertion ever fails, the unique constraint has been
        // dropped and the whole class of bugs no longer applies — but we'd
        // want to know.
        const container = getContainer()
        const authModule = container.resolve(Modules.AUTH) as any

        const entityId = makeEntityId("2")
        await authModule.createAuthIdentities({
          provider_identities: [{ provider: PROVIDER, entity_id: entityId }],
        })

        await expect(
          authModule.createAuthIdentities({
            provider_identities: [{ provider: PROVIDER, entity_id: entityId }],
          }),
        ).rejects.toThrow(/already exists|unique|duplicate|entity_id/i)
      })

      it("list-all + client-side filter finds the identity (bulletproof fallback path)", async () => {
        // This simulates the second strategy our route uses if the filtered
        // lookup ever stops working. The route lists every identity for the
        // provider with take=1000 and matches entity_id in JS.
        const container = getContainer()
        const authModule = container.resolve(Modules.AUTH) as any

        const entityId = makeEntityId("3")
        await authModule.createAuthIdentities({
          provider_identities: [{ provider: PROVIDER, entity_id: entityId }],
        })

        const all = await authModule.listProviderIdentities(
          { provider: PROVIDER },
          { take: 1000 },
        )
        const match = all.find((p: any) => p.entity_id === entityId)
        expect(match).toBeTruthy()
        expect(match?.provider).toBe(PROVIDER)
      })

      it("retrieveAuthIdentity returns the parent identity given a provider_identity.auth_identity_id", async () => {
        // The route resolves the full auth identity from the provider
        // identity match. Confirm that lookup also works on this version.
        const container = getContainer()
        const authModule = container.resolve(Modules.AUTH) as any

        const entityId = makeEntityId("4")
        const created = await authModule.createAuthIdentities({
          provider_identities: [{ provider: PROVIDER, entity_id: entityId }],
          app_metadata: { customer_id: "cus_retrieve_test" },
        })

        const [pi] = await authModule.listProviderIdentities({
          provider: PROVIDER,
          entity_id: entityId,
        })
        expect(pi).toBeTruthy()

        const retrieved = await authModule.retrieveAuthIdentity(pi.auth_identity_id)
        expect(retrieved.id).toBe(created.id)
        expect(retrieved.app_metadata?.customer_id).toBe("cus_retrieve_test")
      })
    })
  },
})
