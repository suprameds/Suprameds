# Suprameds Layman Test Scenarios

**Date:** 2026-04-14
**Tester profile:** Non-tech family member (comfortable ordering online, not tech-savvy)
**Format:** Full test case — Precondition → Steps → Expected Result
**Scope:** Working features only, mix of happy paths + realistic error cases
**Device:** Mobile phone (primary), desktop browser (secondary)
**URL:** https://supracyn.in (production) or http://localhost:5173 (local dev)

---

## Category 1: First Visit & Browsing (Scenarios 1–15)

### 1. Open the website for the first time
- **Precondition:** Never visited before
- **Steps:** Open the URL in your phone browser
- **Expected:** Home page loads within 3 seconds. You see the Suprameds logo, a search bar at the top, featured products below, and a bottom navigation bar (Home, Store, Cart, Account)

### 2. Scroll through the home page
- **Precondition:** Home page is open
- **Steps:** Scroll down slowly through the entire home page
- **Expected:** You see featured/latest products with images, names, prices, and "Add to Cart" buttons. No broken images. No text cut off. Page scrolls smoothly

### 3. Tap on a product from the home page
- **Precondition:** Home page is open
- **Steps:** Tap on any product card
- **Expected:** Product detail page opens showing: product name, price (with MRP crossed out and discount %), an image, dosage form badge (e.g., "Tablet"), composition info, and an "Add to Cart" button

### 4. Navigate to the Store page
- **Precondition:** On any page
- **Steps:** Tap "Store" in the bottom navigation bar
- **Expected:** Store page opens showing a grid of all products. You can scroll through them. Each product shows name, price, and image

### 5. Browse products by category
- **Precondition:** On Store page
- **Steps:** Look for category filter chips (e.g., "Cardiac", "Diabetes", "Pain Relief"). Tap one
- **Expected:** Products filter to show only that category. The selected chip looks highlighted/active

### 6. Go back to Home from Store
- **Precondition:** On Store page
- **Steps:** Tap "Home" in bottom navigation
- **Expected:** Home page loads. Your previous scroll position on the store page is not remembered (fresh load)

### 7. Check the footer links
- **Precondition:** On any page
- **Steps:** Scroll to the very bottom of the page. Look for footer links
- **Expected:** You see links to Privacy Policy, Terms, Returns Policy, Prescription Policy, Pharmacy Licenses. All links are tappable

### 8. Open Privacy Policy page
- **Precondition:** Footer is visible
- **Steps:** Tap "Privacy Policy" link
- **Expected:** Privacy policy page opens with readable text. Mentions DPDP Act 2023. No blank page

### 9. Open Terms of Service page
- **Precondition:** Footer is visible
- **Steps:** Tap "Terms of Service" link
- **Expected:** Terms page opens with readable text about eligibility, prescription rules, pricing

### 10. Open Returns Policy page
- **Precondition:** Footer is visible
- **Steps:** Tap "Returns Policy" link
- **Expected:** Returns policy page loads with clear information about return conditions and process

### 11. Open Pharmacy Licenses page
- **Precondition:** Footer is visible
- **Steps:** Tap "Pharmacy Licenses" link
- **Expected:** Page shows Suprameds pharmacy license details (license number, validity, issuing authority)

### 12. Toggle dark mode
- **Precondition:** On any page
- **Steps:** Find the theme toggle (sun/moon icon, usually in navbar or settings). Tap it
- **Expected:** The entire app switches to dark mode (dark background, light text). Tap again to switch back to light mode. All text remains readable in both modes

### 13. Try the WhatsApp button
- **Precondition:** On any page (mobile)
- **Steps:** Look for a green WhatsApp floating button. Tap it
- **Expected:** WhatsApp opens (or prompts to open) with a pre-filled message to Suprameds support number

### 14. Pull to refresh on mobile
- **Precondition:** On home page (mobile)
- **Steps:** Pull down from the top of the page
- **Expected:** A refresh animation plays and the page reloads with fresh data

### 15. Check behavior with slow internet
- **Precondition:** Phone connected to slow network (or switch to 3G in settings)
- **Steps:** Open the home page
- **Expected:** A loading skeleton or spinner shows while products load. No blank white screen. Products eventually appear. If truly offline, an offline screen shows

---

## Category 2: Searching & Finding Medicines (Scenarios 16–25)

### 16. Search for a common medicine by name
- **Precondition:** On any page
- **Steps:** Tap the search bar. Type "Paracetamol". Wait 1-2 seconds
- **Expected:** Search suggestions/results appear showing products containing Paracetamol. Each result shows product name, price, and image

