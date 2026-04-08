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

interface BatchRecallNoticeProps {
  display_id: number
  lot_number: string
  recall_reason: string
  recall_authority: string
  product_name: string
}

export const subject = (data: BatchRecallNoticeProps) =>
  `Important: Product Recall Notice — Order #${data.display_id}`

export default function BatchRecallNotice({
  display_id = 10201,
  lot_number = "LOT-PCM500-001",
  recall_reason = "Quality concern identified during routine testing.",
  recall_authority = "CDSCO",
  product_name = "Paracetamol 500mg",
}: BatchRecallNoticeProps) {
  return (
    <Html>
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Preview>
        {`Product recall notice for your order #${display_id}`}
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
            {/* Recall Banner */}
            <Section
              style={{
                backgroundColor: "#FEF2F2",
                border: "2px solid #DC2626",
                borderRadius: "8px",
                padding: "16px 20px",
                marginBottom: "24px",
              }}
            >
              <Text
                style={{
                  color: "#DC2626",
                  fontSize: "18px",
                  fontWeight: "700",
                  margin: "0",
                }}
              >
                Product Recall Notice
              </Text>
              <Text
                style={{
                  color: "#991B1B",
                  fontSize: "13px",
                  margin: "4px 0 0",
                }}
              >
                A product from your order has been recalled. Please read the details below.
              </Text>
            </Section>

            <Hr style={styles.hr} />

            {/* Recall Details */}
            <Text style={styles.heading}>Recall Details</Text>

            <Section style={styles.addressBlock}>
              <Text style={{ ...styles.text, margin: "0 0 4px" }}>
                <strong>Order #:</strong> {display_id}
              </Text>
              <Text style={{ ...styles.text, margin: "0 0 4px" }}>
                <strong>Product:</strong> {product_name}
              </Text>
              <Text style={{ ...styles.text, margin: "0 0 4px" }}>
                <strong>Batch/Lot:</strong> {lot_number}
              </Text>
              <Text style={{ ...styles.text, margin: "0 0 4px" }}>
                <strong>Recall Authority:</strong> {recall_authority}
              </Text>
              <Text style={{ ...styles.text, margin: "0 0 4px" }}>
                <strong>Reason:</strong>
              </Text>
              <Text
                style={{
                  ...styles.text,
                  fontWeight: "500",
                  margin: "0",
                }}
              >
                {recall_reason}
              </Text>
            </Section>

            <Hr style={styles.hr} />

            {/* Action Required */}
            <Section
              style={{
                backgroundColor: "#FFFBEB",
                border: "1px solid #FDE68A",
                borderRadius: "8px",
                padding: "16px 20px",
                marginBottom: "16px",
              }}
            >
              <Text
                style={{
                  color: "#92400E",
                  fontSize: "14px",
                  fontWeight: "600",
                  margin: "0 0 8px",
                }}
              >
                What you should do
              </Text>
              <Text
                style={{
                  color: "#78350F",
                  fontSize: "14px",
                  margin: "0 0 4px",
                }}
              >
                1. Please stop using this product immediately.
              </Text>
              <Text
                style={{
                  color: "#78350F",
                  fontSize: "14px",
                  margin: "0 0 4px",
                }}
              >
                2. Keep the product safely aside for return or disposal.
              </Text>
              <Text
                style={{
                  color: "#78350F",
                  fontSize: "14px",
                  margin: "0",
                }}
              >
                3. Contact our support team for a full refund or replacement.
              </Text>
            </Section>

            <Hr style={styles.hr} />

            <Text style={styles.text}>
              We sincerely apologize for the inconvenience. Your safety is our top priority.
              Our team will reach out to assist you with the return and refund process.
            </Text>

            {/* CTA Button */}
            <Section style={{ textAlign: "center", margin: "24px 0" }}>
              <Link href="https://suprameds.in/in/account" style={styles.button}>
                View Your Orders
              </Link>
            </Section>

            <Text style={styles.textSecondary}>
              If you experience any adverse effects, please consult your doctor immediately
              and report to the nearest pharmacovigilance center.
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
