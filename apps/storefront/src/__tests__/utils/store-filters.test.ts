import { describe, it, expect } from "vitest"
import { buildPharmaIdFilter, MAX_FILTER_IDS } from "@/lib/utils/store-filters"

describe("buildPharmaIdFilter", () => {
  describe("when no pharma filter is active", () => {
    it("returns undefined", () => {
      expect(buildPharmaIdFilter({
        hasPharmaFilter: false,
        isFilterFetching: false,
        filteredIds: undefined,
      })).toBeUndefined()
    })
  })

  describe("when pharma filter is active but still fetching", () => {
    it("returns undefined to prevent premature queries", () => {
      expect(buildPharmaIdFilter({
        hasPharmaFilter: true,
        isFilterFetching: true,
        filteredIds: undefined,
      })).toBeUndefined()
    })

    it("returns undefined even if stale filteredIds exist", () => {
      expect(buildPharmaIdFilter({
        hasPharmaFilter: true,
        isFilterFetching: true,
        filteredIds: ["prod_1", "prod_2"],
      })).toBeUndefined()
    })
  })

  describe("when pharma filter resolved with results", () => {
    it("returns the filtered IDs", () => {
      const ids = ["prod_1", "prod_2", "prod_3"]
      expect(buildPharmaIdFilter({
        hasPharmaFilter: true,
        isFilterFetching: false,
        filteredIds: ids,
      })).toEqual(ids)
    })

    it("caps IDs at MAX_FILTER_IDS to avoid URL-too-long", () => {
      const ids = Array.from({ length: 100 }, (_, i) => `prod_${i}`)
      const result = buildPharmaIdFilter({
        hasPharmaFilter: true,
        isFilterFetching: false,
        filteredIds: ids,
      })
      expect(result).toHaveLength(MAX_FILTER_IDS)
      expect(result).toEqual(ids.slice(0, MAX_FILTER_IDS))
    })
  })

  describe("when pharma filter resolved with no results", () => {
    it("returns sentinel array to show empty state", () => {
      expect(buildPharmaIdFilter({
        hasPharmaFilter: true,
        isFilterFetching: false,
        filteredIds: [],
      })).toEqual(["__none__"])
    })

    it("returns sentinel when filteredIds is undefined after fetch", () => {
      expect(buildPharmaIdFilter({
        hasPharmaFilter: true,
        isFilterFetching: false,
        filteredIds: undefined,
      })).toEqual(["__none__"])
    })
  })
})

describe("MAX_FILTER_IDS", () => {
  it("is 20 to stay under CORS URL limits", () => {
    expect(MAX_FILTER_IDS).toBe(20)
  })
})
