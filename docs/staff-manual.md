# Suprameds Staff Operations Manual

**Version:** 1.0  
**Last Updated:** April 2026  
**Audience:** Customer support agents, pharmacists, warehouse managers, finance team, admin managers  
**Classification:** Internal Use Only

---

## Table of Contents

- [Part 1: Platform Overview](#part-1-platform-overview)
- [Part 2: Understanding the Storefront](#part-2-understanding-the-storefront)
- [Part 3: Admin Dashboard - Orders & Fulfillment](#part-3-admin-dashboard---orders--fulfillment)
- [Part 4: Admin Dashboard - Inventory & Warehouse](#part-4-admin-dashboard---inventory--warehouse)
- [Part 5: Admin Dashboard - Compliance & Regulatory](#part-5-admin-dashboard---compliance--regulatory)
- [Part 6: Admin Dashboard - Customer & Marketing](#part-6-admin-dashboard---customer--marketing)
- [Part 7: Admin Dashboard - User Management & Security](#part-7-admin-dashboard---user-management--security)
- [Part 8: Background Operations](#part-8-background-operations)
- [Part 9: Troubleshooting & FAQ](#part-9-troubleshooting--faq)
- [Appendices](#appendices)

---

# Part 1: Platform Overview

## 1.1 What is Suprameds

Suprameds is a licensed online pharmacy operated by Supracyn Pharma. We sell generic medicines at 50-80% below MRP (Maximum Retail Price). The medicines we sell contain the same active ingredients (salt compositions) as expensive branded drugs but cost significantly less because they are manufactured by our own group companies -- Supracyn Pharma (via Betamax Remedies) and Daxia Healthcare.

We are registered with CDSCO (Central Drugs Standard Control Organisation) and hold a valid drug license (DL: TS/HYD/2021-82149). Every prescription drug order is reviewed and dispensed by a registered pharmacist before shipping. All medicines are shipped via India Post Speed Post for nationwide coverage.

**Key facts:**
- Licensed online pharmacy under the Drugs & Cosmetics Act, 1940
- Generic medicines at 50-80% off MRP
- Pharmacist-dispensed orders
- Delivery across all 28 states and 8 UTs in India
- Support email: support@supracynpharma.com

## 1.2 System Components

Suprameds runs on three main systems:

| Component | What It Is | Who Uses It |
|-----------|------------|-------------|
| **Storefront** | The customer-facing website where people browse and buy medicines | Customers |
| **Admin Dashboard** | The back-office system for managing orders, inventory, prescriptions, and more | All staff |
| **Mobile App** | An Android app wrapper of the storefront for mobile customers | Customers |

The storefront is what customers see when they visit our website. The admin dashboard is where staff manage everything behind the scenes. Both systems are connected -- when a customer places an order on the storefront, it immediately appears in the admin dashboard for processing.

## 1.3 How to Access

| System | URL | Who Can Access |
|--------|-----|---------------|
| **Admin Dashboard** | `https://api.supracynpharma.com/app` | All staff with assigned roles |
| **Storefront** | `https://store.supracynpharma.com` | Everyone (public) |
| **Backend API** | `https://api.supracynpharma.com` | System only (not for manual use) |

To access the admin dashboard, open your web browser (Chrome recommended) and go to the admin URL. You will see a login screen. Enter your email and password to sign in. If your role requires MFA (Multi-Factor Authentication), you will be asked for a verification code after entering your password.

## 1.4 User Roles & Permissions

Suprameds uses a role-based access control (RBAC) system with 25 roles organized into 5 tiers. Each role has specific permissions that control what the person can see and do in the admin dashboard. You can only perform actions that your role permits.

### Tier 1 -- Customer Roles

These roles are for people who buy from us, not staff members.

| Role | Description |
|------|-------------|
| **Guest** | An unauthenticated visitor browsing the storefront. No admin access. |
| **Customer** | A registered individual buyer. No admin access. |
| **B2B Buyer** | A business buyer placing bulk orders. Can view orders and products. |
| **B2B Admin** | A B2B organization administrator. Can view orders, products, create purchase orders, and view analytics. Requires MFA. |

### Tier 2 -- Clinical Roles

These roles are for pharmacy staff who handle prescriptions and drug dispensing. All clinical roles require MFA.

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| **Pharmacy Technician** | Assists pharmacists with non-clinical tasks | View prescriptions, orders, batches, dispense records, H1 register (read-only) |
| **Pharmacist** | Registered pharmacist who verifies prescriptions and dispenses | Approve/reject prescriptions, create dispense entries, create H1 register entries, view orders and batches |
| **Pharmacist-in-Charge (PIC)** | Senior pharmacist with override authority | Everything a pharmacist can do, plus: final dispense approval, export H1 register, approve compliance overrides |

### Tier 3 -- Warehouse Roles

These roles are for warehouse and logistics staff.

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| **GRN Staff** | Creates goods-received notes when shipments arrive | Create and view GRNs |
| **QC Staff** | Inspects and approves incoming batches for quality | Approve GRNs, view batches |
| **Picker** | Picks items from shelves for customer orders | View warehouse data, shipments, orders |
| **Packer** | Packs orders for dispatch | View warehouse data, shipments, orders |
| **Dispatch Staff** | Hands off packages to courier | View warehouse data, create and view shipments, view orders |
| **Returns Staff** | Receives and inspects returned goods | View warehouse data, orders, batches, inventory |
| **Warehouse Manager** | Full warehouse, inventory, and batch authority. Requires MFA. | All warehouse operations, inventory management, batch management, GRN approval, shipment creation, purchase orders |

### Tier 4 -- Business & Admin Roles

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| **Support Agent** | Customer service -- read-only access | View orders, customers, shipments, prescriptions (read-only) |
| **Support Supervisor** | CS team lead with escalation access | Everything a support agent can do, plus: update orders and customers, create refunds |
| **Catalog Manager** | Manages the product catalog | Create, edit, delete, import, export products; view batches |
| **Content Moderator** | Reviews user-generated content | Read, update, approve, delete content |
| **Marketing Admin** | Manages promotions, loyalty, and notifications | Manage loyalty program, send notifications, view analytics and products |
| **Finance Admin** | Payment, refund, and financial reporting. Requires MFA. | View and process payments, approve refunds, view and export reports and analytics, view and export orders |
| **Compliance Officer** | Regulatory compliance and overrides. Requires MFA. | View and manage compliance records, approve override requests, export H1 register and reports, view prescriptions and batches |
| **Platform Admin** | Full platform access except user management. Requires MFA. | All permissions except creating/deleting roles and users |
| **Viewer** | Read-only dashboard access (default for new invites) | View orders, products, customers, inventory, analytics |

### Tier 5 -- Elevated Roles

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| **Super Admin** | Unrestricted system access. Maximum 3 accounts. | All permissions including user and role management |
| **CDSCO Inspector** | Read-only regulatory audit access with 48-hour time limit | View compliance records, H1 register, prescriptions, orders, batches, dispense records (read-only) |
| **Supplier** | External supplier with limited visibility | View purchase orders, products, batches |

## 1.5 Logging In & MFA Setup

**To log in to the Admin Dashboard:**
1. Go to `https://api.supracynpharma.com/app`
2. Enter your email address and password
3. Click "Sign In"
4. If your role requires MFA, enter the 6-digit code from your authenticator app

**Setting up MFA (Multi-Factor Authentication):**
MFA is required for all clinical roles, warehouse managers, B2B admins, finance admins, compliance officers, platform admins, and CDSCO inspectors.

1. Log in to the admin dashboard
2. Your admin account settings will show an option to set up MFA
3. Download an authenticator app (Google Authenticator or Authy) on your phone
4. Scan the QR code shown on screen with the authenticator app
5. Enter the 6-digit code from the app to verify setup
6. Save the backup codes in a safe place

> **Important:** If you lose access to your authenticator app, contact a Super Admin immediately. They can reset your MFA.

---

# Part 2: Understanding the Storefront

This section explains what customers see on the website. Understanding the storefront helps you answer customer questions and troubleshoot issues.

## 2.1 Home Page

The home page (`store.supracynpharma.com/in`) is the first thing customers see. It displays:

- **Hero section** with our value proposition: generic medicines at 50-80% off MRP
- **Featured products** -- the 4 most recently added medicines
- **Category icons** for quick navigation (e.g., Cardiac, Diabetes, Gastrointestinal)
- **Trust badges** showing our pharmacy license, pharmacist-dispensed guarantee, and delivery promise

The home page is optimized for fast loading with pre-fetched product data.

## 2.2 Store / Catalog

The store page (`/in/store`) shows the complete product catalog. Customers can:

- **Browse all medicines** in a grid layout
- **Search by name** using the search bar (searches product names and compositions)
- **Filter by drug schedule** (OTC, Prescription Required) using the schedule filter
- **Sort products** by newest, price, or name

Each product card in the grid shows the medicine name, price, MRP with savings percentage, dosage form badge (Tablet, Capsule, Syrup, etc.), and an "Add to Cart" button for OTC medicines. Prescription medicines show "Rx Required" instead.

> **Note:** Per the Drugs & Magic Remedies Act, 1954, product cards never show lifestyle or model images. Only the medicine packaging or a generic medicine icon is displayed.

## 2.3 Product Detail Pages

When a customer clicks on a product, they see the full product detail page (`/in/products/{product-name}`). This page shows:

- **Product name** following the naming convention (e.g., "Atorcyn 10")
- **Price and MRP** with percentage savings clearly displayed
- **Salt composition** (e.g., "Atorvastatin (10mg)")
- **Dosage form** shown as a badge (Tablet, Capsule, Syrup, etc.)
- **Drug schedule** badge -- OTC (green), H (orange), H1 (orange), X (red/prohibited)
- **Variant selector** if the medicine comes in multiple strengths or pack sizes
- **Manufacturer** information (Supracyn Pharma or Daxia Healthcare)
- **Inventory status** (In Stock / Out of Stock)
- **Add to Cart** button (or "Prescription Required" notice for Rx drugs)

If pharmaceutical clinical data is available, the page also shows tabs for:
- **Uses** -- what conditions the medicine treats
- **Side Effects** -- common and serious side effects
- **Drug Interactions** -- other medicines to avoid
- **FAQs** -- common questions about the medicine

Below the product details, customers see **related products** from the same category or with similar compositions.

## 2.4 Drug Information Pages

Drug information pages (`/in/drugs/{product-name}`) provide detailed clinical information about a medicine. These pages are designed as educational resources and show:

- Full clinical data about the medicine's composition
- Cheaper alternative medicines with the same active ingredients
- Detailed pharmacological information
- These pages are SEO-optimized to help patients find affordable alternatives

## 2.5 Shopping Cart

The cart page (`/in/cart`) shows all items the customer has added. It displays:

- Each item with name, quantity, and price
- Quantity adjustment controls (increase/decrease)
- Individual item savings (MRP vs. our price)
- **Total savings** across all items
- Cart subtotal
- A "Proceed to Checkout" button

## 2.6 Checkout Flow

Checkout (`/in/checkout`) is a step-by-step process:

**Step 1 -- Addresses:** The customer enters or selects a shipping address and billing address. Delivery availability is checked against our pincode database.

**Step 2 -- Delivery:** The customer sees estimated delivery days based on their pincode. Speed Post delivery timelines are shown.

**Step 3 -- Prescription:** If the cart contains any Schedule H or H1 medicines, the customer must upload a valid prescription. They can upload an image (JPG, PNG) or PDF of their prescription. The system validates the file format and size.

**Step 4 -- Payment:** The customer selects a payment method:
- **Razorpay** (online payment -- credit/debit card, UPI, net banking)
- **Cash on Delivery (COD)**

**Step 5 -- Review & Place Order:** The customer reviews their complete order and clicks "Place Order."

> **Important:** The system automatically blocks checkout if:
> - The cart contains Schedule X drugs (absolutely prohibited)
> - The cart contains Rx drugs without an approved prescription
> - Any discount or promotion is applied to a prescription drug

## 2.7 Payment Methods

**Razorpay (Online Payment):**
- Supports credit cards, debit cards, UPI, net banking, and wallets
- Payment is processed instantly through Razorpay's secure gateway
- If the Razorpay payment fails (e.g., Razorpay servers are down), the system automatically falls back to COD and shows a notification to the customer

**Cash on Delivery (COD):**
- Default payment option
- Customer pays in cash when the package is delivered
- No upfront payment required
- COD orders that remain unconfirmed are automatically cancelled after a set period

## 2.8 Customer Account Pages

Logged-in customers can access their account at `/in/account`. The account section includes:

| Page | What It Shows |
|------|--------------|
| **Profile** (`/account/profile`) | Customer name, email, phone number. Can edit personal details. |
| **Addresses** (`/account/addresses`) | Saved shipping and billing addresses. Can add, edit, or delete addresses. |
| **Orders** (`/account/orders`) | Complete order history with status, tracking info, and order details. |
| **Prescriptions** (`/account/prescriptions`) | All uploaded prescriptions with their review status (pending, approved, rejected). |
| **Wishlist** (`/account/wishlist`) | Saved products for later purchase. Customers get price drop alerts. |
| **Reminders** (`/account/reminders`) | Chronic medication refill reminders. The system detects repeat purchases and reminds patients when it is time to reorder. |
| **Verification** (`/account/verification`) | Identity verification documents (KYC) for enhanced account features. |
| **Change Password** (`/account/change-password`) | Password change form. |
| **Messages** (`/account/messages`) | Notifications and messages from Suprameds. |

Customers can also log in (`/account/login`), register (`/account/register`), request a password reset (`/account/forgot-password`), and reset their password (`/account/reset-password`).

## 2.9 Prescription Upload

Customers upload prescriptions at `/in/upload-rx` or during checkout. Here is how it works:

1. Customer takes a photo or scans their prescription from a registered doctor
2. They upload the image (JPG, PNG) or PDF file
3. The system saves the prescription and sets its status to "Pending Review"
4. A pharmacist reviews the prescription within the admin dashboard
5. The pharmacist verifies: doctor's name, registration number, patient name, medicines prescribed, dosage, and validity
6. The pharmacist approves, rejects, or requests modifications

**Review window:** Prescriptions should be reviewed within 4 hours of upload during business hours. Customers are notified via email/SMS about the status.

> **Warning:** A valid prescription must include: doctor's name, doctor's registration number, patient name, date, and the medicines with dosage. Prescriptions older than 6 months are typically not accepted.

## 2.10 Order Tracking & Delivery

After placing an order, customers can track it from their account order history. The order confirmation page (`/in/order/{orderId}/confirmed`) shows:

- Order number and confirmation details
- Estimated delivery date
- Tracking number (once shipped via India Post)
- Real-time tracking updates (synced from AfterShip)

Order statuses visible to customers:
- **Pending** -- Order received, awaiting processing
- **Processing** -- Order being prepared (pharmacist review for Rx orders)
- **Shipped** -- Package handed to India Post
- **Delivered** -- Package delivered
- **Cancelled** -- Order cancelled

## 2.11 Returns & Refunds

The returns policy page (`/returns`) explains:

- **48-hour return window:** Customers have 48 hours from delivery to request a return
- **Eligible items:** Only damaged, defective, or wrong medicines can be returned. Opened medicine strips/bottles are generally not accepted for return due to safety regulations.
- **Process:** Customer contacts support, return is authorized, customer ships the item back, warehouse inspects the return, refund is processed

## 2.12 Legal Pages

These compliance pages are accessible from the footer of every page:

| Page | URL | What It Contains |
|------|-----|-----------------|
| **Terms & Conditions** | `/terms` | Terms of use, payment terms, liability limitations |
| **Privacy Policy** | `/privacy` | Data collection, DPDP Act compliance, how we protect patient data |
| **Prescription Policy** | `/prescription-policy` | What requires a prescription, how prescriptions are verified, drug schedule explanations |
| **Returns Policy** | `/returns` | Return eligibility, 48-hour window, refund process |
| **Grievance Redressal** | `/grievance` | How to file a complaint, grievance officer contact details, resolution timelines |
| **Pharmacy Licenses** | `/pharmacy/licenses` | Our drug license details, pharmacist information, CDSCO registration |

---

# Part 3: Admin Dashboard - Orders & Fulfillment

## 3.1 Dashboard Analytics

**Location:** Admin Dashboard > Analytics (sidebar)

The analytics dashboard provides a real-time overview of business performance. It includes:

**KPI Cards (top of page):**
- Orders Today / This Week / This Month / Total
- Revenue Today / This Week / This Month
- Average Order Value

**Revenue Trend Chart:**
- Shows last 30 days of revenue as a bar chart
- Displays daily revenue amount and order count
- Shows period totals at the bottom (total revenue, total orders, AOV)

**Order Status Distribution:**
- Visual bar chart showing how orders are distributed across statuses (pending, processing, shipped, completed, delivered, cancelled)
- Each status shown as a percentage of total orders

**Payment Methods Breakdown:**
- Table showing each payment method (Razorpay, COD), order count, and revenue
- **Prescription vs OTC ratio** -- shows the split between prescription drug orders and over-the-counter orders

**Product Performance:**
- Switchable views: Top Sellers, Slow Movers, Out of Stock
- **Top Sellers:** Products sorted by units sold with revenue
- **Slow Movers:** Products with low daily sales velocity
- **Out of Stock:** Products with zero inventory
- Each product shows its drug schedule (OTC, H, H1, X)

**All-Time Top 5 Products:**
- The five best-selling products across all time with units and revenue

## 3.2 Order Management

Orders are managed through Medusa's built-in order management system in the admin dashboard.

**Viewing Orders:**
1. Go to Admin Dashboard > Orders (sidebar)
2. You see a list of all orders with status, customer name, date, and total
3. Click any order to see full details

**Order Statuses:**
| Status | Meaning |
|--------|---------|
| **Pending** | Order placed, awaiting processing |
| **Requires Action** | Needs intervention (e.g., prescription review needed) |
| **Processing** | Being prepared for shipment |
| **Shipped** | Handed to carrier with tracking number |
| **Delivered** | Successfully delivered to customer |
| **Completed** | Order cycle complete |
| **Cancelled** | Order cancelled (by customer, staff, or system) |

**Order Lifecycle:**
1. Customer places order -> status becomes **Pending**
2. If Rx items present -> pharmacist must review prescription
3. Pharmacist approves -> inventory allocated (FEFO)
4. Picker picks items -> packer packs -> pharmacist does pre-dispatch sign-off (for Rx orders)
5. Dispatch staff creates shipment -> status becomes **Shipped**
6. AfterShip syncs tracking updates -> eventually **Delivered**

## 3.3 Prescription Review Queue

**Location:** Admin Dashboard > Dispense (sidebar) > Rx Queue tab, OR Admin Dashboard > Pharmacist > Rx Queue

This is where pharmacists review uploaded prescriptions. Only users with the **Pharmacist**, **Pharmacist-in-Charge**, or **Pharmacy Technician** role can access this section.

**The Rx Queue shows:**
- Number of pending prescriptions awaiting review
- Number of pending individual drug line items
- Age of the oldest waiting prescription
- A table listing each prescription with: Rx ID, patient name, doctor name and registration number, status, number of items, number of pending items, and submission date

**Reviewing a Prescription:**
1. Go to Admin Dashboard > Dispense > Rx Queue tab
2. Click on a prescription to open its details (or click "Review Next" to get the oldest pending one)
3. View the uploaded prescription image/PDF
4. Verify: doctor's name, doctor registration number, patient name, medicines listed, dosages, and date
5. For each drug line item, make a decision:
   - **Approve** -- prescription is valid, drug can be dispensed
   - **Reject** -- prescription is invalid (must provide rejection reason)
   - **Substitute** -- recommend a generic alternative
   - **Quantity Modified** -- adjust the prescribed quantity

**Priority Sorting:**
Prescriptions containing Schedule H1 drugs are automatically sorted to the top of the queue (marked with a red "H1" badge) because they have additional regulatory requirements.

**Filtering and Search:**
- Filter by status: Pending Review, Approved, Rejected, Expired
- Filter by date: Today, Last 7 Days, All Time
- Search by Rx ID, customer name, or phone number

> **Warning:** All pharmacist decisions are permanently logged for CDSCO compliance. Decisions cannot be deleted or altered after submission.

## 3.4 Dispensing & Pre-Dispatch

**Location:** Admin Dashboard > Dispense (sidebar)

The Dispense page has three tabs:

**Tab 1 -- Rx Queue:** (described above)

**Tab 2 -- Decisions Log:**
A complete audit trail of all pharmacist dispensing decisions. Shows:
- Summary cards: total approved, rejected, substituted, quantity modified
- Filter by decision type
- Search by ID, patient name, or pharmacist
- Each entry shows: Decision ID, Rx Line, Patient, Decision badge, whether it was an override, the pharmacist who made it, reason/notes, and date

**Tab 3 -- Pre-Dispatch Sign-offs:**
Before any order containing prescription medicines can be shipped, a pharmacist must perform a pre-dispatch sign-off. This is a final compliance check.

- Shows total sign-offs, how many passed, and how many failed
- Each sign-off record shows: Order ID, Pharmacist, Pass/Fail result, a viewable checklist of compliance checks, notes, and date
- The checklist verifies items like: correct medicine matched to prescription, batch not expired, quantity matches, H1 register entry created (if applicable)

> **Important:** An order containing prescription drugs CANNOT be shipped without a pharmacist sign-off. This is a legal requirement.

## 3.5 Pick Lists & FEFO Allocation

**Location:** Admin Dashboard > Warehouse (sidebar) > Pick Lists tab

**What is FEFO?**
FEFO stands for "First Expiry, First Out." It means the system automatically assigns the oldest-expiring stock to orders first. This prevents medicines from expiring on our shelves.

**How Pick Lists Work:**
1. When an order is placed, the system automatically allocates inventory using FEFO
2. A pick list is generated showing warehouse staff exactly which items to pick, from which bin location, and which batch
3. Each pick line shows: bin location, batch number, order item, quantity to pick, and current status

**Using Pick Lists:**
1. Go to Warehouse > Pick Lists
2. Click "Generate Pick List" to create picks for pending orders
3. Filter by status: Pending, Picked, Short Pick, Exception
4. For each pending item, go to the shelf, pick the item, then click "Pick" to mark it as picked
5. If an item is not available, mark it as a "Short Pick" or "Exception"

**Pick Statuses:**
| Status | Meaning |
|--------|---------|
| **Pending** | Waiting to be picked |
| **Picked** | Successfully picked from shelf |
| **Short Pick** | Partial quantity available |
| **Exception** | Problem encountered (requires manager attention) |

## 3.6 Shipping & Tracking

Once an order is picked, packed, and signed off (for Rx orders), the dispatch staff creates a shipment:

1. Go to the order detail in Admin Dashboard > Orders
2. Create a fulfillment with tracking number
3. The system sends tracking notification to the customer via email

**AfterShip Integration:**
Tracking updates are automatically synced from carriers (primarily India Post) via AfterShip. The system checks for updates every 5 minutes and updates the order status accordingly.

## 3.7 Returns Processing

**Location:** Admin Dashboard > Warehouse > Returns (accessible via warehouse routes)

When a customer initiates a return:
1. Returns staff receives the returned package
2. They inspect the item for damage, expiry, and seal integrity
3. They record findings in the system
4. Based on inspection results:
   - **Restock:** Item is in good condition, return to inventory
   - **Destroy:** Item is damaged, expired, or opened -- cannot be restocked
5. A refund is initiated if the return is approved

## 3.8 Refund Management

**Location:** Admin Dashboard > Refunds (sidebar)

The refund page shows all refund requests with their statuses.

**Refund Statuses:**
| Status | Meaning |
|--------|---------|
| **Pending Approval** | Refund requested, awaiting approval |
| **Approved** | Refund approved, awaiting processing |
| **Rejected** | Refund request denied |
| **Processed** | Money returned to customer |

**COD Refunds:**
For COD orders, we need the customer's bank details to process the refund. The system collects: account holder name, bank name, account number, IFSC code, and optionally UPI ID. These details must be verified before processing.

**To approve a refund:**
1. Go to Admin Dashboard > Refunds
2. Review the refund request (reason, amount, order details)
3. Click "Approve" or "Reject"
4. For COD refunds, verify the bank details before processing

> **Important:** Only users with `refund:approve` permission (Finance Admin, Support Supervisor, Platform Admin) can approve refunds.

## 3.9 COD Reconciliation

**Location:** Admin Dashboard > COD Reconciliation (sidebar)

This page is for reconciling cash collected from COD deliveries. When delivery partners collect cash from customers, we need to match those collections against our orders.

**How to reconcile:**
1. Go to COD Reconciliation
2. Paste CSV data containing: order ID, amount collected, and collection date
3. The system parses the data and matches it against orders
4. Review the results -- each row shows whether it was processed, skipped, or had errors
5. The system updates payment records for matched orders

---

# Part 4: Admin Dashboard - Inventory & Warehouse

## 4.1 Product Catalog

Products are managed through the standard Medusa admin interface at Admin Dashboard > Products.

Each product in Suprameds has:
- **Title:** Medicine name following our naming convention (e.g., "Atorcyn 10")
- **Handle:** URL-friendly slug (e.g., "atorcyn-10")
- **Variants:** Different pack sizes or strengths
- **Pharma metadata:** Linked drug product data including salt composition, schedule, dosage form, manufacturer, and clinical information

## 4.2 Creating New Medicines

**Location:** Admin Dashboard > Products > Create Medicine (sidebar route)

When adding a new medicine to the catalog:

**Required Fields:**
- Product title (following naming convention -- see Appendix C)
- At least one variant with pricing
- Salt composition (e.g., "Atorvastatin (10mg)")
- Drug schedule (OTC, H, H1, or X)
- Dosage form (Tablet, Capsule, Syrup, Injection, etc.)
- Manufacturer (Supracyn Pharma or Daxia Healthcare)
- MRP (Maximum Retail Price)

**Optional but recommended:**
- Generic name
- Therapeutic category
- Uses, side effects, drug interactions
- Storage conditions

> **Warning:** Never enter a selling price higher than MRP. The system enforces MRP compliance, but always double-check. Selling above MRP is illegal under the Drug Price Control Order (DPCO).

## 4.3 Bulk Product Import

**Location:** Admin Dashboard > Products > Import (sidebar route)

For adding multiple products at once via CSV file upload:

1. Download the CSV template from the import page
2. Fill in product data following the required format
3. Upload the completed CSV file
4. Review the import preview for errors
5. Confirm the import

The import validates that all required fields are present and that data formats are correct.

## 4.4 Batch Management

**Location:** Admin Dashboard > Pharma (sidebar) for batch-related operations

Every medicine we sell must be tracked by batch. A batch represents a specific production run with a unique lot number and expiry date.

**Batch information includes:**
- Lot/batch number (from manufacturer)
- Manufacturing date
- Expiry date
- Quantity received
- Current stock level
- QC status (pending, pass, fail)
- Batch status (active, quarantined, recalled, expired)

**To view batches:**
1. Go to Admin Dashboard > Pharma
2. You can see all batches with their expiry dates and status
3. Batches approaching expiry are flagged automatically

> **Warning:** Never dispense medicines from an expired batch. The system blocks expired batches from FEFO allocation, but always verify visually.

## 4.5 Inventory Levels

**Location:** Admin Dashboard > Warehouse > Inventory (sidebar route)

This page shows current stock levels for all products across the warehouse. You can:
- View available quantity for each product variant
- See reserved quantities (allocated to pending orders)
- Monitor stock levels against minimum thresholds

Inventory is synced to the storefront every 15 minutes via an automated job. This means there can be a brief delay between warehouse stock changes and what customers see online.

## 4.6 Low Stock Alerts

The system automatically checks stock levels daily and sends alerts when any product falls below its minimum stock threshold. These alerts go to warehouse managers and catalog managers so they can initiate purchase orders.

## 4.7 Near-Expiry Flagging

An automated daily job scans all active batches and flags those approaching expiry (typically within 90 days). Flagged batches:
- Are prioritized in FEFO allocation (shipped first)
- Generate alerts for warehouse managers
- May require special handling (e.g., returns to supplier, discounted sale, or destruction)

## 4.8 Warehouse Zones & Bins

**Location:** Admin Dashboard > Warehouse > Bins (sidebar route)

The warehouse is organized into zones and bins (storage locations):

- **Zones:** Logical areas like ambient storage, quarantine, dispatch staging, returns
- **Bins:** Specific shelf locations within zones (e.g., Rack A, Shelf 3, Position 2)

Each product batch is assigned to a specific bin. When pick lists are generated, they tell the picker exactly which bin to go to.

## 4.9 Goods Receipt Notes (GRN)

**Location:** Admin Dashboard > Procurement > Goods Receipt tab

A GRN is created every time goods are received from a supplier. It records what was received, in what quantity, and with what batch information.

**Creating a GRN:**
1. Go to Procurement > Goods Receipt tab
2. Click "New GRN"
3. Fill in: GRN number (auto-generated), supplier ID, supplier invoice number, received by (your name)
4. Add line items: product name, batch number, expiry date, quantity
5. Click "Create GRN"

**GRN Statuses:**
| Status | Meaning |
|--------|---------|
| **Pending QC** | Goods received, awaiting quality check |
| **Approved** | QC passed, goods accepted into inventory |
| **Partially Rejected** | Some items passed QC, some failed |
| **Rejected** | All items failed QC |

**QC Approval:**
After a GRN is created, QC Staff must inspect the goods:
1. Open the GRN detail
2. Review each line item
3. Click "Approve GRN" if all items pass, or "Reject" with a reason if they fail

## 4.10 Purchase Orders

**Location:** Admin Dashboard > Procurement (sidebar) > Purchase Orders tab

Purchase orders (POs) track what we order from suppliers.

**Creating a Purchase Order:**
1. Go to Procurement > Purchase Orders tab
2. Click "Create Purchase Order"
3. Fill in: PO number (auto-generated), supplier name, contact, order date, expected delivery date
4. Add line items: search for products, enter lot number, expiry date, quantity, MRP, and purchase price
5. Click "Save as Draft" or "Save & Mark Ordered"

**PO Statuses:**
| Status | Meaning |
|--------|---------|
| **Draft** | PO created but not yet sent to supplier |
| **Ordered** | PO sent to supplier, awaiting delivery |
| **Partial** | Some items received, others pending |
| **Received** | All items received and verified |
| **Cancelled** | PO cancelled |

**Receiving Goods Against a PO:**
1. Open the PO detail
2. Click "Receive Goods"
3. Enter the actual quantity received for each line item
4. Click "Confirm Receipt"
5. The system automatically creates inventory batches from the received quantities

---

# Part 5: Admin Dashboard - Compliance & Regulatory

## 5.1 Understanding Drug Schedules

Indian law classifies drugs into schedules that determine how they can be sold. This is critical knowledge for all Suprameds staff.

| Schedule | What It Means | Our Policy |
|----------|--------------|------------|
| **OTC (Over The Counter)** | Can be sold without a prescription | Customers can buy directly. No restrictions. |
| **Schedule H** | Prescription required by law | Customer must upload a valid prescription. Pharmacist must review and approve before dispensing. |
| **Schedule H1** | Prescription required + must be recorded in H1 Register | Same as Schedule H, plus: every sale must be logged in the H1 Register with patient name, doctor details, batch number, and pharmacist name. |
| **Schedule X** | Absolutely prohibited for sale (Narcotic and Psychotropic Substances) | **WE DO NOT SELL SCHEDULE X DRUGS. EVER.** The system blocks any attempt to add Schedule X products to the cart. |

> **WARNING: Selling Schedule H or H1 drugs without a valid prescription is a criminal offense under the Drugs & Cosmetics Act, 1940. Selling Schedule X drugs carries severe penalties under the NDPS Act, 1985, including imprisonment. There are NO exceptions.**

## 5.2 H1 Register

**Location:** Admin Dashboard > H1 Register (sidebar)

The H1 Register is a legal requirement under the Drugs & Cosmetics Rules. Every time we dispense a Schedule H1 drug, we must record the following details:

- Date of dispensing
- Patient name, address, and age
- Prescribing doctor's name and registration number
- Drug name and brand name
- Schedule designation (H1)
- Quantity dispensed
- Batch number
- Dispensing pharmacist's name and registration number
- Order/invoice reference

**Using the H1 Register:**
1. Go to H1 Register in the sidebar
2. Set the date range you want to view
3. The system shows summary stats: total entries, unique patients, unique drugs, total quantity dispensed
4. Today's entries are highlighted at the top
5. Below that, all entries for the selected date range are shown in a table

**Exporting for Audit:**
The H1 Register can be exported as CSV or JSON. This is essential for CDSCO/drug inspector audits.
1. Set the date range
2. Click "Export CSV" or "Export JSON"
3. The file downloads to your computer
4. Provide this to inspectors when requested

> **Important:** The H1 Register is automatically populated when pharmacists approve Schedule H1 prescriptions. Manual entries are not needed for standard operations. Always keep this register up to date and available for inspection.

## 5.3 Prescription Policy

**What requires a prescription:**
- All Schedule H drugs
- All Schedule H1 drugs
- Any medicine marked as "Rx" in our system

**Pharmacist review process:**
1. Customer uploads prescription (image or PDF)
2. Pharmacist verifies the prescription is legitimate
3. Pharmacist checks: doctor details, patient name, medicine names and dosages, date, signature
4. Pharmacist approves, rejects, substitutes, or modifies quantity for each line item
5. Only after approval can the order proceed to fulfillment

**Approval criteria:**
- Prescription must be from a registered medical practitioner
- Must include doctor's registration number
- Must be dated within the last 6 months
- Must clearly list medicine names and dosages
- Must include patient name

## 5.4 MRP Compliance

**What is MRP?**
MRP (Maximum Retail Price) is the highest price at which a product can be sold to consumers in India. It is printed on every medicine package.

**Why it matters:**
Under the Legal Metrology Act and the Drug Price Control Order (DPCO), selling any product above its MRP is illegal and punishable with fines and imprisonment.

**How the system enforces it:**
- When a product has multiple batches in stock, the system uses the HIGHEST MRP across all batches being dispatched for an order
- The selling price can be lower than MRP (this is how we offer 50-80% savings) but NEVER higher
- Price cache is invalidated immediately when products are updated to prevent stale MRP data from being shown
- The system blocks checkout if any item's price exceeds MRP

## 5.5 PHI Access Logs

**Location:** Admin Dashboard > Compliance (sidebar) > PHI Audit Log tab

PHI stands for Patient Health Information. Under Indian data protection law (DPDP Act, 2023) and healthcare regulations, we must track who accesses patient health data and when.

**The PHI Audit Log records:**
- Timestamp of access
- Who accessed it (user ID and role)
- What action was taken (read, write, update, export, print)
- What data was accessed (entity type and ID)
- IP address of the accessor
- Whether access was granted or denied

**Using the log:**
1. Go to Compliance > PHI Audit Log tab
2. Filter by action type (read, write, update, export, print)
3. Search by entity or user
4. Paginate through results

This log is automatically maintained by the system. You cannot edit or delete entries.

## 5.6 Compliance Override Requests

**Location:** Admin Dashboard > Compliance (sidebar) > Override Requests tab

Sometimes, standard compliance rules need to be overridden in exceptional circumstances. Override requests provide a controlled, audited process for this.

**Override request details include:**
- Override type and target entity
- Who requested it and their role
- Justification for the override
- Patient impact assessment
- Risk assessment (low, medium, high)
- Supporting documentation (if any)
- Whether dual authorization is required

**Override statuses:**
| Status | Meaning |
|--------|---------|
| **Pending Primary** | Awaiting first approver |
| **Pending Secondary** | First approver approved, awaiting second approver (for dual auth) |
| **Approved** | Override granted |
| **Rejected** | Override denied |
| **Expired** | Override request timed out |
| **Used** | Override was used |

**Reviewing an override request:**
1. Go to Compliance > Override Requests tab
2. Filter by status (pending requests are highlighted)
3. Click "Review" on a pending request
4. Read the justification, risk assessment, and patient impact
5. Enter reviewer notes (required)
6. Click "Approve" or "Reject"

> **Warning:** High-risk overrides may require dual authorization (two separate approvers). The system enforces separation of duties -- the person who requests an override cannot approve their own request.

## 5.7 DPDP Consent Records

**Location:** Admin Dashboard > Compliance (sidebar) > DPDP Consents tab

The DPDP (Digital Personal Data Protection) Act, 2023 requires us to track customer consent for data processing. This tab shows:

- All consent records with categories (essential, functional, analytics, marketing)
- Whether consent is active or withdrawn
- When consent was given and when it was withdrawn (if applicable)
- IP address and privacy policy version

## 5.8 Pharmacy Licenses

**Location:** Admin Dashboard > Compliance (sidebar) > Pharmacy Licenses tab

This tab displays all pharmacy licenses on file with their validity dates and current status. The system automatically flags licenses that are:
- **Expiring Soon** (within 30 days) -- shown with an orange badge
- **Expired** -- shown with a red badge

Keeping licenses current and valid is a legal requirement. An expired license means we cannot legally operate.

---

# Part 6: Admin Dashboard - Customer & Marketing

## 6.1 Customer Management

Customers are managed through the standard Medusa admin at Admin Dashboard > Customers. You can:

- View customer profiles (name, email, phone, registration date)
- View their order history
- View their addresses
- See linked prescriptions

> **Note:** Under DPDP Act, all customer data access is logged in the PHI audit trail. Access only what you need for your job.

## 6.2 Loyalty Program

**Location:** Admin Dashboard > Loyalty (sidebar)

The loyalty program rewards repeat customers with points that can be redeemed on future purchases.

**Tier System:**
| Tier | Requirements | Benefits |
|------|-------------|----------|
| **Bronze** | Default tier for all customers | Base point earning rate |
| **Silver** | Earn enough lifetime points | Increased earning rate |
| **Gold** | Higher lifetime points threshold | Higher earning rate, priority support |
| **Platinum** | Highest lifetime points threshold | Maximum earning rate, exclusive offers |

**Dashboard shows:**
- Total loyalty accounts
- Points outstanding (total redeemable points across all customers)
- Lifetime points issued
- Tier distribution chart (visual breakdown of how many customers are in each tier)
- Table of all loyalty accounts with customer ID, tier, current balance, lifetime points, and join date

**Points expiry:** Unused points expire automatically (handled by a daily background job). This prevents excessive liability.

## 6.3 Pincode Serviceability

**Location:** Admin Dashboard > Pincodes (sidebar)

This page manages which pincodes (postal codes) we can deliver to across India.

**Features:**
- View total records, delivery pincodes, unique pincodes, and states covered
- Search for specific pincodes
- Import pincodes via CSV file
- Export current pincode data
- Toggle serviceability for individual pincodes

When a customer enters their pincode during checkout, the system checks this database to confirm we can deliver there.

## 6.4 Notifications

The platform sends notifications to customers through multiple channels:

- **Email:** Transactional emails via Resend (from support@supracynpharma.com) -- order confirmation, shipping updates, prescription status, password reset
- **SMS:** OTP codes for authentication, order updates (via BulkSMSPlans.com)
- **Push Notifications:** Mobile app notifications via Firebase Cloud Messaging
- **In-app Messages:** Visible in the customer's account Messages section

## 6.5 Delivery Estimates

Delivery estimates are calculated based on the customer's pincode and are updated automatically by a background job. The system determines delivery days based on India Post Speed Post service levels to different zones.

---

# Part 7: Admin Dashboard - User Management & Security

## 7.1 Roles & Permissions

**Location:** Admin Dashboard > Roles (sidebar)

The Roles page has three tabs:

**Tab 1 -- Roles:**
Lists all 25 roles with their tier, whether they are clinical, whether MFA is required, description, number of active users, and the permissions assigned to each role.

**Tab 2 -- Users:**
Shows all users in the system with their assigned roles. You can:
- Search for users by email
- View which roles are assigned to each user
- Assign new roles to users
- Revoke roles from users

**Tab 3 -- Audit Log:**
A complete history of all role assignments and revocations, including who performed the action and when.

## 7.2 Adding New Staff

**To add a new staff member:**
1. A Super Admin or Platform Admin creates an invite via the admin dashboard
2. The invite is sent to the new staff member's email
3. The new staff member follows the link to create their account
4. A Super Admin assigns the appropriate role(s)

**Signup Requests:**
If someone registers through the admin registration page, their request appears as a signup request that must be approved by an admin before they gain access.

## 7.3 Audit Logs

The system maintains comprehensive audit logs:
- **Role audit log** (Roles page > Audit Log tab): Tracks all role assignments and revocations
- **PHI audit log** (Compliance page): Tracks all access to patient health information
- **Dispense decisions log** (Dispense page > Decisions Log tab): Tracks all pharmacist decisions

All audit logs include: who, what, when, and from where (IP address).

## 7.4 MFA (Multi-Factor Authentication)

MFA adds an extra layer of security beyond passwords. After entering your password, you must also provide a time-based code from your authenticator app.

**Roles that require MFA:**
- All Tier 2 clinical roles (Pharmacy Technician, Pharmacist, Pharmacist-in-Charge)
- Warehouse Manager
- B2B Admin
- Finance Admin
- Compliance Officer
- Platform Admin
- CDSCO Inspector

Staff with these roles cannot log in without MFA enabled.

---

# Part 8: Background Operations

These automated jobs run continuously in the background without any manual intervention. Understanding them helps you answer questions about system behavior.

## 8.1 FEFO Inventory Allocation

**What it does:** Automatically assigns the oldest-expiring stock (First Expiry, First Out) to pending orders.

**Why it matters:** Prevents medicines from expiring in the warehouse. Ensures customers receive medicine with the longest remaining shelf life available after fulfilling the FEFO requirement.

**Frequency:** Runs continuously (every few minutes).

## 8.2 COD Auto-Cancellation

**What it does:** Automatically cancels Cash on Delivery orders that remain unconfirmed after a set period.

**Why it matters:** Prevents stock from being held indefinitely for orders that may never be completed. Frees up allocated inventory for other customers.

**Frequency:** Runs hourly.

## 8.3 Low Stock Checks

**What it does:** Scans all product inventory levels and sends alerts when stock falls below minimum thresholds.

**Why it matters:** Ensures timely reordering so we do not run out of essential medicines.

**Frequency:** Runs daily.

## 8.4 Near-Expiry Flagging

**What it does:** Scans all active batches and flags those approaching their expiry date.

**Why it matters:** Enables proactive management of expiring stock -- either through FEFO prioritization, return to supplier, or controlled destruction.

**Frequency:** Runs daily.

## 8.5 Chronic Refill Reminders

**What it does:** Identifies patients on chronic medications (e.g., diabetes, hypertension) based on their ordering patterns and sends reminders when it is time to reorder.

**Why it matters:** Improves medication adherence for chronic patients. Drives repeat business.

**Frequency:** Runs daily.

## 8.6 AfterShip Sync

**What it does:** Checks all active shipments with AfterShip for tracking updates from carriers (primarily India Post) and updates order statuses accordingly.

**Why it matters:** Keeps customers informed about their delivery status in real time.

**Frequency:** Runs every 5 minutes.

## 8.7 Inventory Sync to Storefront

**What it does:** Pushes current warehouse stock levels to the storefront so customers see accurate availability.

**Why it matters:** Prevents customers from ordering out-of-stock items and ensures the storefront reflects real-time inventory.

**Frequency:** Runs every 15 minutes.

> **Note:** Because of the 15-minute sync interval, there can be a brief period where the storefront shows different stock than the warehouse. This is normal and expected.

## 8.8 Loyalty Points Expiry

**What it does:** Expires unused loyalty points that are past their validity period.

**Why it matters:** Manages financial liability from outstanding loyalty points and encourages customers to use their points.

**Frequency:** Runs daily.

## 8.9 Abandoned Cart Reminders

**What it does:** Sends reminder emails to customers who added items to their cart but did not complete checkout.

**Why it matters:** Recovers potentially lost revenue by nudging customers to complete their purchases.

**Frequency:** Runs every 2 hours.

## 8.10 H1 Report Generation

**What it does:** Compiles all Schedule H1 dispensing records into the regulatory H1 Register report.

**Why it matters:** Maintains regulatory compliance. The H1 Register must be available for inspection at all times.

**Frequency:** Runs daily.

## 8.11 Sales Tax Reports

**What it does:** Generates GST (Goods and Services Tax) reports for filed sales.

**Why it matters:** Required for GSTR-1 filing and financial compliance.

**Frequency:** Runs daily.

### Additional Background Jobs

| Job | What It Does | Frequency |
|-----|-------------|-----------|
| **Wishlist Price Alerts** | Notifies customers when wishlist items drop in price | Periodic |
| **PHI Audit Log Cleanup** | Cleans up old audit logs beyond retention period | Periodic |
| **Prescription Purge** | Removes expired/old prescription files for data hygiene | Periodic |
| **Guest Session Cleanup** | Releases expired guest shopping sessions | Periodic |
| **Delivery Days Update** | Recalculates delivery estimates based on pincode data | Periodic |
| **DLT Template Verification** | Verifies SMS DLT templates are active with TRAI | Periodic |
| **Chronic Reorder Identification** | Identifies repeat purchase patterns for refill reminders | Periodic |

---

# Part 9: Troubleshooting & FAQ

## 9.1 Customer Can't Complete Checkout

**Common reasons and what to check:**

1. **Cart contains Schedule X drug:** The system blocks checkout entirely. Tell the customer we cannot sell this medication.
2. **Cart contains Rx drug without prescription:** Customer must upload a prescription first. Guide them to the prescription upload step.
3. **Prescription not yet approved:** The pharmacist has not reviewed the prescription. Check the Rx Queue for status.
4. **Delivery pincode not serviceable:** The customer's address is in an area we do not deliver to. Check the Pincodes page.
5. **Payment method issue:** If Razorpay is down, suggest COD. If COD is not available for their area, they must use online payment.
6. **Item out of stock:** An item became out of stock after being added to cart. Ask customer to remove it and check for alternatives.

## 9.2 Payment Failed

**Razorpay issues:**
- "Payment failed" message: Ask customer to try again. Common causes: insufficient funds, bank OTP timeout, network issues.
- If Razorpay service is completely down, the system automatically offers COD as a fallback.

**COD issues:**
- COD is the default method and requires no external API call. If it is not showing, check if COD is disabled for the customer's pincode.

**General advice for customers:**
- Try a different payment method
- Try a different browser or clear browser cache
- Check with their bank if the payment was deducted (if so, it will be auto-refunded by the payment gateway)

## 9.3 Prescription Rejected

When a pharmacist rejects a prescription, the customer receives a notification explaining why.

**Common rejection reasons and what to tell the customer:**
- "Prescription expired" -- Ask customer to get a new prescription from their doctor
- "Doctor registration number missing" -- Ask customer to get the prescription reissued with the doctor's registration number
- "Prescription illegible" -- Ask customer to upload a clearer photo or scan
- "Medicine not listed on prescription" -- The customer is trying to order a medicine not written on their prescription
- "Invalid prescription" -- Prescription appears fraudulent or does not meet regulatory requirements

**Always be empathetic.** Explain that this is a legal requirement to protect their health and safety.

## 9.4 Product Shows Out of Stock but Warehouse Has Inventory

This is likely a sync delay. Inventory is pushed to the storefront every 15 minutes.

**What to do:**
1. Check warehouse inventory levels in Admin Dashboard > Warehouse > Inventory
2. If stock is available there, it will appear on the storefront within 15 minutes
3. If the customer is urgent, a support supervisor can manually check and inform them

## 9.5 Customer Can't Upload Prescription

**Common issues:**
- **File too large:** Maximum file size for uploads. Ask customer to compress the image or reduce camera resolution.
- **Wrong format:** Only JPG, PNG, and PDF are accepted. Ask customer to convert their file.
- **Network timeout:** Large files on slow connections may fail. Ask customer to try on WiFi or reduce image size.
- **Browser issue:** Ask customer to try a different browser (Chrome recommended).

## 9.6 Order Stuck in Processing

**Check these in order:**

1. **Prescription review:** If the order has Rx items, check the Rx Queue. Is the prescription still pending review?
2. **Inventory allocation:** Check if stock is available for all items. The FEFO job may not have allocated yet.
3. **Pharmacist sign-off:** For Rx orders, check if the pre-dispatch sign-off is complete.
4. **Warehouse tasks:** Check Warehouse > Tasks to see if pick/pack tasks are pending or stuck.
5. **System issue:** If everything looks normal but the order is still stuck, escalate to the development team.

## 9.7 Refund Not Processed

**Timeline:**
- Online payments (Razorpay): Refund typically processes within 5-7 business days
- COD refunds: After bank details are verified, refund processes within 7-10 business days

**What to check:**
1. Go to Admin Dashboard > Refunds and find the refund
2. Check the status -- is it pending approval, approved, or processed?
3. If pending, it needs approval from a Finance Admin or Support Supervisor
4. If approved but not processed, check if bank details are verified (for COD)
5. If processed, share the gateway refund ID with the customer for tracking with their bank

## 9.8 Delivery Estimate Seems Wrong

Delivery estimates are based on India Post Speed Post service levels to different zones. If an estimate seems incorrect:

1. Verify the customer's pincode is correct
2. Check the pincodes database for the delivery days configured for that area
3. Note that estimates do not account for weekends, public holidays, or India Post delays
4. If consistently wrong, report to the warehouse manager for delivery days recalibration

## 9.9 Customer Received Wrong Medicine

This is a serious incident. Handle with urgency.

1. **Ask the customer NOT to use the medicine**
2. Record full details: order number, what was ordered, what was received
3. Initiate a return immediately
4. Escalate to the Pharmacist-in-Charge for investigation
5. The pharmacist will review the dispensing records and pick list to identify where the error occurred
6. Ship the correct medicine on priority (or process a full refund if the customer prefers)
7. An internal investigation must be conducted and documented

> **Warning:** Dispensing the wrong medicine is a serious compliance issue. All incidents must be reported to the Pharmacist-in-Charge and Compliance Officer.

## 9.10 Who to Contact

| Issue | Contact |
|-------|---------|
| **Customer complaints (general)** | Support Supervisor |
| **Prescription review delays** | Pharmacist-in-Charge |
| **Wrong medicine dispensed** | Pharmacist-in-Charge + Compliance Officer |
| **Inventory/stock issues** | Warehouse Manager |
| **Payment/refund issues** | Finance Admin |
| **System errors/bugs** | Development Team (via internal ticket) |
| **Compliance/regulatory** | Compliance Officer |
| **Account access issues** | Platform Admin or Super Admin |
| **Urgent security incidents** | Super Admin (immediately) |

---

# Appendices

## Appendix A: Glossary of Terms

| Term | Full Form | Meaning |
|------|-----------|---------|
| **AOV** | Average Order Value | Total revenue divided by total orders |
| **B2B** | Business to Business | Sales to other businesses (not individual customers) |
| **CDSCO** | Central Drugs Standard Control Organisation | India's national regulatory body for drugs and cosmetics |
| **COD** | Cash on Delivery | Payment collected at time of delivery |
| **DLT** | Distributed Ledger Technology | TRAI registration system for SMS templates in India |
| **DPCO** | Drug Price Control Order | Government order that caps prices on essential medicines |
| **DPDP** | Digital Personal Data Protection (Act, 2023) | India's data privacy law |
| **FEFO** | First Expiry, First Out | Inventory allocation method that ships oldest-expiring stock first |
| **GRN** | Goods Receipt Note | Document created when goods are received from a supplier |
| **GST** | Goods and Services Tax | India's indirect tax on goods and services |
| **GSTR-1** | GST Return 1 | Monthly/quarterly return filing for outward supplies |
| **H1 Register** | Schedule H1 Register | Legal register recording all Schedule H1 drug dispensing |
| **IFSC** | Indian Financial System Code | Bank branch identifier code used for NEFT/RTGS transfers |
| **KYC** | Know Your Customer | Customer identity verification process |
| **MFA** | Multi-Factor Authentication | Security requiring two or more verification methods |
| **MRP** | Maximum Retail Price | The maximum price at which a product can be sold |
| **NDPS** | Narcotic Drugs and Psychotropic Substances (Act, 1985) | Law governing controlled substances |
| **OTC** | Over The Counter | Medicines that can be sold without prescription |
| **PHI** | Patient Health Information | Protected health-related personal data |
| **PIC** | Pharmacist-in-Charge | Senior pharmacist with override authority |
| **PO** | Purchase Order | Order placed with a supplier to buy goods |
| **QC** | Quality Control | Process of inspecting goods for quality standards |
| **RBAC** | Role-Based Access Control | System where permissions are assigned through roles |
| **Rx** | Prescription | A medicine that requires a doctor's prescription |
| **SKU** | Stock Keeping Unit | Unique identifier for each distinct product variant |
| **SSD** | Separation of Duties | Policy that prevents the same person from both requesting and approving an action |
| **UPI** | Unified Payments Interface | India's real-time payment system |

## Appendix B: Tips for the Admin Dashboard

**General Tips:**
- Use Chrome browser for the best experience
- The dashboard auto-refreshes some data, but click "Refresh" buttons for the latest information
- Use the sidebar navigation to move between sections
- Most tables are sortable -- click column headers to sort
- Use filters to narrow down large data sets before scrolling through results

**Keyboard Shortcuts:**
- Standard browser shortcuts work (Ctrl+F to find text on page, Ctrl+R to reload)
- Escape key closes open drawers and dialogs

**Best Practices:**
- Review the Rx Queue at least every 2 hours during business hours
- Check the analytics dashboard at the start of each workday
- Export H1 Register data weekly as a backup
- Review low stock alerts daily and create POs as needed
- Keep the Compliance dashboard open in a separate tab for quick access during audits

## Appendix C: Product Naming Convention

All product titles follow this standard format: **Brand Name Strength** in Title Case. The dosage form (Tablet, Capsule, Syrup, etc.) is NOT included in the title -- it is stored separately and shown as a badge.

**Rules:**
1. Use Title Case for brand names: ATORCYN becomes Atorcyn
2. Space between brand and strength (no hyphens before numbers): ATORCYN-10 becomes Atorcyn 10
3. Keep hyphens that are part of brand identity: -S, -T, -P, -D, -H, -AM, -AT, -CD, -MV, -DSR, -LSR, -F, -DP, -VG, -VGM, -TG
4. Remove redundant dosage form words: TAB, Tab, SYP, Tablet, Capsule, Syrup
5. Keep SR/MR/ER/CR/DR/OD designators as part of brand
6. Keep combo notation: 20/75, 10/12.5, 10/100/1000
7. FORTE is a brand modifier in Title Case: Glidax M 0.5 Forte

**Examples:**

| Raw Input | Correct Title |
|-----------|--------------|
| ATORCYN-10 | Atorcyn 10 |
| ATOSKY GOLD-10 | Atosky Gold 10 |
| ACEPRA-S | Acepra-S |
| ARICDOM-DSR | Aricdom-DSR |
| MAXFORMIN SR-500 | Maxformin SR 500 |
| ACEWOK-P SYP | Acewok-P |
| GLIDAX M 0.5 FORTE | Glidax M 0.5 Forte |
| DAPADAX-M 10/1000 | Dapadax-M 10/1000 |

**Composition format:** Salt compositions use parenthetical strengths.  
Example: Atorvastatin (10mg) + Aspirin (75mg)

**Our manufacturers:**
- **Supracyn Pharma** (via Betamax Remedies): GLIMCYN, ATORCYN, ROZUCYN, SUPAN, SUPRATEL, PARACYN, METCYN, AMICYN, and others
- **Daxia Healthcare**: DAXABAY, DAXAFLOW, DAXTOR, DAXIL, DAXYBILE, DAXYMER, DAPADAX, CILIDAX, SIGADAX, and others

---

*End of Suprameds Staff Operations Manual v1.0*

*For questions about this manual, contact the Platform Admin team. For system issues, contact the development team via internal ticket.*
