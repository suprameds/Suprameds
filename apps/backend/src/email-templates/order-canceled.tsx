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

interface CanceledItem {
  title: string
  quantity: number
}

interface OrderCanceledProps {
  order_id: string
  display_id: number
  cancellation_reason: string
  refund_amount?: number
  items: CanceledItem[]
}

export const subject = (data: OrderCanceledProps) =>
  `Order #${data.display_id} has been cancelled`

export default function OrderCanceled({
  order_id = "ord_01",
  display_id = 10201,
  cancellation_reason = "Cancelled by customer request.",
  refund_amount = 250,
  items = [
    { title: "Paracetamol 500mg Tablet", quantity: 3 },
    { title: "Azithromycin 500mg Tablet", quantity: 1 },
  ],
}: OrderCanceledProps) {
  const formatINR = (amount: number) => {
    return `₹${amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  const storeUrl = "https://suprameds.in/in/store"

  return (
    <Html>
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Preview>
        Your order #{display_id} has been cancelled.
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
            {/* Cancelled Banner */}
            <Section
              style={{
                backgroundColor: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: "8px",
                padding: "16px 20px",
                marginBottom: "24px",
              }}
            >
              <Text
                style={{
                  color: "#DC2626",
                  fontSize: "16px",
                  fontWeight: "600",
                  margin: "0",
                }}
              >
                Order Cancelled
              </Text>
              <Text
                style={{
                  color: "#991B1B",
                  fontSize: "13px",
                  margin: "4px 0 0",
                }}
              >
                Your order #{display_id} has been cancelled.
              </Text>
            </Section>

            <Hr style={styles.hr} />

            {/* Cancellation Reason */}
            <Text style={styles.heading}>Cancellation Details</Text>

            <Section style={styles.addressBlock}>
              <Text style={{ ...styles.text, margin: "0 0 4px" }}>
                <strong>Order #:</strong> {display_id}
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
                {cancellation_reason}
              </Text>
            </Section>

            {/* Refund Info */}
            {refund_amount != null && refund_amount > 0 && (
              <>
                <Hr style={styles.hr} />

                <Section
                  style={{
                    backgroundColor: "#EFF6FF",
                    border: "1px solid #BFDBFE",
                    borderRadius: "8px",
                    padding: "16px 20px",
                    marginBottom: "16px",
                  }}
                >
                  <Text
                    style={{
                      color: "#1D4ED8",
                      fontSize: "14px",
                      fontWeight: "600",
                      margin: "0 0 4px",
                    }}
                  >
                    Refund Information
                  </Text>
                  <Text
                    style={{
                      color: "#1E40AF",
                      fontSize: "14px",
                      margin: "0",
                    }}
                  >
                    A refund of{" "}
                    <strong>{formatINR(refund_amount)}</strong> will be
                    processed to your original payment method within 5-7
                    business days.
                  </Text>
                </Section>
              </>
            )}

            <Hr style={styles.hr} />

            {/* Items */}
            <Text style={styles.heading}>Cancelled Items</Text>

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

            <Text style={styles.text}>
              We are sorry to see this order go. If you still need your
              medicines, you can place a new order anytime.
            </Text>

            {/* CTA Button */}
            <Section style={{ textAlign: "center", margin: "24px 0" }}>
              <Link href={storeUrl} style={styles.button}>
                Browse Medicines
              </Link>
            </Section>

            <Text style={styles.textSecondary}>
              If you have any questions about this cancellation or need
              assistance, please contact our support team.
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
