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

interface PaymentConfirmedProps {
  display_id: string
  order_id: string
  amount: number
  currency_code: string
}

export const subject = (data: PaymentConfirmedProps) =>
  `Suprameds — Payment Received for Order #${data.display_id || data.order_id || "N/A"}`

export default function PaymentConfirmed({
  display_id = "10201",
  order_id = "order_01ABC",
  amount = 538,
  currency_code = "INR",
}: PaymentConfirmedProps) {
  const orderId = display_id || order_id || "N/A"
  const currency = (currency_code || "INR").toUpperCase()
  const symbol = currency === "INR" ? "₹" : `${currency} `

  const formatAmount = (val: number) => {
    return val.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
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
        Payment of {symbol}{formatAmount(amount)} received for order #{orderId}.
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
            <Text style={styles.heading}>Payment Confirmed</Text>

            <Text style={styles.text}>
              We've received your payment for order{" "}
              <strong>#{orderId}</strong>.
            </Text>

            {/* Amount Banner */}
            {amount != null && (
              <Section style={styles.orderBanner}>
                <Text
                  style={{
                    ...styles.orderBannerText,
                    fontSize: "20px",
                  }}
                >
                  {symbol}{formatAmount(amount)}
                </Text>
                <Text style={styles.orderBannerSub}>Payment received</Text>
              </Section>
            )}

            <Text style={styles.text}>
              Your order is being prepared and will be dispatched shortly.
              You'll receive a notification when it's on its way.
            </Text>

            <Hr style={styles.hr} />

            <Text style={styles.textSecondary}>
              For any queries, reach out to us at{" "}
              <Link
                href="mailto:support@suprameds.in"
                style={{ color: "#27AE60" }}
              >
                support@suprameds.in
              </Link>
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
