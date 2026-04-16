import type { ReactNode } from "react"

export interface BlogPost {
  slug: string
  title: string
  description: string
  date: string
  author: string
  readTime: string
  category: "guides" | "health" | "pharmacy" | "savings"
  tags: string[]
  content: () => ReactNode
}

export const blogPosts: BlogPost[] = [
  {
    slug: "what-are-generic-medicines",
    title: "What Are Generic Medicines? Are They Safe?",
    description:
      "Learn what generic medicines are, how they're approved by CDSCO, and why they cost 50-80% less than branded drugs while being equally safe and effective.",
    date: "2026-04-15",
    author: "Suprameds Pharmacy Team",
    readTime: "6 min read",
    category: "guides",
    tags: ["generic medicines", "CDSCO", "bioequivalence", "affordable healthcare"],
    content: () => (
      <>
        <p>
          Walk into any Indian pharmacy and you will notice two versions of the same medicine sitting
          on the shelf: a well-known branded version and a lesser-known generic one, often at a
          fraction of the price. The price gap can be staggering — sometimes 50 to 80 per cent — and
          that naturally raises a question: if the generic is so much cheaper, is it really as good?
        </p>
        <p>
          The short answer is <strong>yes</strong>. Generic medicines are required by law to be just
          as safe, effective, and high-quality as their branded counterparts. Let us explain why.
        </p>

        <h2>What exactly is a generic medicine?</h2>
        <p>
          A generic medicine contains the <strong>same active pharmaceutical ingredient (API)</strong>,
          in the same dosage form and strength, as the original branded product. The difference lies
          in the name, packaging, and price — not in the therapeutic effect.
        </p>
        <p>
          When a pharmaceutical company develops a new drug, it receives a patent that grants
          exclusive manufacturing rights for a fixed period, typically 20 years. During this time,
          the company recovers its research and development costs. Once the patent expires, other
          licensed manufacturers can produce the same molecule. These are generic medicines.
        </p>

        <h2>How are generics approved in India?</h2>
        <p>
          In India, the <strong>Central Drugs Standard Control Organisation (CDSCO)</strong>, headed
          by the Drugs Controller General of India (DCGI), regulates all pharmaceutical products.
          Before a generic medicine can be sold, the manufacturer must demonstrate:
        </p>
        <ul>
          <li>
            <strong>Bioequivalence</strong> — the generic must deliver the same amount of the active
            ingredient into the bloodstream, at the same rate, as the reference (branded) drug.
            Clinical bioequivalence studies are conducted on healthy human volunteers.
          </li>
          <li>
            <strong>Good Manufacturing Practice (GMP) compliance</strong> — the manufacturing
            facility must meet standards set by the Indian government, and in many cases,
            WHO-GMP certification.
          </li>
          <li>
            <strong>Stability data</strong> — the medicine must remain effective throughout its
            stated shelf life under defined storage conditions.
          </li>
        </ul>
        <p>
          These requirements ensure that a generic version performs identically to the branded product
          once it enters your body.
        </p>

        <h2>Why do generics cost so much less?</h2>
        <p>
          The price difference comes down to economics, not quality:
        </p>
        <ul>
          <li>
            <strong>No R&amp;D cost recovery</strong> — the original company spent years and
            sometimes billions of rupees on research, clinical trials, and regulatory approvals.
            Generic manufacturers skip this step because the molecule is already proven.
          </li>
          <li>
            <strong>No marketing spend</strong> — branded drugs carry heavy advertising, medical
            representative, and brand-building costs. Generics compete on price, not promotion.
          </li>
          <li>
            <strong>Market competition</strong> — once a patent expires, multiple manufacturers
            produce the same molecule, driving prices down through healthy competition.
          </li>
        </ul>
        <p>
          The Indian government further controls prices through the <strong>National Pharmaceutical
          Pricing Authority (NPPA)</strong>, which caps the maximum retail price of essential medicines
          under the Drug Price Control Order (DPCO).
        </p>

        <h2>Are there any differences at all?</h2>
        <p>
          Generic medicines may differ from branded versions in:
        </p>
        <ul>
          <li>Inactive ingredients (fillers, binders, colouring agents) — these do not affect how the drug works</li>
          <li>Packaging and branding</li>
          <li>Shape, size, or colour of the tablet</li>
        </ul>
        <p>
          These cosmetic differences have <strong>no impact on safety or efficacy</strong>. The active
          ingredient — the part that actually treats your condition — is identical.
        </p>

        <h2>How Suprameds sources generic medicines</h2>
        <p>
          At Suprameds, every medicine we dispense comes from <strong>CDSCO-licensed, WHO-GMP
          certified manufacturers</strong>. Our in-house brands — manufactured through Supracyn
          Pharma and Daxia Healthcare — are produced at inspected, compliant facilities.
        </p>
        <p>
          Every batch is tracked from manufacturer to your doorstep. Our licensed pharmacist reviews
          each order before dispatch, verifying the prescription, checking for drug interactions,
          and ensuring the correct batch with valid expiry dates is selected.
        </p>

        <h2>The bottom line</h2>
        <p>
          Generic medicines are not inferior copies. They are <strong>scientifically equivalent,
          government-regulated, and pharmacist-verified</strong> alternatives that make healthcare
          affordable for millions of Indians. When your doctor prescribes a molecule — say
          Atorvastatin 10mg — the branded version and the generic version will lower your cholesterol
          the same way. The only real difference is the price you pay.
        </p>
        <blockquote>
          "Generic medicines account for over 70% of prescriptions dispensed in India. They are
          the backbone of affordable healthcare."
          <br />— Indian Pharmaceutical Alliance
        </blockquote>
        <p>
          If you have questions about switching to generics, our pharmacist team is always available
          to help. Browse our catalogue to compare prices and see how much you can save.
        </p>
      </>
    ),
  },

  {
    slug: "how-to-read-prescription",
    title: "How to Read Your Doctor's Prescription",
    description:
      "Understand common prescription abbreviations like BD, TDS, OD, SOS, and HS. Learn what Schedule H and H1 mean and why pharmacist verification matters.",
    date: "2026-04-12",
    author: "Suprameds Pharmacy Team",
    readTime: "5 min read",
    category: "health",
    tags: ["prescription", "dosage", "Schedule H", "pharmacist"],
    content: () => (
      <>
        <p>
          You leave the doctor's clinic with a prescription in hand. The handwriting is barely
          legible, scattered with abbreviations like "1 tab BD x 5 days" or "SOS if pain." If
          this feels like a foreign language, you are not alone. Understanding your prescription
          is an important step in taking your medicines safely.
        </p>

        <h2>The Rx symbol</h2>
        <p>
          Every prescription begins with the symbol <strong>Rx</strong> (sometimes written as
          an ornate R with a line through its tail). It comes from the Latin word "recipe,"
          meaning "take." It is the doctor's instruction to the pharmacist to dispense the
          listed medicines.
        </p>

        <h2>Common dosage abbreviations</h2>
        <p>Doctors use standard Latin-derived abbreviations to describe how often a medicine should be taken:</p>
        <ul>
          <li><strong>OD</strong> (Omni Die) — Once daily</li>
          <li><strong>BD</strong> (Bis Die) — Twice daily</li>
          <li><strong>TDS</strong> (Ter Die Sumendum) — Three times daily</li>
          <li><strong>QID</strong> (Quater In Die) — Four times daily</li>
          <li><strong>HS</strong> (Hora Somni) — At bedtime</li>
          <li><strong>SOS</strong> (Si Opus Sit) — If needed / as required</li>
          <li><strong>AC</strong> (Ante Cibum) — Before food</li>
          <li><strong>PC</strong> (Post Cibum) — After food</li>
          <li><strong>STAT</strong> — Immediately, right now</li>
        </ul>
        <p>
          So when you see "Tab Metformin 500mg 1-0-1 PC," it means: take one 500mg Metformin
          tablet in the morning and one at night, after food. The middle zero means no afternoon dose.
        </p>

        <h2>What the numbers mean</h2>
        <p>
          Indian prescriptions commonly use a three-number format like <strong>1-0-1</strong> or
          <strong> 1-1-1</strong>. These represent morning, afternoon, and night doses respectively.
          A "0" means skip that time slot.
        </p>
        <ul>
          <li><strong>1-0-0</strong> — Morning only</li>
          <li><strong>0-0-1</strong> — Night only</li>
          <li><strong>1-1-1</strong> — Morning, afternoon, and night</li>
          <li><strong>1-0-1</strong> — Morning and night</li>
        </ul>

        <h2>Understanding drug schedules</h2>
        <p>
          In India, medicines are classified into schedules under the Drugs and Cosmetics Act, 1940.
          The two most commonly encountered schedules are:
        </p>
        <h3>Schedule H</h3>
        <p>
          Medicines that can only be sold against a valid prescription from a registered medical
          practitioner. Most antibiotics, antihypertensives, and antidiabetic drugs fall here.
          The packaging carries a red <strong>"Rx"</strong> symbol and the text: "Schedule H Drug —
          Warning: To be sold by retail on the prescription of a Registered Medical Practitioner only."
        </p>
        <h3>Schedule H1</h3>
        <p>
          A stricter subset introduced in 2013 for medicines with higher abuse potential or serious
          side effects. This includes certain antibiotics (like third-generation cephalosporins),
          anti-TB drugs, and habit-forming substances. Pharmacies are legally required to:
        </p>
        <ul>
          <li>Maintain an <strong>H1 register</strong> recording patient name, doctor name, drug name, and quantity</li>
          <li>Retain a copy of the prescription</li>
          <li>Report all H1 sales to the drug inspector</li>
        </ul>

        <h2>Why pharmacist verification matters</h2>
        <p>
          A prescription is not just a shopping list. A trained pharmacist checks for:
        </p>
        <ul>
          <li><strong>Drug interactions</strong> — will this medicine clash with something else you are taking?</li>
          <li><strong>Dosage appropriateness</strong> — is the prescribed dose within safe limits for your age and condition?</li>
          <li><strong>Prescription validity</strong> — is the prescription recent and issued by a registered practitioner?</li>
          <li><strong>Substitution legality</strong> — generic substitution is allowed in India, but the pharmacist must ensure bioequivalence</li>
        </ul>
        <p>
          At Suprameds, every order containing Schedule H or H1 medicines is reviewed by our
          licensed pharmacist before it is dispatched. We verify the prescription, check for
          interactions, and ensure you receive the right medicine in the right dose.
        </p>
        <blockquote>
          If you cannot read your prescription, do not guess. Ask your doctor or pharmacist
          to explain each medicine, its purpose, and its dosage before you leave.
        </blockquote>
      </>
    ),
  },

  {
    slug: "save-on-medicine-costs-india",
    title: "5 Ways to Save on Medicine Costs in India",
    description:
      "Practical tips to reduce your monthly medicine bill: generic substitution, government schemes like PMBJP Jan Aushadhi, price comparison, and more.",
    date: "2026-04-10",
    author: "Suprameds Pharmacy Team",
    readTime: "5 min read",
    category: "savings",
    tags: ["save money", "Jan Aushadhi", "generic medicines", "medicine costs"],
    content: () => (
      <>
        <p>
          For millions of Indian families, monthly medicine expenses are a significant financial
          burden. Chronic conditions like diabetes, hypertension, and thyroid disorders require
          lifelong medication, and the costs add up quickly. The good news is that there are
          practical, legal ways to reduce your medicine bill without compromising on quality.
        </p>

        <h2>1. Ask your doctor about generic alternatives</h2>
        <p>
          This is the single most effective way to save money. Generic medicines contain the same
          active ingredient as branded versions but cost 50 to 80 per cent less. Indian law allows
          doctors to prescribe generics, and the Medical Council of India has recommended that
          doctors write prescriptions using generic (salt) names.
        </p>
        <p>
          For example, if you are prescribed a branded Atorvastatin 10mg that costs Rs 180 for a
          strip of 10, the generic equivalent might cost Rs 35 to 50 for the same quantity
          and strength.
        </p>

        <h2>2. Use Pradhan Mantri Bhartiya Janaushadhi Pariyojana (PMBJP)</h2>
        <p>
          The Government of India runs the <strong>Jan Aushadhi scheme</strong> through the Bureau
          of Pharma PSUs (BPPI). Over 10,000 Jan Aushadhi Kendras across India sell quality generic
          medicines at prices 50 to 90 per cent lower than branded equivalents.
        </p>
        <p>
          These centres stock over 1,800 medicines and 300 surgical items. You can find your nearest
          Jan Aushadhi Kendra on the official BPPI website or the Janaushadhi Sugam mobile app.
        </p>
        <ul>
          <li>Medicines are WHO-GMP certified</li>
          <li>Quality tested by NABL-accredited laboratories</li>
          <li>Available for common chronic and acute conditions</li>
        </ul>

        <h2>3. Compare prices before buying</h2>
        <p>
          Medicine prices can vary significantly between pharmacies and between brands of the same
          molecule. The NPPA's <strong>Pharma Sahi Daam</strong> app lets you check the ceiling
          price of any medicine listed under DPCO. You can also compare prices across online
          pharmacies — the same Metformin 500mg might be listed at different prices depending
          on the brand.
        </p>
        <p>
          When comparing, always check the <strong>price per tablet</strong>, not just the strip
          price. A strip of 15 tablets at Rs 90 is cheaper per unit than a strip of 10 at Rs 70.
        </p>

        <h2>4. Buy in bulk for chronic medications</h2>
        <p>
          If you take a medicine every day for a long-term condition, buying a 3-month supply instead
          of monthly refills can save you money on shipping costs and sometimes qualify you for
          quantity discounts. At Suprameds, we offer savings on larger quantities for chronic
          medication orders.
        </p>
        <p>
          Always check the expiry date when buying in bulk. A good rule of thumb: the expiry date
          should be at least 6 months beyond your expected consumption period.
        </p>

        <h2>5. Shop from licensed online pharmacies</h2>
        <p>
          Licensed online pharmacies like Suprameds typically offer lower prices than brick-and-mortar
          retail pharmacies. The reasons are straightforward:
        </p>
        <ul>
          <li><strong>Lower overhead</strong> — no prime retail rent, fewer staff</li>
          <li><strong>Direct manufacturer sourcing</strong> — shorter supply chain means lower costs</li>
          <li><strong>Price transparency</strong> — you can see the MRP, discount, and final price clearly</li>
        </ul>
        <p>
          At Suprameds, we source directly from WHO-GMP certified manufacturers and pass the savings
          to you. Our prices are typically 50 to 80 per cent below MRP on branded equivalents.
        </p>

        <h2>A word of caution</h2>
        <p>
          While saving money is important, never compromise on safety:
        </p>
        <ul>
          <li>Always buy from a <strong>licensed pharmacy</strong> with a valid drug licence number</li>
          <li>Never buy prescription medicines without a valid prescription</li>
          <li>Check that the medicine has a <strong>batch number, manufacturing date, and expiry date</strong> printed on the packaging</li>
          <li>Avoid unregulated online sellers who do not verify prescriptions</li>
        </ul>
        <blockquote>
          Affordable does not mean unsafe. With the right approach, you can cut your medicine
          costs significantly while ensuring you receive genuine, quality-tested medicines.
        </blockquote>
      </>
    ),
  },

  {
    slug: "medicine-expiry-dates-guide",
    title: "Understanding Medicine Expiry Dates: What You Need to Know",
    description:
      "What medicine expiry dates really mean, how FEFO inventory management works, proper storage tips, and what to do with expired medicines.",
    date: "2026-04-08",
    author: "Suprameds Pharmacy Team",
    readTime: "4 min read",
    category: "health",
    tags: ["expiry dates", "FEFO", "medicine storage", "drug safety"],
    content: () => (
      <>
        <p>
          Every medicine you buy has an expiry date printed on its packaging. But what does that
          date actually mean? Can you take a medicine a day after it expires? What happens if you
          store medicines incorrectly? This guide answers the most common questions about medicine
          expiry dates.
        </p>

        <h2>What does the expiry date mean?</h2>
        <p>
          The expiry date is the last date on which the manufacturer guarantees the full potency
          and safety of the medicine, <strong>provided it has been stored under the conditions
          specified on the label</strong>. After this date, the chemical stability of the active
          ingredient may begin to degrade.
        </p>
        <p>
          In India, expiry dates are determined through <strong>stability testing</strong> as per
          ICH (International Council for Harmonisation) guidelines. Manufacturers subject medicine
          samples to accelerated and real-time storage conditions and test them at intervals to
          confirm they remain within specification.
        </p>

        <h2>Does a medicine become dangerous after expiry?</h2>
        <p>
          Most medicines do not suddenly become toxic on the expiry date. What typically happens is:
        </p>
        <ul>
          <li>The <strong>potency decreases</strong> — you may not receive the full therapeutic dose</li>
          <li>The <strong>chemical breakdown products</strong> may form, which in rare cases can be harmful</li>
          <li>The medicine may not <strong>dissolve or absorb properly</strong></li>
        </ul>
        <p>
          For critical medicines like insulin, nitroglycerin, anticoagulants, and epinephrine, using
          expired stock can be genuinely dangerous. For most common tablets, the risk is reduced
          efficacy rather than toxicity — but this is still a problem if you are managing a
          serious condition.
        </p>

        <h2>What is FEFO?</h2>
        <p>
          <strong>FEFO</strong> stands for <strong>First Expiry, First Out</strong>. It is an
          inventory management practice used by pharmacies and hospitals to ensure that medicines
          closest to their expiry date are dispensed first.
        </p>
        <p>
          At Suprameds, our warehouse follows strict FEFO protocols. When we receive new stock,
          it is placed behind existing stock of the same medicine. When your order is picked, the
          batch with the nearest (but still valid) expiry date is selected first. This minimises
          waste and ensures you always receive medicines well within their shelf life.
        </p>

        <h2>How to store medicines properly</h2>
        <p>
          Proper storage extends the effective life of your medicines up to the printed expiry date:
        </p>
        <ul>
          <li>
            <strong>Store at room temperature</strong> (below 30 degrees C) unless the label says
            otherwise. Indian summers can push indoor temperatures above this, so consider a cool,
            dry cupboard away from direct sunlight.
          </li>
          <li>
            <strong>Keep away from moisture</strong> — bathrooms are the worst place to store
            medicines despite being a common habit.
          </li>
          <li>
            <strong>Refrigerate only if required</strong> — some medicines (insulin, certain
            eye drops, some syrups) require 2 to 8 degrees C storage. Check the label.
          </li>
          <li>
            <strong>Keep in original packaging</strong> — blister packs protect tablets from moisture
            and light. Do not transfer tablets to unmarked containers.
          </li>
          <li>
            <strong>Keep out of reach of children</strong> — this is both a safety and a storage
            concern.
          </li>
        </ul>

        <h2>What to do with expired medicines</h2>
        <p>
          Do not flush medicines down the toilet or throw them in household waste. Improper disposal
          contaminates water supplies and harms the environment. Instead:
        </p>
        <ul>
          <li>Check if your local pharmacy has a <strong>medicine take-back programme</strong></li>
          <li>Some municipal waste collection systems accept pharmaceutical waste separately</li>
          <li>If no take-back option exists, mix the medicines with an undesirable substance
            (used tea leaves, dirt), seal in a container, and dispose with household waste</li>
        </ul>
        <blockquote>
          When in doubt about a medicine's condition — changed colour, unusual smell, crumbling
          tablets — do not take it, even if it has not expired. Consult your pharmacist.
        </blockquote>
      </>
    ),
  },
]

export const blogCategories = [
  { key: "all" as const, label: "All" },
  { key: "guides" as const, label: "Guides" },
  { key: "health" as const, label: "Health" },
  { key: "pharmacy" as const, label: "Pharmacy" },
  { key: "savings" as const, label: "Savings" },
]