### 17. Search for a medicine by brand name
- **Precondition:** On any page
- **Steps:** Tap search bar. Type "Atorcyn"
- **Expected:** Shows Atorcyn products (Atorcyn 10, Atorcyn 20, etc.) with correct pricing

### 18. Search for a medicine by composition
- **Precondition:** On any page
- **Steps:** Type "Atorvastatin" in search
- **Expected:** Shows all products containing Atorvastatin (including Atorcyn, Rozucyn, etc.)

### 19. Search with a misspelling
- **Precondition:** On any page
- **Steps:** Type "Paracetmol" (missing 'a') in search
- **Expected:** Either shows results anyway (fuzzy match) OR shows "No results found" with a suggestion to check spelling. Should NOT crash or show an error

### 20. Search for something that doesn't exist
- **Precondition:** On any page
- **Steps:** Type "xyzabc123" in search
- **Expected:** Shows "No products found" or similar empty state message. No error. No blank screen

### 21. Clear the search and try again
- **Precondition:** Search results are showing
- **Steps:** Clear the search text (tap X or delete all text). Type a new medicine name
- **Expected:** Old results disappear. New results appear for the new search term

### 22. Tap a search result to view product
- **Precondition:** Search results showing
- **Steps:** Tap on any search result
- **Expected:** Product detail page opens for that product with full information

### 23. Search from the Store page
- **Precondition:** On Store page
- **Steps:** Use the search bar on the Store page (or look for a `?q=` URL parameter). Type a medicine name
- **Expected:** Store page filters to show matching products

### 24. Search for a category name
- **Precondition:** On any page
- **Steps:** Type "Diabetes" in search
- **Expected:** Shows diabetes-related products (Metcyn, Glimcyn, etc.) OR directs to the Diabetes category

### 25. Search with only 1-2 characters
- **Precondition:** On any page
- **Steps:** Type just "A" in the search bar
- **Expected:** Either waits for more characters before searching, or shows results starting with "A". Should not freeze or show an error

---

## Category 3: Product Details & Understanding (Scenarios 26–35)

### 26. View full product details
- **Precondition:** On any product detail page
- **Steps:** Read through the entire product page
- **Expected:** You see: product name, image, MRP (crossed out), selling price, discount %, dosage form badge (Tablet/Capsule/Syrup), pack size, composition with strengths, manufacturer name

### 27. Check product tabs (Details, Safety, FAQs)
- **Precondition:** On a product detail page
- **Steps:** Scroll down. Look for tab sections. Tap each tab
- **Expected:** Each tab shows relevant content. "Details" shows composition and usage. "Safety" shows precautions. "FAQs" shows common questions. No empty tabs

### 28. View product image gallery
- **Precondition:** On a product with multiple images
- **Steps:** Swipe left/right on the product image OR tap thumbnail images below
- **Expected:** Images change smoothly. Each image is clear and not blurry

### 29. Check related/substitute products
- **Precondition:** On a product detail page
- **Steps:** Scroll down to find "Related Products" or "Substitutes" section
- **Expected:** Shows other products with similar composition. Each substitute is tappable and leads to its own product page

### 30. Select a different variant (pack size or strength)
- **Precondition:** On a product with multiple variants (e.g., different strengths like 10mg, 20mg)
- **Steps:** Find the variant selector dropdown. Select a different option
- **Expected:** Price updates to match the selected variant. Add to Cart works for the selected variant

### 31. Check drug interaction warning
- **Precondition:** On a product that has interaction warnings
- **Steps:** Look for a "Drug Interactions" or warning section on the product page
- **Expected:** Shows relevant warnings about what not to take with this medicine (if applicable). Text is readable and clear

### 32. Verify MRP and discount display
- **Precondition:** On any product detail page
- **Steps:** Check the price section
- **Expected:** MRP is shown with a strikethrough. Selling price is shown prominently. Discount percentage is displayed (e.g., "60% off"). Selling price is ALWAYS less than or equal to MRP

### 33. Check prescription requirement indicator
- **Precondition:** On a Schedule H/H1 product page
- **Steps:** Look for a prescription badge or indicator
- **Expected:** There should be a visible "Rx Required" or "Prescription Needed" badge. The product can be added to cart but checkout will require prescription upload

### 34. View product on desktop browser
- **Precondition:** Open any product page on a laptop/desktop
- **Steps:** View the product detail page
- **Expected:** Layout adjusts for larger screen — image on left, details on right. Text is not too small or too large. Everything is readable

