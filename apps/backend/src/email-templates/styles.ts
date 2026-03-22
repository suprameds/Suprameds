/**
 * Suprameds email template styles — Clinical-Clean Precision aesthetic.
 * Uses brand colors: Navy (#1E2D5A), Green (#27AE60), Cream (#FAFAF8).
 */
export const styles = {
  body: {
    backgroundColor: "#f4f5f7",
    fontFamily:
      '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    margin: "0",
    padding: "0",
  },
  container: {
    backgroundColor: "#ffffff",
    margin: "0 auto",
    padding: "0",
    maxWidth: "600px",
    borderRadius: "8px",
    overflow: "hidden",
  },
  header: {
    backgroundColor: "#1E2D5A",
    padding: "24px 32px",
    textAlign: "center" as const,
  },
  headerLogo: {
    color: "#ffffff",
    fontSize: "24px",
    fontWeight: "700",
    letterSpacing: "1px",
    margin: "0",
  },
  headerTagline: {
    color: "#8B9DC3",
    fontSize: "11px",
    letterSpacing: "2px",
    textTransform: "uppercase" as const,
    margin: "4px 0 0",
  },
  contentSection: {
    padding: "32px",
  },
  heading: {
    color: "#1E2D5A",
    fontSize: "18px",
    fontWeight: "600",
    lineHeight: "1.3",
    margin: "0 0 16px",
  },
  subheading: {
    color: "#1E2D5A",
    fontSize: "14px",
    fontWeight: "600",
    lineHeight: "1.3",
    margin: "0 0 12px",
  },
  text: {
    color: "#2C3E50",
    fontSize: "14px",
    lineHeight: "1.6",
    margin: "0 0 8px",
  },
  textSecondary: {
    color: "#6B7280",
    fontSize: "13px",
    lineHeight: "1.6",
  },
  textGreen: {
    color: "#27AE60",
    fontSize: "14px",
    fontWeight: "600",
  },
  hr: {
    borderColor: "#E5E7EB",
    margin: "24px 0",
  },
  orderBanner: {
    backgroundColor: "#F0FDF4",
    border: "1px solid #BBF7D0",
    borderRadius: "8px",
    padding: "16px 20px",
    marginBottom: "24px",
  },
  orderBannerText: {
    color: "#27AE60",
    fontSize: "16px",
    fontWeight: "600",
    margin: "0",
  },
  orderBannerSub: {
    color: "#15803D",
    fontSize: "13px",
    margin: "4px 0 0",
  },
  itemRow: {
    paddingBottom: "16px",
    borderBottom: "1px solid #F3F4F6",
    marginBottom: "16px",
  },
  itemImageColumn: {
    width: "80px",
    paddingRight: "16px",
    verticalAlign: "top" as const,
  },
  itemImage: {
    backgroundColor: "#F9FAFB",
    borderRadius: "6px",
    width: "80px",
    height: "80px",
    objectFit: "cover" as const,
  },
  itemTitle: {
    color: "#1E2D5A",
    fontSize: "14px",
    fontWeight: "600",
    lineHeight: "1.3",
    margin: "0 0 4px",
  },
  itemSubtitle: {
    color: "#6B7280",
    fontSize: "12px",
    margin: "0 0 4px",
  },
  itemPrice: {
    color: "#2C3E50",
    fontSize: "14px",
    fontWeight: "500",
    margin: "0",
  },
  itemMrp: {
    color: "#9CA3AF",
    fontSize: "12px",
    textDecoration: "line-through",
  },
  summaryRow: {
    marginBottom: "6px",
  },
  summaryText: {
    color: "#2C3E50",
    fontSize: "14px",
    lineHeight: "1.6",
    margin: "0",
  },
  summaryTextBold: {
    color: "#1E2D5A",
    fontSize: "15px",
    fontWeight: "700",
    lineHeight: "1.6",
    margin: "0",
  },
  summaryTextItalic: {
    color: "#6B7280",
    fontSize: "13px",
    fontStyle: "italic",
    lineHeight: "1.6",
    margin: "0",
  },
  savingsBadge: {
    backgroundColor: "#F0FDF4",
    color: "#27AE60",
    fontSize: "13px",
    fontWeight: "600",
    padding: "4px 10px",
    borderRadius: "4px",
    display: "inline-block",
  },
  strikethrough: {
    textDecoration: "line-through",
    color: "#9CA3AF",
  },
  addressBlock: {
    backgroundColor: "#FAFAF8",
    borderRadius: "8px",
    padding: "16px 20px",
  },
  footer: {
    backgroundColor: "#F9FAFB",
    padding: "24px 32px",
    textAlign: "center" as const,
  },
  footerText: {
    color: "#9CA3AF",
    fontSize: "11px",
    lineHeight: "1.6",
    margin: "0 0 4px",
  },
  footerLink: {
    color: "#1E2D5A",
    fontSize: "11px",
    textDecoration: "underline",
  },
  button: {
    backgroundColor: "#27AE60",
    borderRadius: "6px",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: "600",
    padding: "12px 24px",
    textDecoration: "none",
    textAlign: "center" as const,
    display: "inline-block",
  },
}
