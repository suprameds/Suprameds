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

interface ShippingItem {
  title: string
  quantity: number
}

interface ShippingConfirmationProps {
  order_id: string
  display_id: number
  awb_number: string
  carrier: string
  estimated_delivery: string
  tracking_url: string
  items: ShippingItem[]
}

export const subject = (data: ShippingConfirmationProps) =>
  `Order #${data.display_id} has been shipped!`

export default function ShippingConfirmation({
  order_id = "ord_01",
  display_id = 10201,
  awb_number = "AWB123456789",
  carrier = "Delhivery",
  estimated_delivery = "2026-04-02",
  tracking_url = "https://www.delhivery.com/track/AWB123456789",
  items = [
    { title: "Paracetamol 500mg Tablet", quantity: 3 },
    { title: "Azithromycin 500mg Tablet", quantity: 1 },
  ],
}: ShippingConfirmationProps) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-IN", {
      weekday: "short",
      year: "numeric",
      month: "short",
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
        Your order #{display_id} is on its way via {carrier}!
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
            {/* Shipped Banner */}
            <Section style={styles.orderBanner}>
              <Text style={styles.orderBannerText}>
                Order Shipped!
              </Text>
              <Text style={styles.orderBannerSub}>
                Your order #{display_id} is on its way to you.
              </Text>
            </Section>

            <Hr style={styles.hr} />

            {/* Shipment Details */}
            <Text style={styles.heading}>Shipment Details</Text>

            <Section style={styles.addressBlock}>
              <Text style={{ ...styles.text, margin: "0 0 4px" }}>
                <strong>Order #:</strong> {display_id}
              </Text>
              <Text style={{ ...styles.text, margin: "0 0 4px" }}>
                <strong>Carrier:</strong> {carrier}
              </Text>
              <Text style={{ ...styles.text, margin: "0 0 4px" }}>
                <strong>AWB Number:</strong> {awb_number}
              </Text>
              <Text style={{ ...styles.text, margin: "0" }}>
                <strong>Estimated Delivery:</strong>{" "}
                {formatDate(estimated_delivery)}
              </Text>
            </Section>

            {/* CTA Button */}
            <Section style={{ textAlign: "center", margin: "24px 0" }}>
              <Link href={tracking_url} style={styles.button}>
                Track Shipment
              </Link>
            </Section>

            <Hr style={styles.hr} />

            {/* Items Summary */}
            <Text style={styles.heading}>Items in this Shipment</Text>

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

            <Text style={styles.textSecondary}>
              You will receive a notification once your order has been
              delivered. If you have any questions about your shipment, please
              contact our support team.
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
