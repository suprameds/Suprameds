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

interface OrderItem {
  title: string
  quantity: number
  unit_price: number
}

interface PharmacistOrderCreatedProps {
  display_id: number
  prescription_id: string
  items: OrderItem[]
  total: number
  shipping_address: {
    first_name: string
    last_name: string
    address_1: string
    city: string
    province?: string
    postal_code: string
    phone?: string
  }
  shop_url: string
}

export const subject = (data: PharmacistOrderCreatedProps) =>
  `Order #${data.display_id} created from your prescription`

export default function PharmacistOrderCreated({
  display_id = 10301,
  prescription_id = "RX-20260403-001",
  items = [
    { title: "Metformin 500mg Tablet (Strip of 10)", quantity: 3, unit_price: 25 },
    { title: "Sitagliptin 100mg Tablet (Strip of 7)", quantity: 1, unit_price: 180 },
  ],
  total = 255,
  shipping_address = {
    first_name: "Pawan",
    last_name: "Galiyan",
    address_1: "1981 Katra Lachhu Singh, Chandni Chowk",
    city: "Delhi",
    province: "Delhi",
    postal_code: "110006",
    phone: "8595624291",
  },
  shop_url = "https://suprameds.in/in/account/orders",
}: PharmacistOrderCreatedProps) {
  const formatINR = (amount: number) =>
    `\u20B9${amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`

  return (
    <Html>
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Preview>
        {`Your pharmacist created order #${display_id} from your prescription.`}
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
            {/* Banner */}
            <Section style={styles.orderBanner}>
              <Text style={styles.orderBannerText}>
                Order Created on Your Behalf
              </Text>
              <Text style={styles.orderBannerSub}>
                Our pharmacist reviewed your prescription and created order #{display_id}.
              </Text>
            </Section>

            <Text style={styles.text}>
              Good news! After reviewing your prescription ({prescription_id}),
              our licensed pharmacist has prepared your medicines order. The
              order will be dispatched after verification and you can pay on
              delivery.
            </Text>

            <Hr style={styles.hr} />

            {/* Items */}
            <Text style={styles.heading}>Order Summary</Text>

            {items.map((item, index) => (
              <Row key={index} style={styles.itemRow}>
                <Column style={{ verticalAlign: "top" }}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemPrice}>
                    Qty: {item.quantity} &times; {formatINR(item.unit_price)}
                    {" = "}
                    <strong>{formatINR(item.quantity * item.unit_price)}</strong>
                  </Text>
                </Column>
              </Row>
            ))}

            {/* Total */}
            <Section style={{ margin: "16px 0" }}>
              <Hr style={{ ...styles.hr, margin: "12px 0" }} />
              <Row style={styles.summaryRow}>
                <Column>
                  <Text style={styles.summaryTextBold}>Total (COD)</Text>
                </Column>
                <Column align="right">
                  <Text style={styles.summaryTextBold}>
                    {formatINR(total)}
                  </Text>
                </Column>
              </Row>
            </Section>

            <Hr style={styles.hr} />

            {/* Delivery Address */}
            <Text style={styles.heading}>Delivery Address</Text>
            <Section style={styles.addressBlock}>
              <Text style={{ ...styles.text, fontWeight: "600", margin: "0 0 4px" }}>
                {shipping_address.first_name} {shipping_address.last_name}
              </Text>
              <Text style={{ ...styles.text, margin: "0 0 2px" }}>
                {shipping_address.address_1}
              </Text>
              <Text style={{ ...styles.text, margin: "0 0 2px" }}>
                {shipping_address.city}
                {shipping_address.province ? `, ${shipping_address.province}` : ""}{" "}
                - {shipping_address.postal_code}
              </Text>
              {shipping_address.phone && (
                <Text style={{ ...styles.text, margin: "0" }}>
                  Phone: {shipping_address.phone}
                </Text>
              )}
            </Section>

            <Hr style={styles.hr} />

            <Text style={styles.text}>
              Payment mode is <strong>Cash on Delivery (COD)</strong>. You will
              pay the delivery person when your medicines arrive.
            </Text>

            {/* CTA */}
            <Section style={{ textAlign: "center", margin: "24px 0" }}>
              <Link href={shop_url} style={styles.button}>
                View Your Order
              </Link>
            </Section>

            <Text style={styles.textSecondary}>
              If you have questions about your order or need to make changes,
              contact our support team. Your medicines will be delivered within
              2-7 business days.
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
