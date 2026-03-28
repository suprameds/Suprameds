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

interface UserInvitedProps {
  invite_url: string
}

export const subject = (_data: UserInvitedProps) =>
  `You're invited to join Suprameds Admin`

export default function UserInvited({
  invite_url = "https://suprameds.in/app/invite?token=abc123",
}: UserInvitedProps) {
  return (
    <Html>
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Preview>
        You've been invited to join the Suprameds Admin Dashboard.
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
            <Text style={styles.heading}>You're Invited!</Text>

            <Text style={styles.text}>
              You've been invited to join the{" "}
              <strong>Suprameds Admin Dashboard</strong>.
            </Text>

            <Text style={styles.text}>
              Click the button below to accept the invitation and set up your
              account.
            </Text>

            {/* CTA Button */}
            <Section style={{ textAlign: "center", margin: "24px 0" }}>
              <Link href={invite_url} style={styles.button}>
                Accept Invitation
              </Link>
            </Section>

            <Hr style={styles.hr} />

            <Text style={styles.textSecondary}>
              Or copy this link:{" "}
              <Link
                href={invite_url}
                style={{ color: "#27AE60", wordBreak: "break-all" }}
              >
                {invite_url}
              </Link>
            </Text>

            <Text
              style={{
                ...styles.textSecondary,
                color: "#9CA3AF",
                margin: "16px 0 0",
              }}
            >
              If you weren't expecting this invitation, you can safely ignore
              this email.
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