### 35. Share a product link
- **Precondition:** On any product page
- **Steps:** Copy the URL from the browser address bar. Send it to someone else. Have them open it
- **Expected:** The link opens directly to that product page. Same product shows with correct details

---

## Category 4: Cart Management (Scenarios 36–47)

### 36. Add a product to cart
- **Precondition:** On any product detail page
- **Steps:** Tap "Add to Cart" button
- **Expected:** Button changes (shows quantity selector or "Added"). Cart icon in the navbar shows a badge with count "1"

### 37. Add a product to cart from product card
- **Precondition:** On Store page or Home page
- **Steps:** Tap the "Add to Cart" button directly on a product card (without opening the product page)
- **Expected:** Product is added to cart. Cart badge updates. A toast/notification confirms "Added to cart"

### 38. Open the cart page
- **Precondition:** Cart has at least 1 item
- **Steps:** Tap the Cart icon in the navbar or bottom tab
- **Expected:** Cart page shows all added items with: product name, image, price, quantity, and total. Shows subtotal at the bottom

### 39. Increase quantity of a cart item
- **Precondition:** Cart page with an item showing quantity 1
- **Steps:** Tap the "+" button next to the item
- **Expected:** Quantity increases to 2. Line total updates (price × 2). Cart subtotal updates

### 40. Decrease quantity of a cart item
- **Precondition:** Cart item with quantity 2 or more
- **Steps:** Tap the "−" button
- **Expected:** Quantity decreases by 1. Totals update accordingly

### 41. Remove an item from cart
- **Precondition:** Cart has at least 1 item
- **Steps:** Tap the "−" button when quantity is 1, OR tap a "Remove" / trash icon
- **Expected:** Item is removed from cart. If cart is now empty, shows "Your cart is empty" message with a link to continue shopping

### 42. Add multiple different products to cart
- **Precondition:** Cart is empty
- **Steps:** Go to Store. Add 3 different products to cart one by one
- **Expected:** Cart badge shows "3". Cart page lists all 3 items. Subtotal equals sum of all items

### 43. View cart with empty state
- **Precondition:** Cart is empty (no items)
- **Steps:** Tap on Cart
- **Expected:** Shows "Your cart is empty" or similar message. Shows a button to browse products / continue shopping

### 44. Cart persists after closing browser
- **Precondition:** Cart has items
- **Steps:** Close the browser completely. Reopen and go to the website
- **Expected:** Cart still has the same items you added earlier (cart persists via local storage or server)

### 45. Add same product twice
- **Precondition:** Product A is already in cart with quantity 1
- **Steps:** Go to Product A's page again. Tap "Add to Cart"
- **Expected:** Quantity increases to 2 (not a duplicate entry). Cart still shows one line for Product A

### 46. Check free delivery threshold
- **Precondition:** Cart has items below the free delivery threshold
- **Steps:** Look for a "Free delivery" badge or message on the cart page
- **Expected:** Shows how much more you need to add for free delivery (e.g., "Add ₹200 more for free delivery") OR shows "Free Delivery" if threshold is met

### 47. Proceed to checkout from cart
- **Precondition:** Cart has at least 1 item
- **Steps:** Tap "Proceed to Checkout" or "Checkout" button on cart page
- **Expected:** Takes you to the checkout flow (address step). If not logged in, prompts you to log in first

---

## Category 5: Account & Login (Scenarios 48–58)

### 48. Open the login page
- **Precondition:** Not logged in
- **Steps:** Tap "Account" in bottom nav or navbar profile icon
- **Expected:** Login page shows with options: Phone OTP, Email OTP, or Email/Password

### 49. Login with phone OTP
- **Precondition:** On login page
- **Steps:** Enter your phone number (10 digits). Tap "Send OTP". Enter the 6-digit OTP received via SMS. Tap "Verify"
- **Expected:** OTP arrives within 30 seconds. After verification, you're logged in and redirected to your account page. Your name shows in the navbar

### 50. Login with email OTP
- **Precondition:** On login page
- **Steps:** Switch to Email OTP tab. Enter your email. Tap "Send OTP". Check email inbox for OTP. Enter it
- **Expected:** OTP email arrives. After verification, you're logged in

### 51. Login with wrong OTP
- **Precondition:** OTP has been sent
- **Steps:** Enter "000000" as OTP. Tap Verify
- **Expected:** Shows error "Invalid OTP" or "Incorrect code". Allows you to retry. Does NOT lock you out immediately

