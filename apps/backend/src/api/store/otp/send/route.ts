import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { Resend } from "resend"
import {
  isValidIndianPhone,
  isValidEmail,
  normalisePhone,
  normaliseEmail,
  generateOtp,
  canSendOtp,
  storeOtp,
} from "../otp-store"

type OtpChannel = "sms" | "email"

interface SendOtpBody {
  phone?: string
  email?: string
  channel?: OtpChannel
  country_code?: string
}

/**
 * POST /store/otp/send
 *
 * Sends a 6-digit OTP via SMS (MSG91) or Email (Resend).
 *
 * Body:
 *  - channel: "sms" | "email" (default: inferred from provided field)
 *  - phone: Indian 10-digit number (required for sms)
 *  - email: Valid email address (required for email)
 *  - country_code: default "91"
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as any
  const body = req.body as SendOtpBody

  // Infer channel from provided fields if not explicitly set
  const channel: OtpChannel = body.channel || (body.email ? "email" : "sms")

  if (channel === "sms") {
    return handleSmsSend(req, res, body, logger)
  } else {
    return handleEmailSend(req, res, body, logger)
  }
}

// ── SMS OTP via MSG91 ─────────────────────────────────────────────────

async function handleSmsSend(
  _req: MedusaRequest,
  res: MedusaResponse,
  body: SendOtpBody,
  logger: any,
) {
  const { phone, country_code = "91" } = body

  if (!phone) {
    return res.status(400).json({ success: false, message: "Phone number is required" })
  }

  if (!isValidIndianPhone(phone)) {
    return res.status(400).json({
      success: false,
      message: "Invalid Indian phone number. Must be 10 digits starting with 6-9.",
    })
  }

  const identifier = normalisePhone(phone, country_code)

  if (!(await canSendOtp(identifier))) {
    return res.status(429).json({
      success: false,
      message: "Too many OTP requests. Please try again after 10 minutes.",
    })
  }

  const authKey = process.env.MSG91_AUTH_KEY
  const templateId = process.env.MSG91_TEMPLATE_ID_OTP

  if (!authKey || !templateId) {
    logger.warn("[otp/send] MSG91 not configured — suggesting email OTP fallback")
    return res.status(503).json({
      success: false,
      message: "SMS service is temporarily unavailable. Please use Email OTP instead.",
      fallback_channel: "email",
    })
  }

  const otp = generateOtp()

  try {
    const msg91Response = await fetch("https://control.msg91.com/api/v5/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: authKey },
      body: JSON.stringify({ template_id: templateId, mobile: identifier, otp }),
    })

    const result = (await msg91Response.json()) as Record<string, unknown>

    if (!msg91Response.ok) {
      logger.error(`[otp/send] MSG91 API error: ${msg91Response.status}`)
      return res.status(502).json({
        success: false,
        message: "Failed to send SMS. Please try Email OTP instead.",
        fallback_channel: "email",
      })
    }

    await storeOtp(identifier, otp)
    logger.info(`[otp/send] SMS OTP dispatched to ${identifier}, ref: ${result.request_id ?? result.message}`)
  } catch (err: unknown) {
    logger.error(`[otp/send] MSG91 request failed: ${(err as Error).message}`)
    return res.status(502).json({
      success: false,
      message: "SMS service is temporarily unavailable. Please try Email OTP instead.",
      fallback_channel: "email",
    })
  }

  res.json({ success: true, channel: "sms", message: "OTP sent to your phone" })
}

// ── Email OTP via Resend ──────────────────────────────────────────────

async function handleEmailSend(
  _req: MedusaRequest,
  res: MedusaResponse,
  body: SendOtpBody,
  logger: any,
) {
  const { email } = body

  if (!email) {
    return res.status(400).json({ success: false, message: "Email address is required" })
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      message: "Invalid email address",
    })
  }

  const identifier = normaliseEmail(email)

  if (!(await canSendOtp(identifier))) {
    return res.status(429).json({
      success: false,
      message: "Too many OTP requests. Please try again after 10 minutes.",
    })
  }

  const resendApiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Suprameds <support@supracynpharma.com>"

  if (!resendApiKey) {
    logger.error("[otp/send] RESEND_API_KEY not configured — email OTP unavailable")
    return res.status(503).json({
      success: false,
      message: "Email service is temporarily unavailable. Please try Phone OTP instead.",
      fallback_channel: "sms",
    })
  }

  const otp = generateOtp()

  try {
    const resend = new Resend(resendApiKey)
    const result = await resend.emails.send({
      from: fromEmail,
      to: [identifier],
      subject: `${otp} is your Suprameds verification code`,
      html: buildOtpEmailHtml(otp),
      text: `Your Suprameds verification code is ${otp}. Valid for 5 minutes. Do not share this code.`,
    })

    if (result.error) {
      logger.error(`[otp/send] Resend error: ${result.error.message}`)
      return res.status(502).json({
        success: false,
        message: "Failed to send email. Please try Phone OTP instead.",
        fallback_channel: "sms",
      })
    }

    await storeOtp(identifier, otp)
    logger.info(`[otp/send] Email OTP sent to ${identifier}, id: ${result.data?.id}`)
  } catch (err: unknown) {
    logger.error(`[otp/send] Resend request failed: ${(err as Error).message}`)
    return res.status(502).json({
      success: false,
      message: "Email service is temporarily unavailable. Please try Phone OTP instead.",
      fallback_channel: "sms",
    })
  }

  res.json({ success: true, channel: "email", message: "OTP sent to your email" })
}

// ── OTP Email Template ────────────────────────────────────────────────

function buildOtpEmailHtml(otp: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:0;background:#F8F6F2;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #EDE9E1;overflow:hidden;">
    <div style="background:#0D1B2A;padding:24px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600;">Suprameds</h1>
    </div>
    <div style="padding:32px 24px;text-align:center;">
      <p style="margin:0 0 8px;color:#374151;font-size:15px;">Your verification code is</p>
      <div style="margin:16px 0;padding:16px;background:#F0FDF4;border-radius:8px;border:1px solid #BBF7D0;">
        <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#0D1B2A;font-family:monospace;">${otp}</span>
      </div>
      <p style="margin:16px 0 0;color:#6B7280;font-size:13px;">
        This code is valid for <strong>5 minutes</strong>.<br/>
        Do not share this code with anyone.
      </p>
    </div>
    <div style="padding:16px 24px;background:#F9FAFB;border-top:1px solid #EDE9E1;text-align:center;">
      <p style="margin:0;color:#9CA3AF;font-size:11px;">
        If you didn't request this code, please ignore this email.<br/>
        &copy; Suprameds &middot; Licensed Pharmacy &middot; suprameds.in
      </p>
    </div>
  </div>
</body>
</html>`.trim()
}
