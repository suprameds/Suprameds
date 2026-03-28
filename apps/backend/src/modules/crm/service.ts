import { MedusaService } from "@medusajs/framework/utils"
import ChronicReorderPattern from "./models/chronic-reorder-pattern"

class CrmModuleService extends MedusaService({
  ChronicReorderPattern,
}) {
  async customer360(customerId: string) {
    const patterns = await this.listChronicReorderPatterns(
      { customer_id: customerId, is_active: true },
      { take: null }
    )

    const stage = this.computeLifecycleStage(patterns)

    return {
      customer_id: customerId,
      lifecycle_stage: stage,
      chronic_medications: patterns.length,
      reorder_patterns: patterns.map((p: any) => ({
        variant_id: p.variant_id,
        avg_days: p.average_days_between_orders,
        last_purchased: p.last_purchased_at,
        next_expected: p.next_expected_at,
        confidence: p.confidence_score,
      })),
      computed_at: new Date().toISOString(),
    }
  }

  async lifecycleStage(customerId: string) {
    const patterns = await this.listChronicReorderPatterns(
      { customer_id: customerId },
      { take: null }
    )

    return this.computeLifecycleStage(patterns)
  }

  async churnScore(customerId: string): Promise<{
    score: number
    risk: "low" | "medium" | "high"
    factors: string[]
  }> {
    const patterns = await this.listChronicReorderPatterns(
      { customer_id: customerId, is_active: true },
      { take: null }
    )

    if (!patterns.length) {
      return { score: 50, risk: "medium", factors: ["No chronic medication patterns detected"] }
    }

    const factors: string[] = []
    let score = 0

    const now = new Date()
    let overdueCount = 0
    let totalConfidence = 0

    for (const p of patterns as any[]) {
      totalConfidence += p.confidence_score
      const nextExpected = new Date(p.next_expected_at)
      if (nextExpected < now) {
        overdueCount++
        const daysOverdue = Math.floor((now.getTime() - nextExpected.getTime()) / 86400000)
        if (daysOverdue > 14) {
          score += 30
          factors.push(`Refill overdue by ${daysOverdue} days for variant ${p.variant_id}`)
        } else {
          score += 10
        }
      }
    }

    if (overdueCount === patterns.length && patterns.length > 0) {
      score += 20
      factors.push("All chronic medications are overdue")
    }

    const avgConfidence = totalConfidence / patterns.length
    if (avgConfidence < 30) {
      score += 15
      factors.push("Low reorder pattern confidence")
    }

    score = Math.min(score, 100)

    const risk: "low" | "medium" | "high" =
      score >= 60 ? "high" : score >= 30 ? "medium" : "low"

    if (!factors.length) {
      factors.push("Customer appears active with regular reorders")
    }

    return { score, risk, factors }
  }

  private computeLifecycleStage(
    patterns: any[]
  ): "new" | "active" | "loyal" | "at_risk" | "dormant" {
    if (!patterns.length) return "new"

    const activePatterns = patterns.filter((p: any) => p.is_active)
    if (!activePatterns.length) return "dormant"

    const now = new Date()
    const allOverdue = activePatterns.every(
      (p: any) => new Date(p.next_expected_at) < now
    )

    if (allOverdue) return "at_risk"

    const avgConfidence =
      activePatterns.reduce((s: number, p: any) => s + p.confidence_score, 0) /
      activePatterns.length

    if (avgConfidence >= 70 && activePatterns.length >= 2) return "loyal"
    return "active"
  }
}

export default CrmModuleService