### 52. Register a new account via OTP
- **Precondition:** Not registered before
- **Steps:** Enter a phone number that's not registered. Tap Send OTP. Verify OTP
- **Expected:** New account is created automatically. You're logged in. May ask you to enter your name

### 53. Login with email and password
- **Precondition:** Have an account with password set
- **Steps:** Switch to Email/Password tab. Enter email and password. Tap Login
- **Expected:** Logged in successfully. Redirected to account page

### 54. Login with wrong password
- **Precondition:** On email/password login
- **Steps:** Enter correct email but wrong password. Tap Login
- **Expected:** Shows "Invalid credentials" or similar error. Allows retry. Shows "Forgot Password?" link

### 55. Forgot password flow
- **Precondition:** On login page
- **Steps:** Tap "Forgot Password?". Enter your email. Tap Submit
- **Expected:** Shows "Password reset link sent to your email". You receive an email with a reset link

### 56. Logout
- **Precondition:** Logged in
- **Steps:** Go to Account page. Find and tap "Logout" or "Sign Out"
- **Expected:** Logged out. Redirected to home or login page. Account icon no longer shows your name

### 57. Login required for checkout
- **Precondition:** Not logged in, cart has items
- **Steps:** Tap "Proceed to Checkout" on cart page
- **Expected:** Redirected to login page. After logging in, taken back to checkout (not home page)

### 58. Session persistence after app restart
- **Precondition:** Logged in
- **Steps:** Close the browser. Reopen and go to the website
- **Expected:** Still logged in (session persists). Your name shows in the navbar

---

## Category 6: Checkout Flow (Scenarios 59–75)

### 59. Start checkout — address step
- **Precondition:** Logged in, cart has items
- **Steps:** From cart, tap "Proceed to Checkout"
- **Expected:** Checkout page opens at the Address step. Shows a form for shipping address (name, phone, address line 1, address line 2, city, state, pincode)

### 60. Fill in a new shipping address
- **Precondition:** On address step
- **Steps:** Fill in all fields: name, phone (10 digits), address, city, state, pincode (6 digits). Tap "Continue" or "Next"
- **Expected:** Address is saved. Moves to the next step (prescription or delivery)

### 61. Enter invalid pincode
- **Precondition:** On address step
- **Steps:** Enter pincode "000000" or "12345" (5 digits)
- **Expected:** Shows error "Invalid pincode" or "We don't deliver to this area". Does NOT proceed to next step

### 62. Enter valid pincode outside service area
- **Precondition:** On address step
- **Steps:** Enter a valid pincode from a remote area that Suprameds doesn't serve
- **Expected:** Shows "We don't deliver to this pincode yet" or similar message. Suggests checking another address

### 63. Use a saved address
- **Precondition:** Have a previously saved address
- **Steps:** On address step, select from your saved addresses
- **Expected:** Address fields auto-fill. You can proceed without retyping everything

### 64. Enter Indian phone number with country code
- **Precondition:** On address step
- **Steps:** Enter phone as "+919876543210" or "09876543210" (with prefix)
- **Expected:** System normalizes the number to 10-digit format. No error about phone format

### 65. Checkout with prescription-required product
- **Precondition:** Cart contains a Schedule H/H1 drug
- **Steps:** Proceed through address step. Reach the prescription step
- **Expected:** Prescription step appears asking you to upload a prescription. Cannot skip this step. Shows which items require Rx

### 66. Upload a prescription during checkout
- **Precondition:** On prescription step
- **Steps:** Tap "Upload Prescription". Select a photo of a prescription from your phone gallery. Wait for upload
- **Expected:** Prescription image uploads successfully. Shows a preview/thumbnail. Status shows "Pending Review"

### 67. Upload an invalid file as prescription
- **Precondition:** On prescription step
- **Steps:** Try uploading a random text file or very small image
- **Expected:** Shows error or warning about invalid file. Accepts only image (JPG, PNG) and PDF formats

### 68. Checkout with OTC (non-prescription) products only
- **Precondition:** Cart has only OTC products (no Schedule H/H1)
- **Steps:** Proceed through checkout
- **Expected:** Prescription step is skipped entirely. Goes directly from address to delivery/payment

### 69. Select delivery/shipping method
- **Precondition:** On delivery step
- **Steps:** View available shipping options. Select one
- **Expected:** Shows shipping method name, estimated delivery date (e.g., "3-5 business days"), and cost (or "Free"). Selection is highlighted

