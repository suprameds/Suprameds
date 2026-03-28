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

interface PasswordResetProps {
  reset_url: string
  url: string
}

export const subject = (_data: PasswordResetProps) =>
  `Reset your Suprameds password`

export default function PasswordReset({
  reset_url = "",
  url = "https://suprameds.in/reset-password?token=abc123",
}: PasswordResetProps) {
  const resetLink = reset_url || url || "#"

  return (
    <Html>
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Preview>Reset your Suprameds password.</Preview>
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
            <Text style={styles.heading}>Password Reset</Text>

            <Text style={styles.text}>
              We received a request to reset your password. Click below to set a
              new one.
            </Text>

            {/* CTA Button */}
            <Section style={{ textAlign: "center", margin: "24px 0" }}>
              <Link href={resetLink} style={styles.button}>
                Reset Password
              </Link>
            </Section>

            <Hr style={styles.hr} />

            <Text
              style={{
                ...styles.textSecondary,
                color: "#9CA3AF",
              }}
            >
              If you didn't request this, ignore this email — your password
              won't change.
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
