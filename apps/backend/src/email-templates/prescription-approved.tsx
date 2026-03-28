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

interface PrescriptionApprovedProps {
  prescription_id: string
  doctor_name: string
  valid_until: string
  shop_url: string
}

export const subject = (data: PrescriptionApprovedProps) =>
  `Prescription Approved - You can now order medicines`

export default function PrescriptionApproved({
  prescription_id = "RX-20260328-001",
  doctor_name = "Dr. Sharma",
  valid_until = "2026-09-28",
  shop_url = "https://suprameds.in/in/store",
}: PrescriptionApprovedProps) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
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
        Your prescription has been verified. Shop Schedule H/H1 medicines now.
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
            {/* Approved Banner */}
            <Section style={styles.orderBanner}>
              <Text style={styles.orderBannerText}>
                Prescription Approved
              </Text>
              <Text style={styles.orderBannerSub}>
                Your prescription has been verified by our licensed pharmacist.
              </Text>
            </Section>

            <Text style={styles.text}>
              Great news! Our pharmacist has verified your prescription. You can
              now order Schedule H/H1 medicines linked to this prescription.
            </Text>

            <Hr style={styles.hr} />

            {/* Prescription Details */}
            <Text style={styles.heading}>Prescription Details</Text>

            <Section style={styles.addressBlock}>
              <Text style={{ ...styles.text, margin: "0 0 4px" }}>
                <strong>Prescription ID:</strong> {prescription_id}
              </Text>
              <Text style={{ ...styles.text, margin: "0 0 4px" }}>
                <strong>Prescribing Doctor:</strong> {doctor_name}
              </Text>
              <Text style={{ ...styles.text, margin: "0" }}>
                <strong>Valid Until:</strong> {formatDate(valid_until)}
              </Text>
            </Section>

            <Hr style={styles.hr} />

            <Text style={styles.text}>
              You can now browse and purchase prescription medicines on
              Suprameds. Your approved prescription will be automatically linked
              during checkout.
            </Text>

            {/* CTA Button */}
            <Section style={{ textAlign: "center", margin: "24px 0" }}>
              <Link href={shop_url} style={styles.button}>
                Shop Medicines
              </Link>
            </Section>

            <Text style={styles.textSecondary}>
              Please note: This prescription is valid until{" "}
              {formatDate(valid_until)}. You will need to upload a new
              prescription after this date. If you have any questions, contact
              our support team.
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