### 70. View delivery estimate
- **Precondition:** On delivery step with address filled
- **Steps:** Check the estimated delivery date
- **Expected:** Shows a date range based on your pincode (metro areas = faster, rural = slower). Date looks realistic (not "0 days" or "100 days")

### 71. Select COD (Cash on Delivery) payment
- **Precondition:** On payment step
- **Steps:** Select "Cash on Delivery" option
- **Expected:** COD is selected. No additional forms to fill. Can proceed to review step

### 72. Select Razorpay (online payment)
- **Precondition:** On payment step
- **Steps:** Select "Pay Online" or "Razorpay" option. Complete the Razorpay popup (enter test card/UPI)
- **Expected:** Razorpay payment modal opens. After successful payment, returns to Suprameds with "Payment Successful" confirmation

### 73. Cancel Razorpay payment midway
- **Precondition:** Razorpay payment modal is open
- **Steps:** Close the Razorpay popup without completing payment
- **Expected:** Returns to checkout payment step. Cart is intact. Can retry payment or switch to COD. Shows "Payment was not completed" message

### 74. Review order before placing
- **Precondition:** On review step (all previous steps completed)
- **Steps:** Review all details: items, quantities, prices, address, payment method, delivery method
- **Expected:** All information is correct and matches what you entered. Shows order total (subtotal + shipping − discounts). "Place Order" button is visible

### 75. Place the order
- **Precondition:** On review step, everything filled
- **Steps:** Tap "Place Order"
- **Expected:** Order is placed. Redirected to order confirmation page showing: order number, items, total, estimated delivery, and a "Thank you" message. You receive an email/SMS confirmation

---

## Category 7: Prescriptions (Scenarios 76–83)

### 76. Upload prescription from dedicated page
- **Precondition:** Logged in
- **Steps:** Navigate to "Upload Prescription" page (from navbar or account menu). Upload a prescription photo
- **Expected:** Prescription uploads successfully. Shows in your prescriptions list with "Pending Review" status

### 77. View prescription history
- **Precondition:** Logged in, have uploaded prescriptions before
- **Steps:** Go to Account → Prescriptions
- **Expected:** List of all your prescriptions with: upload date, status (Pending/Approved/Rejected/Expired), and thumbnail

### 78. View a single prescription detail
- **Precondition:** On prescriptions list
- **Steps:** Tap on a prescription
- **Expected:** Shows prescription image/PDF, upload date, status, and which orders used it (if approved)

### 79. Check prescription status (approved)
- **Precondition:** Prescription was reviewed by pharmacist
- **Steps:** Go to Account → Prescriptions
- **Expected:** Status shows "Approved" in green. Can be used for checkout with Rx products

### 80. Check prescription status (rejected)
- **Precondition:** Prescription was rejected
- **Steps:** Go to Account → Prescriptions
- **Expected:** Status shows "Rejected" in red. May show a reason (e.g., "Expired prescription", "Not readable")

### 81. Use an approved prescription at checkout
- **Precondition:** Have an approved prescription, cart has Rx items
- **Steps:** At prescription step in checkout, select the approved prescription instead of uploading a new one
- **Expected:** Previously approved prescription is linked to the cart. Can proceed to next checkout step

### 82. Upload multiple prescriptions
- **Precondition:** Logged in
- **Steps:** Upload one prescription. Then upload another one
- **Expected:** Both prescriptions appear in your list separately. Each has its own status

### 83. Try to checkout Rx product without prescription
- **Precondition:** Cart has Schedule H drug, no prescription uploaded or approved
- **Steps:** Try to proceed past the prescription step without uploading
- **Expected:** Cannot proceed. Shows a clear message "Prescription required for [product name]". Must upload before continuing

---

## Category 8: Post-Order Experience (Scenarios 84–91)

### 84. View order history
- **Precondition:** Logged in, have placed orders
- **Steps:** Go to Account → Orders
- **Expected:** List of all your orders with: order number, date, total amount, status (Processing/Shipped/Delivered). Most recent first

### 85. View single order details
- **Precondition:** On orders list
- **Steps:** Tap on an order
- **Expected:** Shows: order number, items with quantities and prices, shipping address, payment method, status, tracking info (if shipped)

### 86. Track a shipped order
- **Precondition:** An order with "Shipped" status
- **Steps:** Open order details. Look for tracking link/information
- **Expected:** Shows carrier name, tracking number/AWB, and current status (in transit, out for delivery, etc.). May have a "Track" button that opens carrier's tracking page

