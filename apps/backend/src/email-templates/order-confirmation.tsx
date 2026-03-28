import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Row,
  Column,
  Text,
  Img,
  Hr,
  Link,
} from "@react-email/components"
import { styles } from "./styles"

interface OrderItem {
  title: string
  subtitle: string
  thumbnail: string
  quantity: number
  unit_price: number
  compare_at_unit_price?: number
  total: number
}

interface Address {
  first_name: string
  last_name: string
  address_1: string
  address_2?: string
  postal_code: string
  city: string
  province?: string
  country_code: string
  phone?: string
}

interface OrderConfirmationProps {
  displayId: number
  email: string
  createdAt: string
  currencyCode: string
  items: OrderItem[]
  shippingAddress: Address
  itemSubtotal: number
  discountTotal: number
  shippingTotal: number
  taxTotal: number
  total: number
  paymentStatus: string
}

export const subject = (data: OrderConfirmationProps) =>
  `Suprameds — Order #${data.displayId || "N/A"} Confirmed`

export default function OrderConfirmation({
  displayId = 10201,
  email = "customer@example.com",
  createdAt = "2026-03-21T08:00:00.000Z",
  currencyCode = "INR",
  shippingAddress = {
    first_name: "Pawan",
    last_name: "Galiyan",
    address_1: "1981 Katra Lachhu Singh, Chandni Chowk",
    postal_code: "110006",
    city: "Delhi",
    province: "Delhi",
    country_code: "IN",
    phone: "8595624291",
  },
  items = [
    {
      title: "Paracetamol 500mg Tablet",
      subtitle: "Strip of 10 tablets",
      thumbnail: "",
      quantity: 3,
      unit_price: 12,
      compare_at_unit_price: 30,
      total: 36,
    },
  ],
  itemSubtotal = 36,
  discountTotal = 54,
  shippingTotal = 0,
  taxTotal = 2,
  total = 38,
}: OrderConfirmationProps) {
  const formatINR = (amount: number) => {
    return `₹${amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-IN", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const totalSavings = discountTotal > 0 ? discountTotal : 0

  return (
    <Html>
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.header}>
            <Text style={styles.headerLogo}>SUPRAMEDS</Text>
            <Text style={styles.headerTagline}>
              Affordable Generic Medicines
            </Text>
          </Section>

          {/* Content */}
          <Section style={styles.contentSection}>
            {/* Order Confirmation Banner */}
            <Section style={styles.orderBanner}>
              <Text style={styles.orderBannerText}>
                Order Confirmed!
              </Text>
              <Text style={styles.orderBannerSub}>
                Thank you for choosing Suprameds. Your order #{displayId} has been placed successfully.
              </Text>
            </Section>

            {/* Order Meta */}
            <Row>
              <Column>
                <Text style={styles.text}>
                  <strong>Order #:</strong> {displayId}
                </Text>
              </Column>
              <Column align="right">
                <Text style={styles.text}>
                  <strong>Date:</strong> {formatDate(createdAt)}
                </Text>
              </Column>
            </Row>

            <Hr style={styles.hr} />

            {/* Order Items */}
            <Text style={styles.heading}>Order Summary</Text>

            {items.map((item, index) => (
              <Row key={index} style={styles.itemRow}>
                {item.thumbnail && (
                  <Column style={styles.itemImageColumn}>
                    <Img
                      src={item.thumbnail}
                      alt={item.title}
                      width="80"
                      height="80"
                      style={styles.itemImage}
                    />
                  </Column>
                )}
                <Column style={{ verticalAlign: "top" }}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  {item.subtitle && (
                    <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
                  )}
                  <Text style={styles.itemPrice}>
                    Qty: {item.quantity} × {formatINR(item.unit_price)}
                    {item.compare_at_unit_price && item.compare_at_unit_price > item.unit_price && (
                      <>
                        {" "}
                        <span style={styles.strikethrough}>
                          {formatINR(item.compare_at_unit_price)}
                        </span>
                      </>
                    )}
                    {" = "}
                    <strong>{formatINR(item.total)}</strong>
                  </Text>
                  {item.compare_at_unit_price && item.compare_at_unit_price > item.unit_price && (
                    <Text style={styles.textGreen}>
                      You save {formatINR((item.compare_at_unit_price - item.unit_price) * item.quantity)} ({Math.round(((item.compare_at_unit_price - item.unit_price) / item.compare_at_unit_price) * 100)}% off)
                    </Text>
                  )}
                </Column>
              </Row>
            ))}

            {/* Totals */}
            <Section style={{ margin: "16px 0" }}>
              <Row style={styles.summaryRow}>
                <Column>
                  <Text style={styles.summaryText}>Subtotal</Text>
                </Column>
                <Column align="right">
                  <Text style={styles.summaryText}>
                    {formatINR(itemSubtotal)}
                  </Text>
                </Column>
              </Row>

              {discountTotal > 0 && (
                <Row style={styles.summaryRow}>
                  <Column>
                    <Text style={{ ...styles.summaryText, color: "#27AE60" }}>
                      Discount
                    </Text>
                  </Column>
                  <Column align="right">
                    <Text style={{ ...styles.summaryText, color: "#27AE60" }}>
                      -{formatINR(discountTotal)}
                    </Text>
                  </Column>
                </Row>
              )}

              <Row style={styles.summaryRow}>
                <Column>
                  <Text style={styles.summaryText}>
                    {shippingTotal > 0 ? "Shipping" : "Shipping (FREE)"}
                  </Text>
                </Column>
                <Column align="right">
                  <Text style={styles.summaryText}>
                    {shippingTotal > 0 ? formatINR(shippingTotal) : "₹0.00"}
                  </Text>
                </Column>
              </Row>

              <Row style={styles.summaryRow}>
                <Column>
                  <Text style={styles.summaryTextItalic}>GST (incl.)</Text>
                </Column>
                <Column align="right">
                  <Text style={styles.summaryTextItalic}>
                    {formatINR(taxTotal)}
                  </Text>
                </Column>
              </Row>

              <Hr style={{ ...styles.hr, margin: "12px 0" }} />

              <Row style={styles.summaryRow}>
                <Column>
                  <Text style={styles.summaryTextBold}>Total</Text>
                </Column>
                <Column align="right">
                  <Text style={styles.summaryTextBold}>
                    {formatINR(total)}
                  </Text>
                </Column>
              </Row>
            </Section>

            {/* Savings Badge */}
            {totalSavings > 0 && (
              <Section style={{ textAlign: "center", margin: "16px 0" }}>
                <Text style={styles.savingsBadge}>
                  You saved {formatINR(totalSavings)} on this order!
                </Text>
              </Section>
            )}

            <Hr style={styles.hr} />

            {/* Shipping Address */}
            <Text style={styles.heading}>Delivery Address</Text>
            <Section style={styles.addressBlock}>
              <Text style={{ ...styles.text, fontWeight: "600", margin: "0 0 4px" }}>
                {shippingAddress.first_name} {shippingAddress.last_name}
              </Text>
              <Text style={{ ...styles.text, margin: "0 0 2px" }}>
                {shippingAddress.address_1}
              </Text>
              {shippingAddress.address_2 && (
                <Text style={{ ...styles.text, margin: "0 0 2px" }}>
                  {shippingAddress.address_2}
                </Text>
              )}
              <Text style={{ ...styles.text, margin: "0 0 2px" }}>
                {shippingAddress.city}
                {shippingAddress.province ? `, ${shippingAddress.province}` : ""}{" "}
                - {shippingAddress.postal_code}
              </Text>
              {shippingAddress.phone && (
                <Text style={{ ...styles.text, margin: "0" }}>
                  Phone: {shippingAddress.phone}
                </Text>
              )}
            </Section>

            <Hr style={styles.hr} />

            {/* Delivery Info */}
            <Text style={styles.subheading}>Estimated Delivery</Text>
            <Text style={styles.text}>
              Your order will be delivered within <strong>2-7 business days</strong> depending on your location. Orders within Telangana arrive in 1-2 days.
            </Text>
            <Text style={styles.text}>
              Free delivery on orders above ₹300.
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
                href="mailto:support@supracynpharma.com"
                style={styles.footerLink}
              >
                support@supracynpharma.com
              </Link>
              {" | "}
              <Link href="tel:+917674962758" style={styles.footerLink}>
                +91 7674962758
              </Link>
            </Text>
            <Text style={{ ...styles.footerText, margin: "12px 0 0" }}>
              This email was sent to {email}. If you have questions about your
              order, please contact us.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
