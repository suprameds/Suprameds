import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Link,
  Preview,
} from "@react-email/components"
import { styles } from "./styles"

interface RefundProcessedProps {
  order_id: string
  display_id: number
  refund_amount: number
  refund_method: string
  refund_id: string
}

export const subject = (data: RefundProcessedProps) =>
  `Refund of ₹${data.refund_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })} processed for Order #${data.display_id}`

export default function RefundProcessed({
  order_id = "ord_01",
  display_id = 10201,
  refund_amount = 250,
  refund_method = "Razorpay (Original Payment Method)",
  refund_id = "rfnd_NX1234567890",
}: RefundProcessedProps) {
  const formatINR = (amount: number) => {
    return `₹${amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  return (
    <Html>
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Preview>
        Your refund of {formatINR(refund_amount)} for Order #{display_id} has
        been processed.
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.header}>
            <Text style={styles.headerLogo}>SUPRAMEDS</Text>
            <Text style={styles.headerTagline}>
              Licensed Online Pharmacy
            </Text>
          </Section>

          {/* Content */}
          <Section style={styles.contentSection}>
            {/* Refund Banner */}
            <Section
              style={{
                backgroundColor: "#EFF6FF",
                border: "1px solid #BFDBFE",
                borderRadius: "8px",
                padding: "16px 20px",
                marginBottom: "24px",
              }}
            >
              <Text
                style={{
                  color: "#1D4ED8",
                  fontSize: "16px",
                  fontWeight: "600",
                  margin: "0",
                }}
              >
                Refund Processed
              </Text>
              <Text
                style={{
                  color: "#1E40AF",
                  fontSize: "13px",
                  margin: "4px 0 0",
                }}
              >
                Your refund for Order #{display_id} has been initiated
                successfully.
              </Text>
            </Section>

            <Hr style={styles.hr} />

            {/* Refund Details */}
            <Text style={styles.heading}>Refund Details</Text>

            <Section style={styles.addressBlock}>
              <Text style={{ ...styles.text, margin: "0 0 4px" }}>
                <strong>Order #:</strong> {display_id}
              </Text>
              <Text style={{ ...styles.text, margin: "0 0 4px" }}>
                <strong>Refund Amount:</strong>{" "}
                <span style={{ color: "#27AE60", fontWeight: "700" }}>
                  {formatINR(refund_amount)}
                </span>
              </Text>
              <Text style={{ ...styles.text, margin: "0 0 4px" }}>
                <strong>Refund Method:</strong> {refund_method}
              </Text>
              <Text style={{ ...styles.text, margin: "0" }}>
                <strong>Reference ID:</strong> {refund_id}
              </Text>
            </Section>

            <Hr style={styles.hr} />

            {/* Timeline Note */}
            <Section
              style={{
                backgroundColor: "#FAFAF8",
                borderRadius: "8px",
                padding: "16px 20px",
                marginBottom: "16px",
              }}
            >
              <Text style={styles.subheading}>When will I receive my refund?</Text>
              <Text style={styles.text}>
                Refunds typically reflect in your account within{" "}
                <strong>5-7 business days</strong>, depending on your bank or
                payment provider. For UPI payments, refunds may arrive sooner
                (1-3 business days).
              </Text>
            </Section>

            <Text style={styles.textSecondary}>
              Please save this email for your records. If the refund does not
              reflect within the expected time frame, please contact our support
              team with the reference ID above.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Suprameds — Supracyn Pharma Pvt Ltd
            </Text>
            <Text style={styles.footerText}>
              1st Floor, H.No 7-2-544, SRT 323 Sanathnagar, Hyderabad - 500018
            </Text>
            <Text style={styles.footerText}>
              GSTIN: 36ABGCS8302R1ZP | DL-20: TS/HYD/2021-82149
            </Text>
            <Text style={{ ...styles.footerText, margin: "8px 0 0" }}>
              <Link href="https://suprameds.in" style={styles.footerLink}>
                suprameds.in
              </Link>
              {" | "}
              <Link
                href="mailto:support@suprameds.in"
                style={styles.footerLink}
              >
                support@suprameds.in
              </Link>
              {" | "}
              <Link href="tel:+917674962758" style={styles.footerLink}>
                +91 7674962758
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
