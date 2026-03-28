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

interface WelcomeProps {
  first_name: string
}

export const subject = (_data: WelcomeProps) => `Welcome to Suprameds!`

export default function Welcome({
  first_name = "there",
}: WelcomeProps) {
  return (
    <Html>
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Preview>
        Welcome to Suprameds, {first_name}! Start saving on your medicines
        today.
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
            <Text style={styles.heading}>Welcome, {first_name}!</Text>

            <Text style={styles.text}>
              Thank you for creating your Suprameds account. You now have access
              to:
            </Text>

            <Text style={{ ...styles.text, paddingLeft: "16px" }}>
              {"- "}Quick reordering of your medicines
            </Text>
            <Text style={{ ...styles.text, paddingLeft: "16px" }}>
              {"- "}Easy prescription uploads
            </Text>
            <Text style={{ ...styles.text, paddingLeft: "16px" }}>
              {"- "}Order tracking from dispatch to delivery
            </Text>
            <Text style={{ ...styles.text, paddingLeft: "16px", margin: "0 0 24px" }}>
              {"- "}Free delivery on orders above ₹300
            </Text>

            {/* CTA Button */}
            <Section style={{ textAlign: "center", margin: "24px 0" }}>
              <Link href="https://suprameds.in/in/store" style={styles.button}>
                Browse Medicines
              </Link>
            </Section>

            <Hr style={styles.hr} />

            <Text style={styles.textSecondary}>
              Have a prescription? Upload it after placing your order — our
              pharmacist will review it within minutes.
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
