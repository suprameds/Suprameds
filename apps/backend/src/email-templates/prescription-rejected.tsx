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

interface PrescriptionRejectedProps {
  prescription_id: string
  rejection_reason: string
  reupload_url: string
}

export const subject = (data: PrescriptionRejectedProps) =>
  `Prescription Needs Attention - Action Required`

export default function PrescriptionRejected({
  prescription_id = "RX-20260328-001",
  rejection_reason = "The uploaded image is unclear and the doctor's details are not legible.",
  reupload_url = "https://suprameds.in/in/account/prescriptions/upload",
}: PrescriptionRejectedProps) {
  return (
    <Html>
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Preview>
        Your prescription needs attention. Please upload a new one.
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
            {/* Warning Banner */}
            <Section
              style={{
                backgroundColor: "#FFFBEB",
                border: "1px solid #FDE68A",
                borderRadius: "8px",
                padding: "16px 20px",
                marginBottom: "24px",
              }}
            >
              <Text
                style={{
                  color: "#D97706",
                  fontSize: "16px",
                  fontWeight: "600",
                  margin: "0",
                }}
              >
                Prescription Needs Attention
              </Text>
              <Text
                style={{
                  color: "#92400E",
                  fontSize: "13px",
                  margin: "4px 0 0",
                }}
              >
                We were unable to verify your prescription. Please review the
                details below.
              </Text>
            </Section>

            <Text style={styles.text}>
              We understand this may be inconvenient, and we apologise for the
              trouble. Our pharmacist was unable to approve your prescription
              due to the reason outlined below.
            </Text>

            <Hr style={styles.hr} />

            {/* Rejection Details */}
            <Text style={styles.heading}>Details</Text>

            <Section style={styles.addressBlock}>
              <Text style={{ ...styles.text, margin: "0 0 4px" }}>
                <strong>Prescription ID:</strong> {prescription_id}
              </Text>
              <Text style={{ ...styles.text, margin: "0 0 8px" }}>
                <strong>Reason:</strong>
              </Text>
              <Text
                style={{
                  ...styles.text,
                  color: "#B45309",
                  fontWeight: "500",
                  margin: "0",
                }}
              >
                {rejection_reason}
              </Text>
            </Section>

            <Hr style={styles.hr} />

            {/* Common Reasons */}
            <Text style={styles.subheading}>Common reasons for rejection</Text>
            <Text style={styles.text}>
              - Blurry or unreadable image
            </Text>
            <Text style={styles.text}>
              - Missing doctor's name, registration number, or signature
            </Text>
            <Text style={styles.text}>
              - Prescription is expired (older than 6 months)
            </Text>
            <Text style={styles.text}>
              - Medicine names do not match the order
            </Text>

            <Hr style={styles.hr} />

            <Text style={styles.text}>
              Please upload a clear, complete prescription and we will review it
              promptly. Most prescriptions are verified within 2-4 hours.
            </Text>

            {/* CTA Button */}
            <Section style={{ textAlign: "center", margin: "24px 0" }}>
              <Link href={reupload_url} style={styles.button}>
                Upload New Prescription
              </Link>
            </Section>

            <Text style={styles.textSecondary}>
              Need help? Our support team is available to assist you. Reach out
              at support@suprameds.in or call +91 7674962758.
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