### 87. View order confirmation page
- **Precondition:** Just placed an order
- **Steps:** Stay on the confirmation page after placing order
- **Expected:** Shows order number, items, total, estimated delivery date, and "Thank you" message. Option to continue shopping

### 88. Download invoice
- **Precondition:** Have a completed order
- **Steps:** Open order details. Look for "Download Invoice" or "Invoice PDF" button. Tap it
- **Expected:** PDF invoice downloads or opens. Shows: order details, GST breakdown, Suprameds pharmacy details, items with prices

### 89. Request a return
- **Precondition:** Have a delivered order
- **Steps:** Open order details. Tap "Return" or "Request Return". Select reason. Submit
- **Expected:** Return request is submitted. Shows "Return Requested" status. May show instructions for return pickup

### 90. Check COD order confirmation
- **Precondition:** Placed a COD order
- **Steps:** Check for SMS/email confirmation
- **Expected:** Receive a confirmation asking you to confirm the COD order (to prevent fraudulent orders). Order shows "Pending Confirmation" until confirmed

### 91. Revisit the order confirmation page later
- **Precondition:** Placed an order earlier
- **Steps:** Try to access the order confirmation URL again (bookmark or history)
- **Expected:** Either shows the confirmation page OR redirects to the order detail page in your account. Should NOT show an error

---

## Category 9: Account Management (Scenarios 92–100)

### 92. View profile page
- **Precondition:** Logged in
- **Steps:** Go to Account → Profile
- **Expected:** Shows your name, email, phone number, and any other saved info

### 93. Edit profile name
- **Precondition:** On profile page
- **Steps:** Change your name. Tap Save
- **Expected:** Name updates. Shows success message. New name appears in navbar/profile

### 94. Add a new saved address
- **Precondition:** Account → Addresses
- **Steps:** Tap "Add New Address". Fill in full address details. Save
- **Expected:** New address appears in your saved addresses list. Can be selected during checkout

### 95. Edit a saved address
- **Precondition:** Have a saved address
- **Steps:** Tap "Edit" on an existing address. Change the city. Save
- **Expected:** Address updates with the new city. Old city is no longer shown

### 96. Delete a saved address
- **Precondition:** Have at least 2 saved addresses
- **Steps:** Tap "Delete" or trash icon on an address. Confirm deletion
- **Expected:** Address is removed from the list. Cannot be selected in checkout anymore

### 97. Change password
- **Precondition:** Logged in with email/password account
- **Steps:** Go to Account → Change Password. Enter current password, new password, confirm new password. Save
- **Expected:** Password is changed. Can log out and log back in with new password

### 98. Enter wrong current password when changing
- **Precondition:** On change password page
- **Steps:** Enter wrong current password. Enter a new password. Tap Save
- **Expected:** Shows error "Current password is incorrect". Password is NOT changed

### 99. View account page on desktop
- **Precondition:** Logged in on desktop browser
- **Steps:** Navigate to Account
- **Expected:** Account page shows with sidebar navigation (Profile, Orders, Addresses, Prescriptions, etc.) and main content area. Not squished or overlapping

### 100. Rapid navigation between account sections
- **Precondition:** Logged in
- **Steps:** Quickly tap between Orders → Prescriptions → Addresses → Profile in succession
- **Expected:** Each section loads correctly without errors. No flickering, no stale data from previous section showing

---

## Quick Reference: Scenario Distribution

| Category | Scenarios | Count | Happy:Error Ratio |
|---|---|---|---|
| First Visit & Browsing | 1–15 | 15 | 13:2 |
| Searching & Finding | 16–25 | 10 | 7:3 |
| Product Details | 26–35 | 10 | 10:0 |
| Cart Management | 36–47 | 12 | 10:2 |
| Account & Login | 48–58 | 11 | 7:4 |
| Checkout Flow | 59–75 | 17 | 13:4 |
| Prescriptions | 76–83 | 8 | 6:2 |
| Post-Order | 84–91 | 8 | 7:1 |
| Account Management | 92–100 | 9 | 7:2 |
| **Total** | | **100** | **~80:20** |

## Test Environment Notes

- **Production:** https://supracyn.in
- **Test payments:** Use Razorpay test mode cards (4111 1111 1111 1111, expiry: any future date, CVV: any 3 digits)
- **Test OTP:** In development, OTP is logged to console. In production, real SMS is sent
- **Prescription uploads:** Use any clear photo of a doctor's prescription for testing
- **COD orders:** Will trigger real confirmation SMS — use test phone numbers
