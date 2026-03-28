import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Row,
  Column,
  Text,
  Hr,
  Link,
  Preview,
} from "@react-email/components"
import { styles } from "./styles"

interface DeliveryItem {
  title: string
  quantity: number
}

interface DeliveryConfirmationProps {
  order_id: string
  display_id: number
  delivered_at: string
  items: DeliveryItem[]
}

export const subject = (data: DeliveryConfirmationProps) =>
  `Order #${data.display_id} has been delivered`

export default function DeliveryConfirmation({
  order_id = "ord_01",
  display_id = 10201,
  delivered_at = "2026-04-02T14:30:00.000Z",
  items = [
    { title: "Paracetamol 500mg Tablet", quantity: 3 },
    { title: "Azithromycin 500mg Tablet", quantity: 1 },
  ],
}: DeliveryConfirmationProps) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-IN", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString("en-IN", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const orderUrl = `https://suprameds.in/in/account/orders/${order_id}`

  return (
    <Html>
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Preview>
        {`Your order #${display_id} has been delivered successfully.`}
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
            {/* Delivered Banner */}
            <Section style={styles.orderBanner}>
              <Text style={styles.orderBannerText}>
                Order Delivered
              </Text>
              <Text style={styles.orderBannerSub}>
                {`Your order #${display_id} has been delivered successfully.`}
              </Text>
            </Section>

            <Hr style={styles.hr} />

            {/* Delivery Details */}
            <Text style={styles.heading}>Delivery Details</Text>

            <Section style={styles.addressBlock}>
              <Text style={{ ...styles.text, margin: "0 0 4px" }}>
                <strong>Order #:</strong> {String(display_id)}
              </Text>
              <Text style={{ ...styles.text, margin: "0" }}>
                <strong>Delivered On:</strong> {formatDateTime(delivered_at)}
              </Text>
            </Section>

            <Hr style={styles.hr} />

            {/* Items Summary */}
            <Text style={styles.heading}>Items Delivered</Text>

            {items.map((item, index) => (
              <Row key={index} style={styles.itemRow}>
                <Column>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                </Column>
                <Column align="right">
                  <Text style={styles.text}>Qty: {item.quantity}</Text>
                </Column>
              </Row>
            ))}

            <Hr style={styles.hr} />

            {/* Return Window Notice */}
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
                  color: "#92400E",
                  fontSize: "13px",
                  fontWeight: "600",
                  margin: "0 0 4px",
                }}
              >
                Return Window: 48 Hours
              </Text>
              <Text
                style={{
                  color: "#92400E",
                  fontSize: "13px",
                  margin: "0",
                }}
              >
                If you received damaged, expired, or incorrect items, please
                contact us within 48 hours of delivery for a return or
                replacement.
              </Text>
            </Section>

            {/* CTA Button */}
            <Section style={{ textAlign: "center", margin: "24px 0" }}>
              <Link href={orderUrl} style={styles.button}>
                View Order
              </Link>
            </Section>

            <Text style={styles.textSecondary}>
              Thank you for choosing Suprameds. We hope your experience was
              excellent. If you have any concerns about your order, please do
              not hesitate to reach out to our support team.
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
