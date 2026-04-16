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

export const batch4: BlogPost[] = [
  {
    slug: "annual-health-checkups-india-tests-costs",
    title: "Annual Health Checkups in India: What Tests and What They Cost",
    description: "A practical guide to essential annual health tests in India, what each test checks, and how much you should expect to pay.",
    date: "2026-04-05",
    author: "Suprameds Editorial",
    readTime: "6 min read",
    category: "health",
    tags: ["health checkup", "preventive care", "blood tests", "India"],
    content: () => (
      <div>
        <p>Preventive healthcare is one of the best investments you can make, yet most Indians skip routine checkups until symptoms appear. Annual health screenings can detect silent conditions like hypertension, diabetes, and thyroid disorders before they cause serious harm.</p>

        <h2>Why Annual Checkups Matter</h2>
        <p>India carries a disproportionately high burden of non-communicable diseases. An estimated 77 million Indians have type 2 diabetes, and millions more are undiagnosed. Early detection through simple blood tests can prevent complications that cost lakhs to treat.</p>

        <h2>Essential Tests for Adults Under 40</h2>
        <ul>
          <li><strong>Complete Blood Count (CBC)</strong> - Detects anaemia, infections, and clotting disorders. Cost: Rs 200-400.</li>
          <li><strong>Fasting Blood Glucose</strong> - Screens for diabetes and pre-diabetes. Cost: Rs 80-150.</li>
          <li><strong>Lipid Profile</strong> - Measures cholesterol (LDL, HDL, triglycerides). Cost: Rs 300-600.</li>
          <li><strong>Thyroid Stimulating Hormone (TSH)</strong> - Detects hypothyroidism and hyperthyroidism. Cost: Rs 300-500.</li>
          <li><strong>Urine Routine</strong> - Checks kidney function and urinary tract health. Cost: Rs 80-150.</li>
        </ul>

        <h2>Additional Tests for Adults Over 40</h2>
        <ul>
          <li><strong>HbA1c</strong> - Three-month average blood sugar; more accurate than single fasting glucose. Cost: Rs 350-600.</li>
          <li><strong>Kidney Function Test (KFT)</strong> - Creatinine, urea, and uric acid levels. Cost: Rs 400-700.</li>
          <li><strong>Liver Function Test (LFT)</strong> - Important if you take regular medicines or drink alcohol. Cost: Rs 400-700.</li>
          <li><strong>ECG</strong> - Baseline heart rhythm check. Cost: Rs 150-300.</li>
          <li><strong>Vitamin D and B12</strong> - Both are commonly deficient in Indians. Cost: Rs 600-1,200 together.</li>
        </ul>

        <h2>Gender-Specific Screenings</h2>
        <p>Women over 40 should add a mammogram (Rs 800-1,500) and Pap smear (Rs 400-800) to their annual checklist. Men over 50 should discuss PSA testing for prostate health with their doctor.</p>

        <h2>How to Save on Health Tests</h2>
        <p>Many diagnostic chains in India such as Dr. Lal PathLabs, Metropolis, and Thyrocare offer bundled full-body checkup packages for Rs 1,500-3,000 that include 30-50 tests. These packages are significantly cheaper than ordering tests individually.</p>

        <p>Suprameds stocks the medicines commonly prescribed after health checkup findings, including thyroid medications, diabetes drugs, and cholesterol-lowering statins at 50-80% off MRP. Order your prescription medicines at <strong>store.supracynpharma.com</strong> after your next checkup.</p>
      </div>
    ),
  },
  {
    slug: "10-most-common-preventable-diseases-india",
    title: "The 10 Most Common Preventable Diseases in India",
    description: "India's top preventable health burdens and simple steps every family can take to reduce risk.",
    date: "2026-04-06",
    author: "Suprameds Editorial",
    readTime: "7 min read",
    category: "health",
    tags: ["preventive health", "India diseases", "public health", "lifestyle"],
    content: () => (
      <div>
        <p>India faces a dual burden of infectious diseases and a rapidly growing wave of lifestyle-related non-communicable diseases. The good news is that the majority of the most common diseases in India are preventable with basic awareness and lifestyle changes.</p>

        <h2>1. Type 2 Diabetes</h2>
        <p>India has over 77 million diabetics. Excessive refined carbohydrate intake, physical inactivity, and obesity are the primary drivers. Prevention: reduce sugar consumption, walk 30 minutes daily, maintain a healthy weight.</p>

        <h2>2. Hypertension (High Blood Pressure)</h2>
        <p>Over 200 million Indians have hypertension, yet half are undiagnosed. High salt intake and stress are key contributors. Prevention: limit salt to under 5g daily, exercise regularly, manage stress.</p>

        <h2>3. Tuberculosis (TB)</h2>
        <p>India accounts for about 26% of global TB cases. While infectious, TB risk is greatly reduced by adequate nutrition, BCG vaccination, and avoiding overcrowded living conditions.</p>

        <h2>4. Cardiovascular Disease</h2>
        <p>Heart disease is the leading cause of death in India. Prevention: control cholesterol, blood pressure, and blood sugar; quit smoking; eat less saturated fat.</p>

        <h2>5. Dengue and Malaria</h2>
        <p>Both are preventable by eliminating stagnant water around homes, using mosquito nets, and wearing protective clothing during peak mosquito activity hours.</p>

        <h2>6. Chronic Obstructive Pulmonary Disease (COPD)</h2>
        <p>Linked to smoking and indoor air pollution from biomass fuel. Prevention: quit smoking; use cleaner cooking fuel alternatives.</p>

        <h2>7. Iron-Deficiency Anaemia</h2>
        <p>Affects over 50% of women and children in India. Prevention: eat iron-rich foods (lentils, spinach, jaggery), cook in iron vessels, take supplements if prescribed.</p>

        <h2>8. Typhoid and Hepatitis A</h2>
        <p>Both are waterborne and entirely preventable through safe drinking water, proper food hygiene, and vaccination.</p>

        <h2>9. Obesity</h2>
        <p>Now affecting over 40 million Indians. Obesity is the upstream cause of diabetes, hypertension, and joint disease. Prevention begins with reducing ultra-processed food intake.</p>

        <h2>10. Vitamin D Deficiency</h2>
        <p>Despite abundant sunshine, over 70% of Indians are vitamin D deficient due to indoor lifestyles, dark skin tone, and covered clothing. Supplementation is often needed.</p>

        <p>Many of these conditions require long-term medicines once diagnosed. Suprameds carries the full range of India's most-prescribed chronic disease medicines at 50-80% off MRP. Visit <strong>store.supracynpharma.com</strong> to check availability.</p>
      </div>
    ),
  },
  {
    slug: "home-medicine-kit-emergencies-india",
    title: "How to Build a Home Medicine Kit for Emergencies",
    description: "A practical checklist of medicines and supplies every Indian household should keep at home for common emergencies.",
    date: "2026-04-06",
    author: "Suprameds Editorial",
    readTime: "5 min read",
    category: "health",
    tags: ["first aid", "home medicine kit", "emergency", "OTC medicines"],
    content: () => (
      <div>
        <p>A well-stocked home medicine kit can mean the difference between a minor inconvenience and a crisis. Whether you live in a city or a rural area, keeping essential medicines and first-aid supplies at home is basic preparedness every family needs.</p>

        <h2>Essential OTC Medicines</h2>
        <ul>
          <li><strong>Paracetamol 500mg tablets</strong> - For fever and mild pain. Safe for adults and children (with weight-based dosing for children).</li>
          <li><strong>ORS (Oral Rehydration Salts)</strong> - Critical for diarrhoea and dehydration. Keep at least 10 sachets.</li>
          <li><strong>Antacid tablets or syrup</strong> - For acidity, heartburn, and gastric discomfort.</li>
          <li><strong>Antihistamine (Cetirizine or Chlorpheniramine)</strong> - For allergic reactions, rashes, and insect bites.</li>
          <li><strong>Cough syrup (non-drowsy)</strong> - For dry or productive cough in adults.</li>
          <li><strong>Zinc and Vitamin C supplements</strong> - Helpful during illness to support immune function.</li>
        </ul>

        <h2>First-Aid Supplies</h2>
        <ul>
          <li><strong>Adhesive bandages (band-aids)</strong> in multiple sizes</li>
          <li><strong>Sterile gauze pads and medical tape</strong></li>
          <li><strong>Povidone-iodine (Betadine) solution</strong> for wound cleaning</li>
          <li><strong>Digital thermometer</strong> - Ear or forehead type for ease of use</li>
          <li><strong>BP monitor</strong> if anyone at home has hypertension</li>
          <li><strong>Scissors and tweezers</strong></li>
          <li><strong>Disposable gloves</strong></li>
        </ul>

        <h2>For Households With Children</h2>
        <ul>
          <li>Paediatric paracetamol drops or syrup (age-appropriate dosing)</li>
          <li>Electral or Pedialyte sachets</li>
          <li>Nasal saline drops for congestion</li>
          <li>Calamine lotion for rashes</li>
        </ul>

        <h2>For Households With Elderly Members</h2>
        <p>Keep a 7-day buffer of all chronic medications. Never let stocks fall to zero. Keep a written list of all medicines with dosages in the kit in case of hospital emergency.</p>

        <h2>Storage Rules</h2>
        <p>Store medicines in a cool, dry place away from direct sunlight and humidity. Do not keep medicines in the bathroom. Check expiry dates every six months and replace expired items promptly.</p>

        <p>Suprameds makes it easy to stock your home medicine kit without overpaying. All listed OTC medicines are available at 50-80% off MRP at <strong>store.supracynpharma.com</strong> with fast delivery across India.</p>
      </div>
    ),
  },
  {
    slug: "when-to-use-antibiotics-when-not-to",
    title: "When to Use Antibiotics and When Not To",
    description: "Clear guidance on which infections need antibiotics and which do not, helping Indians use these medicines correctly.",
    date: "2026-04-07",
    author: "Suprameds Editorial",
    readTime: "5 min read",
    category: "health",
    tags: ["antibiotics", "infections", "responsible use", "bacteria vs virus"],
    content: () => (
      <div>
        <p>Antibiotics are among the most important medicines ever developed. But in India, they are also among the most misused. Understanding when antibiotics are needed and when they are not is essential for both your health and for protecting public health.</p>

        <h2>What Antibiotics Actually Do</h2>
        <p>Antibiotics kill or inhibit the growth of bacteria. They have absolutely no effect on viruses. This is the single most important fact that guides appropriate antibiotic use.</p>

        <h2>Infections That DO Need Antibiotics</h2>
        <ul>
          <li><strong>Bacterial pneumonia</strong> - High fever, productive cough with colored sputum, confirmed by chest X-ray</li>
          <li><strong>Urinary tract infections (UTIs)</strong> - Burning urination, frequent urge, confirmed by urine culture</li>
          <li><strong>Streptococcal throat infection</strong> - Severe sore throat with white patches, confirmed by swab test</li>
          <li><strong>Typhoid</strong> - Prolonged fever from Salmonella typhi bacteria</li>
          <li><strong>Skin infections with pus</strong> - Bacterial cellulitis or abscesses</li>
          <li><strong>Tuberculosis</strong> - Requires a full course of specific anti-TB antibiotics</li>
        </ul>

        <h2>Infections That Do NOT Need Antibiotics</h2>
        <ul>
          <li><strong>Common cold</strong> - Caused by rhinovirus; antibiotics are useless and harmful here</li>
          <li><strong>Influenza (flu)</strong> - Viral; treat with rest, fluids, and paracetamol for fever</li>
          <li><strong>Most sore throats</strong> - Over 70% are viral</li>
          <li><strong>Viral diarrhoea</strong> - ORS and rest are the treatment; not antibiotics</li>
          <li><strong>COVID-19</strong> - Viral; antibiotics do not treat COVID-19</li>
        </ul>

        <h2>Signs You Should See a Doctor</h2>
        <p>See a doctor before taking antibiotics if you have fever above 39C for more than 3 days, difficulty breathing, signs of dehydration, or symptoms that are getting worse instead of better after 3-5 days of symptomatic treatment.</p>

        <h2>Never Self-Prescribe Antibiotics</h2>
        <p>In India, antibiotics are technically prescription-only (Schedule H) but are still sold without prescriptions at many pharmacies. This practice is illegal and contributes directly to antibiotic resistance. Always get a doctor's prescription before taking any antibiotic.</p>

        <p>Suprameds dispenses antibiotics only with valid prescriptions as required by Indian law. Shop for your prescription medicines at <strong>store.supracynpharma.com</strong> with guaranteed quality and proper pharmacist review.</p>
      </div>
    ),
  },
  {
    slug: "antibiotic-resistance-problem-india",
    title: "Why Antibiotic Resistance Is a Problem in India",
    description: "India is at the epicentre of the global antibiotic resistance crisis. Here is why it matters and what you can do.",
    date: "2026-04-07",
    author: "Suprameds Editorial",
    readTime: "6 min read",
    category: "health",
    tags: ["antibiotic resistance", "AMR", "public health", "India"],
    content: () => (
      <div>
        <p>Antibiotic resistance is one of the most serious public health threats facing India today. The country is considered the global capital of antibiotic-resistant infections, a title that carries devastating consequences for patients, families, and the healthcare system.</p>

        <h2>What Is Antibiotic Resistance?</h2>
        <p>When bacteria are exposed to antibiotics repeatedly, especially when courses are incomplete or antibiotics are taken unnecessarily, some bacteria survive by developing mechanisms to defeat the drug. These resistant bacteria multiply and spread. Over time, antibiotics that once worked stop working entirely.</p>

        <h2>Why India Is Especially Vulnerable</h2>
        <ul>
          <li><strong>Over-the-counter antibiotic sales</strong> - Despite being Schedule H, antibiotics are widely sold without prescriptions at chemist shops across India</li>
          <li><strong>Incomplete courses</strong> - Patients stop taking antibiotics once they feel better, leaving partially resistant bacteria to multiply</li>
          <li><strong>Agricultural use</strong> - Antibiotics are used extensively in poultry and livestock farming in India, creating resistant bacteria that enter the food chain</li>
          <li><strong>Poor sanitation</strong> - Resistance genes spread easily in environments with inadequate sewage treatment and water treatment</li>
          <li><strong>High disease burden</strong> - More infections mean more antibiotic prescriptions, creating more selection pressure for resistance</li>
        </ul>

        <h2>The Real-World Consequences</h2>
        <p>India already sees high rates of resistance to commonly used antibiotics. Carbapenem-resistant Klebsiella pneumoniae, NDM-1 producing bacteria (first discovered in New Delhi), and multidrug-resistant tuberculosis are all serious problems in Indian hospitals. Patients with these infections often have very few treatment options left.</p>

        <h2>What Every Individual Can Do</h2>
        <ul>
          <li>Never take antibiotics without a doctor's prescription</li>
          <li>Always complete the full prescribed course, even if you feel better</li>
          <li>Never share your antibiotic course with someone else</li>
          <li>Do not demand antibiotics from doctors for viral infections</li>
          <li>Dispose of unused antibiotics properly; do not flush them down the drain</li>
        </ul>

        <p>At Suprameds, we dispense antibiotics only with valid doctor prescriptions as mandated by the Drugs and Cosmetics Act. Every order is reviewed by our licensed pharmacist before dispatch. Shop responsibly at <strong>store.supracynpharma.com</strong>.</p>
      </div>
    ),
  },
  {
    slug: "otc-medicines-you-should-never-combine",
    title: "OTC Medicines You Should Never Combine",
    description: "Common over-the-counter medicine combinations that cause dangerous interactions, explained in simple terms for Indian consumers.",
    date: "2026-04-08",
    author: "Suprameds Editorial",
    readTime: "5 min read",
    category: "health",
    tags: ["drug interactions", "OTC medicines", "medicine safety", "combinations"],
    content: () => (
      <div>
        <p>Just because a medicine is available without a prescription does not mean it is harmless. Many Indians unknowingly combine OTC medicines in ways that cause dangerous interactions, reduce effectiveness, or lead to overdose. Here are the most important combinations to avoid.</p>

        <h2>Paracetamol Plus Cold and Flu Tablets</h2>
        <p>Many combination cold medicines (like Coldact, D-Cold Total, or Sinarest) already contain paracetamol. If you also take a separate paracetamol tablet for pain or fever at the same time, you risk exceeding the maximum daily dose of 4g. Paracetamol overdose is a leading cause of drug-induced liver failure in India. Always read ingredient labels before combining.</p>

        <h2>Aspirin Plus Ibuprofen</h2>
        <p>Both are NSAIDs (non-steroidal anti-inflammatory drugs). Taking them together dramatically increases the risk of gastric bleeding without providing additional pain relief. If you take low-dose aspirin for heart protection, ibuprofen can interfere with this cardioprotective effect.</p>

        <h2>Antacids Plus Antibiotics or Iron Tablets</h2>
        <p>Antacids containing calcium, magnesium, or aluminium bind to antibiotics like ciprofloxacin and doxycycline, as well as iron supplements, preventing their absorption. Always leave a gap of at least 2 hours between antacids and these medicines.</p>

        <h2>Antihistamines Plus Sleeping Pills or Alcohol</h2>
        <p>First-generation antihistamines (chlorpheniramine, promethazine) cause sedation. Combining them with sleeping medicines, benzodiazepines, or alcohol multiplies the sedation effect and can suppress breathing. Avoid driving after taking these combinations.</p>

        <h2>Cough Suppressants Plus Expectorants</h2>
        <p>Cough suppressants (like dextromethorphan) stop the cough reflex. Expectorants (like guaifenesin) loosen mucus so it can be coughed out. Taking both at the same time is counterproductive and can trap mucus in the lungs.</p>

        <h2>Laxatives Plus Diuretics</h2>
        <p>Both remove water and electrolytes from the body. Using them together risks severe dehydration and dangerous drops in potassium, which can affect heart rhythm.</p>

        <h2>The Safe Rule</h2>
        <p>When in doubt, ask a pharmacist before combining any two medicines. At Suprameds, our licensed pharmacists review every order and are available to answer medicine-related questions. Order safely at <strong>store.supracynpharma.com</strong>.</p>
      </div>
    ),
  },
  {
    slug: "medicine-storage-temperature-light-humidity",
    title: "Medicine Storage at Home: Temperature, Light, and Humidity",
    description: "How to store medicines correctly at home to maintain their potency and prevent accidental damage.",
    date: "2026-04-08",
    author: "Suprameds Editorial",
    readTime: "5 min read",
    category: "health",
    tags: ["medicine storage", "home pharmacy", "drug stability", "safety"],
    content: () => (
      <div>
        <p>Most people store medicines wherever is convenient. But incorrect storage can silently degrade your medicines, making them less effective or even unsafe. In India's hot and humid climate, proper medicine storage is especially critical.</p>

        <h2>The Three Enemies of Medicines</h2>

        <h3>Heat</h3>
        <p>High temperatures accelerate chemical breakdown in medicines. The standard storage instruction "store below 25C" is challenging in most Indian cities during summer, where room temperatures regularly exceed 35-40C. Heat-sensitive medicines include insulin, suppositories, some eye drops, and many liquid syrups. Keep these in the refrigerator (but not the freezer) unless the label says otherwise.</p>

        <h3>Light</h3>
        <p>Direct sunlight and even artificial light can degrade certain medicines. This is why some medicines come in amber or dark-colored bottles. Medicines like methotrexate, nitrofurantoin, and certain eye drops are especially light-sensitive. Store all medicines in opaque containers or in dark cupboards.</p>

        <h3>Humidity</h3>
        <p>Moisture causes tablets to crumble, capsules to stick together, and creams to separate. The bathroom medicine cabinet is actually the worst possible storage location due to shower humidity. The kitchen near the stove is the second worst. Choose a cool, dry cupboard in a bedroom or living room instead.</p>

        <h2>Refrigerator Storage Rules</h2>
        <ul>
          <li>Store insulin, biological medicines, and probiotics in the main compartment (2-8C)</li>
          <li>Never place medicines in the door shelf where temperature fluctuates</li>
          <li>Never freeze medicines unless explicitly instructed</li>
          <li>Allow refrigerated medicines to reach room temperature before use if instructions say so</li>
        </ul>

        <h2>Room Temperature Storage</h2>
        <p>Most tablets and capsules should be stored at 15-25C. If your home is hotter in summer, consider moving sensitive medicines to the refrigerator after confirming this is acceptable with your pharmacist. Many medicines are stable at up to 30C, but check the label.</p>

        <h2>Child and Pet Safety</h2>
        <p>Always store medicines in locked cabinets if children are present. Child-resistant packaging is standard in India but not foolproof. Accidental ingestion by children is a medical emergency.</p>

        <p>Suprameds ships medicines in temperature-appropriate packaging, including cold-chain delivery for insulin and biologics. Order your medicines at <strong>store.supracynpharma.com</strong>.</p>
      </div>
    ),
  },
  {
    slug: "understanding-expiry-dates-indian-medicine-packs",
    title: "Understanding Expiry Dates on Indian Medicine Packs",
    description: "What expiry dates on Indian medicine packaging actually mean, and when it is truly unsafe to use an expired medicine.",
    date: "2026-04-09",
    author: "Suprameds Editorial",
    readTime: "5 min read",
    category: "health",
    tags: ["expiry date", "medicine safety", "drug stability", "Indian pharmacy"],
    content: () => (
      <div>
        <p>Almost every Indian household has a drawer with half-used medicine strips, and the question arises: is this expired tablet still safe to take? The answer depends on the type of medicine and how it has been stored. Here is what you need to know.</p>

        <h2>What an Expiry Date Actually Means</h2>
        <p>The expiry date on Indian medicine packaging is the date until which the manufacturer guarantees the medicine contains at least 90% of its labeled potency when stored correctly. It does not mean the medicine becomes poisonous the next day. However, it does mean the medicine may be less effective than expected.</p>

        <h2>How Expiry Dates Are Determined</h2>
        <p>Under the Drugs and Cosmetics Act, manufacturers conduct stability studies under controlled temperature and humidity conditions. For most tablets and capsules, this testing period is 2-3 years. Some medicines are stable far beyond their labeled expiry if stored well; others degrade faster in poor conditions.</p>

        <h2>Medicines Where Expiry Is Non-Negotiable</h2>
        <ul>
          <li><strong>Insulin</strong> - Expired insulin loses potency and can cause dangerous blood sugar fluctuations</li>
          <li><strong>Nitroglycerin (for heart attacks)</strong> - Degrades rapidly; old tablets may fail in an emergency</li>
          <li><strong>Liquid antibiotics</strong> - Reconstituted syrups are stable only for 7-14 days after mixing</li>
          <li><strong>Eye drops</strong> - Sterility is not guaranteed after expiry; risk of eye infections</li>
          <li><strong>Tetracycline antibiotics</strong> - Can produce toxic breakdown products after expiry</li>
          <li><strong>Vaccines and biologics</strong> - Never use expired biological medicines</li>
        </ul>

        <h2>Medicines With More Stability Margin</h2>
        <p>Studies (including those by the US military) show that solid oral medicines like paracetamol, antacids, and many antihistamines retain over 90% potency for years beyond their expiry if stored correctly in cool, dry, dark conditions. That said, using medicines past expiry is not recommended practice.</p>

        <h2>How to Read Indian Medicine Labels</h2>
        <p>Indian medicine packs display expiry as "EXP MM/YYYY" or "Use before MM/YYYY." The medicine is valid through the last day of that month. A pack labeled "EXP 04/2026" is valid until April 30, 2026.</p>

        <h2>The Right Thing to Do</h2>
        <p>Replace expired medicines promptly and dispose of them safely by taking them to a pharmacy or municipal disposal point. Never flush medicines down the drain as this contaminates water supplies.</p>

        <p>Suprameds ships only medicines with a minimum of 6 months shelf life remaining, clearly labeled and FEFO-allocated from our warehouse. Order at <strong>store.supracynpharma.com</strong> for guaranteed fresh stock.</p>
      </div>
    ),
  },
  {
    slug: "side-effects-vs-adverse-effects-patients",
    title: "Side Effects vs Adverse Effects: What Patients Need to Know",
    description: "The difference between expected side effects and dangerous adverse drug reactions, and when to call your doctor.",
    date: "2026-04-09",
    author: "Suprameds Editorial",
    readTime: "5 min read",
    category: "health",
    tags: ["side effects", "adverse reactions", "medicine safety", "patient education"],
    content: () => (
      <div>
        <p>Every medicine has the potential to cause unintended effects. Knowing the difference between a minor expected side effect and a dangerous adverse reaction can help you make better decisions and potentially prevent a serious medical event.</p>

        <h2>Side Effects: Expected and Usually Minor</h2>
        <p>A side effect is a known, predictable effect of a medicine that occurs in addition to the intended therapeutic effect. Most side effects are mild and manageable. Examples include:</p>
        <ul>
          <li>Nausea from metformin (common when starting diabetes treatment)</li>
          <li>Dry cough from ACE inhibitors like enalapril or lisinopril</li>
          <li>Drowsiness from antihistamines</li>
          <li>Diarrhoea from antibiotics disrupting gut bacteria</li>
          <li>Headache from nitrates used for heart disease</li>
        </ul>
        <p>These side effects are listed in the package insert (PIL) and are generally not a reason to stop the medicine without consulting your doctor first.</p>

        <h2>Adverse Drug Reactions: Unexpected and Potentially Serious</h2>
        <p>An adverse drug reaction (ADR) is an unintended, harmful response to a medicine at a normal dose. Unlike common side effects, ADRs are often unpredictable and may require immediate medical attention. Examples include:</p>
        <ul>
          <li><strong>Anaphylaxis</strong> - Severe allergic reaction causing throat swelling and breathing difficulty (penicillin, aspirin)</li>
          <li><strong>Stevens-Johnson Syndrome</strong> - Severe skin blistering from carbamazepine, allopurinol, or sulfonamides</li>
          <li><strong>Hepatotoxicity</strong> - Liver damage from anti-TB drugs (isoniazid, rifampicin) or paracetamol overdose</li>
          <li><strong>QT prolongation</strong> - Dangerous heart rhythm abnormality from certain antibiotics and antifungals</li>
        </ul>

        <h2>Warning Signs That Require Immediate Attention</h2>
        <p>Stop the medicine and seek emergency care immediately if you experience:</p>
        <ul>
          <li>Throat swelling, difficulty breathing, or sudden drop in blood pressure</li>
          <li>Severe skin rash with blistering or peeling</li>
          <li>Yellowing of eyes or skin (jaundice)</li>
          <li>Severe chest pain or irregular heartbeat</li>
          <li>Sudden confusion or altered consciousness</li>
        </ul>

        <h2>Reporting ADRs in India</h2>
        <p>India's Pharmacovigilance Programme of India (PvPI) allows patients and doctors to report adverse drug reactions. Reports can be submitted via the ADR reporting portal at pvpindia.in or through the toll-free number 1800-180-3024.</p>

        <p>If you have questions about side effects of medicines you are taking, Suprameds pharmacists are available to help. Order your medicines at <strong>store.supracynpharma.com</strong> with confidence.</p>
      </div>
    ),
  },
  {
    slug: "how-long-to-take-course-of-antibiotics",
    title: "How Long Should You Take a Course of Antibiotics",
    description: "Why completing the full course of antibiotics matters, and what happens when you stop early.",
    date: "2026-04-10",
    author: "Suprameds Editorial",
    readTime: "4 min read",
    category: "health",
    tags: ["antibiotics", "treatment duration", "antibiotic resistance", "patient education"],
    content: () => (
      <div>
        <p>One of the most common medicine mistakes in India is stopping antibiotics as soon as you start feeling better. This is not just ineffective - it actively makes the antibiotic resistance problem worse and increases the chance your infection returns in a harder-to-treat form.</p>

        <h2>Why You Feel Better Before the Infection Is Gone</h2>
        <p>Antibiotics start reducing the bacterial load in your body within 24-48 hours, which is why fever drops and symptoms improve. But reducing the bacterial population is not the same as eliminating it. The weaker, more susceptible bacteria die first. The stronger, partially resistant bacteria survive longer. If you stop taking the antibiotic at this point, you leave those stronger bacteria alive to multiply.</p>

        <h2>Standard Course Lengths for Common Infections</h2>
        <ul>
          <li><strong>Simple UTI in women</strong> - 3 to 7 days depending on the antibiotic prescribed</li>
          <li><strong>Strep throat</strong> - 10 days of penicillin (shorter courses have higher failure rates)</li>
          <li><strong>Skin infections</strong> - Typically 5 to 10 days</li>
          <li><strong>Community-acquired pneumonia</strong> - 5 to 7 days in uncomplicated cases</li>
          <li><strong>Typhoid</strong> - 7 to 14 days depending on the antibiotic and severity</li>
          <li><strong>Tuberculosis</strong> - Minimum 6 months (some drug-resistant cases require 18-24 months)</li>
        </ul>

        <h2>What Happens When You Stop Early</h2>
        <ul>
          <li>The infection can relapse, often more severely than the first episode</li>
          <li>Resistant bacteria that survived the short course are now the dominant strain</li>
          <li>Retreatment requires stronger, more expensive, and more toxic antibiotics</li>
          <li>You can spread resistant bacteria to household contacts</li>
        </ul>

        <h2>Can the Course Be Too Long?</h2>
        <p>Yes. Modern evidence supports shorter courses for many infections compared to what was prescribed 20 years ago. Shorter courses mean less disruption to gut bacteria and lower resistance pressure. Your doctor should prescribe the shortest evidence-based course. Do not add extra days on your own either.</p>

        <h2>The Simple Rule</h2>
        <p>Take exactly the dose prescribed, at the times prescribed, for the full number of days prescribed. Not more. Not less.</p>

        <p>Suprameds ensures you can complete your full antibiotic course by delivering your full prescription to your door. Order at <strong>store.supracynpharma.com</strong> with prescription upload.</p>
      </div>
    ),
  },
  {
    slug: "paracetamol-dosage-guide-india",
    title: "Paracetamol Dosage Guide: The Most Misused Medicine in India",
    description: "Correct dosing, maximum daily limits, dangers of overdose, and safe use of paracetamol for adults and children in India.",
    date: "2026-04-10",
    author: "Suprameds Editorial",
    readTime: "6 min read",
    category: "health",
    tags: ["paracetamol", "dosage", "fever", "pain relief", "overdose"],
    content: () => (
      <div>
        <p>Paracetamol (acetaminophen) is India's most widely used medicine. It is found in hundreds of branded products, from Crocin to Dolo, Calpol to Tylenol. But because it seems so safe and is so freely available, it is also frequently overdosed - sometimes with fatal consequences.</p>

        <h2>Correct Adult Dosage</h2>
        <ul>
          <li><strong>Standard dose</strong>: 500mg to 1,000mg per dose for adults</li>
          <li><strong>Frequency</strong>: Every 4 to 6 hours as needed</li>
          <li><strong>Maximum daily dose</strong>: 4,000mg (4g) per day for healthy adults</li>
          <li><strong>For those with liver disease or heavy alcohol use</strong>: Maximum 2,000mg (2g) per day</li>
        </ul>

        <h2>Paediatric Dosage</h2>
        <p>Children's dosing is based on body weight, not age. The standard paediatric dose is 10-15mg per kilogram of body weight per dose, every 4 to 6 hours. For a 10kg child, this means 100-150mg per dose - equivalent to 2-3ml of most 250mg/5ml syrups. Always use the measuring syringe provided with children's paracetamol, not a kitchen spoon.</p>

        <h2>Why Paracetamol Overdose Happens in India</h2>
        <p>The main reason for accidental overdose is not taking one extra tablet. It is taking paracetamol alone AND a combination cold medicine (like Coldact Plus, D-Cold Total, or Sinarest) that also contains paracetamol, without realising both products have the same active ingredient. Reading ingredient labels is critical.</p>

        <h2>Signs of Paracetamol Overdose</h2>
        <p>Early symptoms (first 24 hours) are often mild: nausea, vomiting, malaise. The real danger comes 3-4 days later when liver damage becomes apparent, with yellowing of eyes (jaundice), abdominal pain, and liver failure. By the time severe symptoms appear, the damage may be irreversible. If you suspect overdose, go to a hospital immediately without waiting for symptoms to worsen.</p>

        <h2>Groups at Higher Risk</h2>
        <ul>
          <li>People with chronic liver disease or hepatitis</li>
          <li>Regular alcohol drinkers (alcohol depletes the liver enzyme that neutralises paracetamol)</li>
          <li>People who are fasting or malnourished</li>
          <li>People taking certain medicines like carbamazepine or rifampicin</li>
        </ul>

        <h2>When Paracetamol May Not Be Enough</h2>
        <p>For severe pain, anti-inflammatory pain relievers (NSAIDs like ibuprofen) may be more effective. For high fever in adults that does not respond to paracetamol alone, alternating with ibuprofen every 4 hours can be more effective - but discuss this with your doctor first.</p>

        <p>Suprameds stocks Crocin, Dolo, and generic paracetamol at the lowest prices. Order at <strong>store.supracynpharma.com</strong>.</p>
      </div>
    ),
  },
  {
    slug: "supplements-vs-medicines-difference-india",
    title: "Supplements vs Medicines: What Is the Difference in India",
    description: "How Indian law distinguishes between dietary supplements and medicines, and what this means for safety and efficacy claims.",
    date: "2026-04-11",
    author: "Suprameds Editorial",
    readTime: "5 min read",
    category: "health",
    tags: ["supplements", "nutraceuticals", "FSSAI", "CDSCO", "regulatory"],
    content: () => (
      <div>
        <p>Walk into any Indian pharmacy or browse any health website and you will find shelves filled with products that look like medicines but are labeled as supplements. Understanding the difference is important because it affects safety standards, efficacy evidence, and your money.</p>

        <h2>How India Regulates Medicines</h2>
        <p>Prescription and OTC medicines in India are regulated by the Central Drugs Standard Control Organisation (CDSCO) under the Drugs and Cosmetics Act, 1940. Before a medicine can be sold, it must undergo clinical trials, demonstrate safety and efficacy, and receive a licence. The manufacturer must prove the drug works.</p>

        <h2>How India Regulates Supplements</h2>
        <p>Dietary supplements, nutraceuticals, and health foods are regulated by FSSAI (Food Safety and Standards Authority of India) as foods, not medicines. They do not require clinical trials to prove efficacy. The manufacturer must only demonstrate the product is safe to consume, not that it actually works for any health claim.</p>

        <h2>The Practical Difference</h2>
        <ul>
          <li><strong>Medicines</strong>: Proven efficacy through clinical trials. Specific dosing. Strict manufacturing standards (Schedule M GMP). Adverse effects must be declared.</li>
          <li><strong>Supplements</strong>: No mandatory efficacy proof. Vague health claims allowed ("supports immunity", "promotes joint health"). FSSAI GMP is less stringent than drug GMP.</li>
        </ul>

        <h2>Common Examples of Confusion</h2>
        <p><strong>Vitamin D3</strong>: Available as both a licensed medicine (Calcirol, Uprise D3) and as a dietary supplement. The licensed medicine version has stricter quality testing and more reliable dosing.</p>
        <p><strong>Omega-3 fatty acids</strong>: Available as prescription-grade pharmaceuticals and as fish oil supplements. Pharmaceutical grade has certified EPA/DHA content; supplements vary widely.</p>
        <p><strong>Probiotics</strong>: Pharmaceutical probiotics like Enterogermina have clinical evidence for specific conditions; probiotic supplements make general gut health claims without the same evidence standard.</p>

        <h2>When to Choose a Medicine Over a Supplement</h2>
        <p>If you have a diagnosed deficiency (vitamin D deficiency confirmed by blood test, iron-deficiency anaemia), choose the licensed pharmaceutical product. Your doctor can prescribe the appropriate dose and formulation. Do not rely on supplements at nutritional doses to correct clinical deficiencies.</p>

        <p>Suprameds stocks both licensed pharmaceutical vitamins and minerals as well as FSSAI-registered supplements. Our pharmacists can help you choose the right product for your needs at <strong>store.supracynpharma.com</strong>.</p>
      </div>
    ),
  },
  {
    slug: "women-india-vitamin-d-iron-deficient",
    title: "Why Women in India Are Vitamin D and Iron Deficient",
    description: "The specific reasons Indian women face epidemic rates of vitamin D and iron deficiency, and evidence-based ways to address them.",
    date: "2026-04-11",
    author: "Suprameds Editorial",
    readTime: "6 min read",
    category: "health",
    tags: ["women health", "vitamin D", "iron deficiency", "anaemia", "India"],
    content: () => (
      <div>
        <p>India has one of the highest rates of both vitamin D deficiency and iron deficiency anaemia in the world, and women bear a disproportionate burden. Understanding why these deficiencies are so prevalent helps explain why supplementation alone is often not enough.</p>

        <h2>The Vitamin D Crisis</h2>
        <p>Over 70% of Indian women are vitamin D deficient, including in sunny cities like Mumbai and Chennai. This is paradoxical given that India receives abundant sunshine year-round. The reasons are multi-layered:</p>
        <ul>
          <li><strong>Melanin and skin tone</strong>: Darker skin requires 3-5 times more sun exposure to produce the same amount of vitamin D as lighter skin</li>
          <li><strong>Cultural practices</strong>: Covered clothing and staying indoors limit sun exposure, especially for women in northern and western India</li>
          <li><strong>Indoor work</strong>: Urbanisation has moved millions of women from outdoor to indoor work</li>
          <li><strong>Diet</strong>: Indian vegetarian diets have almost no dietary sources of vitamin D (it is found mainly in fatty fish, egg yolks, and fortified foods)</li>
          <li><strong>Pollution</strong>: Air pollution in Indian cities blocks UVB radiation, reducing vitamin D synthesis even when outdoors</li>
        </ul>

        <h2>Consequences of Vitamin D Deficiency in Women</h2>
        <p>Vitamin D deficiency in Indian women contributes to osteoporosis (especially post-menopause), muscle weakness and fatigue, immune dysfunction, and increased risk of gestational diabetes in pregnancy.</p>

        <h2>The Iron Deficiency Burden</h2>
        <p>Over 50% of women of reproductive age in India are anaemic, with iron deficiency being the primary cause. Contributing factors include:</p>
        <ul>
          <li><strong>Menstrual blood loss</strong>: Monthly menstruation requires increased iron intake that many diets do not provide</li>
          <li><strong>Predominantly vegetarian diet</strong>: Non-haem iron from plant sources (lentils, spinach) is absorbed at 2-8% efficiency vs. 15-35% for haem iron from meat</li>
          <li><strong>Phytates and tannins</strong>: Common in Indian food (chapati, tea, coffee) that block iron absorption when consumed together with iron-rich foods</li>
          <li><strong>Repeated pregnancies</strong>: Each pregnancy depletes iron stores; closely spaced pregnancies worsen deficiency</li>
          <li><strong>Hookworm infection</strong>: Still prevalent in rural areas, causing chronic blood loss</li>
        </ul>

        <h2>Practical Steps</h2>
        <ul>
          <li>Get vitamin D and haemoglobin tested at your annual checkup</li>
          <li>If deficient, take prescribed doses of vitamin D (60,000 IU weekly for 8 weeks is common in India, followed by maintenance)</li>
          <li>For iron absorption, take iron supplements with vitamin C juice and avoid taking with tea or milk</li>
          <li>Eat iron-rich foods (ragi, horse gram, dates, jaggery) with vitamin C-rich foods (amla, guava, lemon)</li>
        </ul>

        <p>Suprameds stocks Vitamin D3 sachets, iron-folic acid tablets, and other women's health supplements at below-MRP prices. Order at <strong>store.supracynpharma.com</strong>.</p>
      </div>
    ),
  },
  {
    slug: "manage-medicine-side-effects-before-calling-doctor",
    title: "How to Manage Medicine Side Effects Before Calling Your Doctor",
    description: "Practical self-care strategies for common medicine side effects, and clear guidance on when you must call your doctor immediately.",
    date: "2026-04-12",
    author: "Suprameds Editorial",
    readTime: "5 min read",
    category: "health",
    tags: ["side effects", "self care", "medicine management", "patient education"],
    content: () => (
      <div>
        <p>Starting a new medicine often comes with minor side effects that are uncomfortable but not dangerous. Knowing how to manage these at home - and recognising when a side effect requires urgent medical attention - helps you stay on your treatment without unnecessary doctor visits.</p>

        <h2>Nausea and Upset Stomach</h2>
        <p><strong>Common culprits</strong>: Metformin, antibiotics, iron tablets, NSAIDs, chemotherapy</p>
        <p><strong>Self-care</strong>: Take with food (unless specifically instructed otherwise). Eat small, bland meals. Avoid spicy food. Ginger tea can help mild nausea. For metformin, extended-release formulations cause less nausea - ask your doctor to switch.</p>
        <p><strong>Call doctor if</strong>: Vomiting prevents you from keeping any medicine down for more than 24 hours.</p>

        <h2>Diarrhoea</h2>
        <p><strong>Common culprits</strong>: Antibiotics, metformin, magnesium-containing antacids</p>
        <p><strong>Self-care</strong>: Increase fluid intake with ORS. Eat a BRAT diet (banana, rice, apple, toast). Probiotic supplements may help antibiotic-associated diarrhoea. Avoid dairy and high-fat foods temporarily.</p>
        <p><strong>Call doctor if</strong>: Diarrhoea is severe (more than 8 episodes per day), contains blood or mucus, or is accompanied by high fever.</p>

        <h2>Dry Cough</h2>
        <p><strong>Common culprits</strong>: ACE inhibitors (enalapril, ramipril, lisinopril)</p>
        <p><strong>Self-care</strong>: Unfortunately, there is no reliable self-management for ACE inhibitor cough. The cough is caused by accumulation of bradykinin.</p>
        <p><strong>Call doctor</strong>: Inform your doctor at your next appointment. They can switch you to an ARB (angiotensin receptor blocker) like telmisartan, which does not cause this cough.</p>

        <h2>Headache</h2>
        <p><strong>Common culprits</strong>: Nitrates, calcium channel blockers, sildenafil, some blood pressure medicines</p>
        <p><strong>Self-care</strong>: Hydrate well. Rest in a dark, quiet room. Paracetamol is safe for most medicine-induced headaches. Headaches from nitrates often improve after 1-2 weeks as tolerance develops.</p>

        <h2>Dizziness and Light-headedness</h2>
        <p><strong>Common culprits</strong>: Blood pressure medicines, diuretics, antidepressants (especially when starting)</p>
        <p><strong>Self-care</strong>: Rise slowly from sitting or lying positions. Hold onto something when standing. Avoid driving during the first week on a new blood pressure medication. Stay hydrated.</p>
        <p><strong>Call doctor if</strong>: You faint, fall, or dizziness is so severe you cannot function safely.</p>

        <p>Suprameds pharmacists can answer questions about side effects before you call your doctor. Order your medicines at <strong>store.supracynpharma.com</strong>.</p>
      </div>
    ),
  },
  {
    slug: "what-happens-if-you-miss-a-dose",
    title: "What Happens If You Miss a Dose? Guide by Medicine Type",
    description: "The correct action when you miss a dose varies by medicine type. Here is a practical guide for the most common scenarios.",
    date: "2026-04-12",
    author: "Suprameds Editorial",
    readTime: "5 min read",
    category: "health",
    tags: ["missed dose", "medicine adherence", "chronic disease", "patient education"],
    content: () => (
      <div>
        <p>Life happens. Sometimes a dose gets missed. The right response depends entirely on what medicine you are taking, how much time has passed, and whether you take it once daily or multiple times. Here is a practical guide to the most common situations.</p>

        <h2>The General Rule</h2>
        <p>If you remember within half the dosing interval, take the missed dose. If it is closer to the next dose, skip the missed dose and continue your regular schedule. <strong>Never take a double dose to make up for a missed one</strong> unless your doctor has specifically told you to.</p>

        <h2>Once-Daily Medicines (Blood Pressure, Cholesterol, Thyroid)</h2>
        <p>If you remember the same day, take it. If you only remember the next morning, skip the missed dose and take your next scheduled dose as normal. A single missed dose of amlodipine, atorvastatin, or levothyroxine rarely causes measurable harm, but consistent missing is dangerous for long-term disease control.</p>

        <h2>Antibiotics</h2>
        <p>Take the missed dose as soon as you remember. If it is almost time for your next dose, skip the missed one. Do NOT double up. Completing the full course is more important than perfect timing; do not stop early just because you missed a dose in the middle.</p>

        <h2>Oral Contraceptives</h2>
        <p>This is the most time-sensitive missed dose situation. For combined oral contraceptives (estrogen plus progestin), take the missed pill as soon as you remember, even if that means taking two pills in one day. Use additional contraception for the next 7 days if you missed by more than 12 hours. For progestin-only pills, the window is 3 hours. Always check the specific instructions in the package insert of your brand.</p>

        <h2>Insulin</h2>
        <p>Missing a dose of basal insulin (once daily) usually means a day of higher blood glucose. Take it when you remember if it is still the same day. Missing a meal-time (bolus) insulin dose is more complex: if you have already eaten, take a reduced dose if blood glucose is high. If you have not yet eaten, take the full dose before eating. Monitor blood glucose more frequently. When in doubt, call your diabetologist.</p>

        <h2>Warfarin and Blood Thinners</h2>
        <p>Take the missed dose the same day if remembered. If you miss by a full day, skip it and continue normally. Do not double up. Measure INR more frequently if doses are being missed regularly, as irregular dosing makes warfarin difficult to control.</p>

        <h2>Anti-TB Medicines (DOTS)</h2>
        <p>Under India's national TB programme (NIKSHAY), missing doses can cause treatment failure and drug resistance. If you miss a DOTS dose, contact your TB treatment supporter or ASHA worker immediately. Do not try to make up doses on your own schedule.</p>

        <p>Suprameds offers easy refill ordering so you never run out of chronic medications. Set up your recurring prescription at <strong>store.supracynpharma.com</strong>.</p>
      </div>
    ),
  },
  {
    slug: "how-suprameds-is-licensed-to-sell-medicines-online",
    title: "How SupraMeds Is Licensed to Sell Medicines Online in India",
    description: "A transparent explanation of the licences, registrations, and regulatory approvals that authorise SupraMeds to operate as a legal online pharmacy in India.",
    date: "2026-04-13",
    author: "Suprameds Editorial",
    readTime: "5 min read",
    category: "pharmacy",
    tags: ["online pharmacy licence", "CDSCO", "Drug Controller", "legal pharmacy India"],
    content: () => (
      <div>
        <p>Online pharmacy regulation in India has evolved rapidly. Today, operating a legitimate online pharmacy requires multiple licences and registrations at both state and central levels. Here is a clear explanation of how SupraMeds is authorised to sell medicines to customers across India.</p>

        <h2>State Drug Licence</h2>
        <p>Every pharmacy in India, whether physical or online, must hold a valid Retail Drug Licence (RDL) issued by the State Drug Control Authority under the Drugs and Cosmetics Act, 1940. This licence authorises the sale of Schedule H and H1 drugs (prescription medicines) and OTC medicines. The licence is tied to a specific licensed premises and requires a full-time Registered Pharmacist on staff.</p>

        <h2>Registered Pharmacist on Duty</h2>
        <p>The Pharmacy Practice Regulations require that every prescription dispensed by a pharmacy be reviewed by a licensed pharmacist. At SupraMeds, every order containing prescription medicines is reviewed by our in-house pharmacist before dispatch. This is not optional - it is a legal requirement and a patient safety obligation.</p>

        <h2>GST Registration</h2>
        <p>SupraMeds is GST-registered, which means every medicine sale is compliant with India's tax laws, and customers receive a proper tax invoice with each order.</p>

        <h2>FSSAI Registration</h2>
        <p>For nutraceuticals, dietary supplements, and health foods sold on the platform, SupraMeds complies with FSSAI (Food Safety and Standards Authority of India) regulations governing these product categories.</p>

        <h2>Compliance With the Telemedicine Guidelines</h2>
        <p>Where prescriptions are generated through teleconsultation platforms, SupraMeds accepts only those that comply with the Telemedicine Practice Guidelines issued by the Medical Council of India in 2020.</p>

        <h2>What This Means for You</h2>
        <p>When you buy medicines from SupraMeds, you are buying from a pharmacy that is operating within the full framework of Indian pharmaceutical law. Your prescription is verified. Your medicines are tracked from manufacturer to your door. You receive a proper cash memo or invoice with every purchase.</p>

        <p>Shop with confidence at <strong>store.supracynpharma.com</strong>, India's licensed online pharmacy for quality generic medicines.</p>
      </div>
    ),
  },
  {
    slug: "dlt-registration-why-suprameds-has-it",
    title: "What Is DLT Registration and Why SupraMeds Has It",
    description: "An explanation of India's Distributed Ledger Technology registration for SMS communications and why it matters for legitimate businesses.",
    date: "2026-04-13",
    author: "Suprameds Editorial",
    readTime: "4 min read",
    category: "pharmacy",
    tags: ["DLT", "SMS", "TRAI", "regulatory compliance", "anti-spam"],
    content: () => (
      <div>
        <p>If you have ever received an OTP or order update SMS from SupraMeds, that message was sent through India's DLT (Distributed Ledger Technology) system. Here is what DLT is, why TRAI mandated it, and what it means for you as a customer.</p>

        <h2>What Is DLT?</h2>
        <p>In 2018, the Telecom Regulatory Authority of India (TRAI) mandated that all commercial SMS communications (promotional and transactional) sent by businesses must be registered on a blockchain-based platform. This system is called DLT. Every sender, every template message, and every principal entity (the business behind the messages) must be verified and registered on this platform before a single SMS can be sent.</p>

        <h2>Why TRAI Introduced DLT</h2>
        <p>India was facing an epidemic of SMS spam and fraudulent messages, including fake OTPs, phishing links, and fake medicine offers sent by unregistered senders. DLT was introduced to ensure accountability. If a registered entity sends fraudulent or spam messages, they can be traced and penalised. Unregistered senders cannot deliver messages at all on Indian telecom networks.</p>

        <h2>SupraMeds DLT Registration</h2>
        <p>SupraMeds is registered on the DLT platform under the entity name SUPRACYN PRIVATE LIMITED with DLT entity ID 1501684950000036033. Our sender IDs (Suprra, Ssupra, suppra) and all message templates are individually registered and approved by TRAI. This means every SMS you receive from SupraMeds is a verified, traceable communication from our registered entity.</p>

        <h2>What This Means for Your Security</h2>
        <p>DLT registration means:</p>
        <ul>
          <li>You can trust that an OTP arriving from our sender IDs is genuinely from SupraMeds</li>
          <li>Fraudsters cannot spoof our sender IDs on Indian telecom networks</li>
          <li>Every message template you receive has been pre-approved by the telecom authority</li>
          <li>If you receive a suspicious message claiming to be from SupraMeds that does not match our registered sender IDs, it is a fraud attempt - report it to TRAI at 1909</li>
        </ul>

        <p>Your security is our priority. Shop safely at <strong>store.supracynpharma.com</strong>.</p>
      </div>
    ),
  },
  {
    slug: "how-indian-online-pharmacies-regulated-cdsco",
    title: "How Indian Online Pharmacies Are Regulated by CDSCO",
    description: "The regulatory framework governing online pharmacies in India, including CDSCO oversight, draft regulations, and what protects you as a buyer.",
    date: "2026-04-14",
    author: "Suprameds Editorial",
    readTime: "6 min read",
    category: "pharmacy",
    tags: ["CDSCO", "online pharmacy regulation", "Drug Controller", "India pharma law"],
    content: () => (
      <div>
        <p>Online pharmacy regulation in India is a topic that confuses many consumers. The regulatory landscape has evolved significantly over the past decade as e-commerce in medicines has grown. Here is a clear picture of who governs online pharmacies and what laws apply.</p>

        <h2>The Central Drugs Standard Control Organisation (CDSCO)</h2>
        <p>CDSCO is India's national drug regulatory authority, functioning under the Ministry of Health and Family Welfare. It is responsible for approval of new drugs, clinical trial oversight, import licences, and setting standards for drug quality. CDSCO does not directly issue retail pharmacy licences, but it sets the laws under which all pharmacies, including online ones, must operate.</p>

        <h2>The Drugs and Cosmetics Act, 1940</h2>
        <p>This is the primary law governing the sale of medicines in India. It defines which medicines are prescription-only (Schedule H, H1) versus OTC. It mandates that prescription medicines can only be dispensed against a valid prescription by a licensed pharmacist. Online pharmacies must comply with all provisions of this Act.</p>

        <h2>State Drug Licensing</h2>
        <p>Retail drug licences are issued by State Drug Control Authorities. An online pharmacy must be licensed in the state where its dispensing warehouse is located. When delivering across state lines, it must comply with the drug laws of both the source and destination states.</p>

        <h2>The Draft Online Pharmacy Rules</h2>
        <p>CDSCO published draft rules for online pharmacies in 2018. These proposed requiring a central licence for online pharmacies with a national portal tracking all prescription sales. While these rules have not been formally enacted as of 2026, most legitimate online pharmacies operate as if they were in force, maintaining prescription records and pharmacist oversight.</p>

        <h2>Enforcement and Challenges</h2>
        <p>The enforcement of online pharmacy regulations remains inconsistent across India. Multiple High Courts have issued judgments against unlicensed online medicine sales, and the Madras High Court notably banned certain online pharmacies that were dispensing without prescriptions. Legitimate pharmacies like SupraMeds operate with full licences precisely to avoid this legal risk and to protect patients.</p>

        <h2>How to Verify an Online Pharmacy</h2>
        <ul>
          <li>Ask for their drug licence number and verify it on the state drug authority website</li>
          <li>Check that they have a registered pharmacist name and contact</li>
          <li>Confirm they require prescription upload for Schedule H medicines</li>
          <li>Look for GST registration (GSTIN) on their invoices</li>
        </ul>

        <p>SupraMeds operates transparently within Indian pharmaceutical law. View our licences and compliance information at <strong>store.supracynpharma.com</strong>.</p>
      </div>
    ),
  },
  {
    slug: "what-to-check-before-buying-medicines-online-pharmacy",
    title: "What to Check Before Buying Medicines from Any Online Pharmacy",
    description: "A consumer checklist to verify whether an online pharmacy is legitimate and safe before placing your order.",
    date: "2026-04-14",
    author: "Suprameds Editorial",
    readTime: "5 min read",
    category: "pharmacy",
    tags: ["online pharmacy safety", "consumer protection", "fake pharmacy", "India"],
    content: () => (
      <div>
        <p>India's online medicine market has both legitimate licensed pharmacies and illegal operators selling counterfeit or unregulated medicines. With medicine purchases, the stakes are health and safety. Here is the checklist every consumer should run before buying from any online pharmacy.</p>

        <h2>1. Verify the Drug Licence</h2>
        <p>A legitimate online pharmacy must display its Retail Drug Licence number. You can verify this number on the State Drug Controller's website or portal. If a website does not display a drug licence number anywhere, it is a red flag.</p>

        <h2>2. Check for a Licensed Pharmacist</h2>
        <p>The pharmacy must have a Registered Pharmacist on staff. Look for the pharmacist's name and registration number. If the "About" or "Contact" page has no pharmacist information, be cautious.</p>

        <h2>3. Does It Require a Prescription for Rx Drugs?</h2>
        <p>This is the most important test. Any website that allows you to buy Schedule H or H1 prescription medicines (antibiotics, blood pressure medicines, diabetes drugs) without uploading a prescription is operating illegally. Legitimate pharmacies will ask you to upload or courier a prescription before dispensing these medicines.</p>

        <h2>4. Look for a Physical Address</h2>
        <p>A real pharmacy has a licensed dispensing premises with a real physical address. Look for this address on the website and verify it is a real location using Google Maps. Be suspicious of pharmacies with only a P.O. box or no address at all.</p>

        <h2>5. Check GST Invoice</h2>
        <p>Every medicine sale in India attracts 12% GST. A legitimate pharmacy will provide a proper tax invoice with their GSTIN. If you receive a bill that is hand-written, has no GSTIN, or does not show the tax component, ask questions.</p>

        <h2>6. Verify Brand Authenticity Options</h2>
        <p>Good online pharmacies source medicines only from licensed manufacturers and distributors. They should be able to tell you the batch number and manufacturer name for any medicine you purchase. If you ask and they cannot answer, be concerned.</p>

        <h2>7. Check Reviews and Complaints</h2>
        <p>Search the pharmacy's name along with terms like "complaint", "fake", and "fraud" before ordering. Check reviews on Google, Trustpilot, and consumer forums. A pattern of complaints about wrong medicines, damaged goods, or missing deliveries is a serious warning sign.</p>

        <h2>8. Secure Payment Options</h2>
        <p>Only pay via recognised payment gateways (Razorpay, PayU, PhonePe, UPI to verified VPA). Avoid websites that ask for direct bank transfers or cryptocurrency payments.</p>

        <p>SupraMeds meets all of these criteria. Verify our credentials and shop safely at <strong>store.supracynpharma.com</strong>.</p>
      </div>
    ),
  },
  {
    slug: "suprameds-quality-temperature-sensitive-medicines",
    title: "How SupraMeds Ensures Quality for Temperature-Sensitive Medicines",
    description: "The cold-chain processes and quality controls SupraMeds uses to deliver temperature-sensitive medicines in perfect condition.",
    date: "2026-04-14",
    author: "Suprameds Editorial",
    readTime: "5 min read",
    category: "pharmacy",
    tags: ["cold chain", "insulin delivery", "medicine quality", "temperature control"],
    content: () => (
      <div>
        <p>India's climate is one of the most challenging in the world for pharmaceutical logistics. Summer temperatures in the north reach 45C, and monsoon humidity can exceed 90%. For medicines that require refrigeration or are sensitive to heat, delivering them in perfect condition requires deliberate quality processes at every step.</p>

        <h2>Which Medicines Are Temperature-Sensitive?</h2>
        <ul>
          <li><strong>Insulin</strong>: Must be stored at 2-8C (refrigerated). Can tolerate room temperature (below 25C) for up to 28-30 days once opened.</li>
          <li><strong>Certain vaccines</strong> (though vaccines are typically administered by healthcare providers)</li>
          <li><strong>Biological medicines</strong>: Including adalimumab, etanercept, and trastuzumab</li>
          <li><strong>Some eye drops</strong>: Latanoprost and certain other ophthalmic solutions</li>
          <li><strong>Certain probiotics</strong>: Those containing live bacterial cultures</li>
        </ul>

        <h2>SupraMeds Warehouse Storage</h2>
        <p>Our warehouse maintains separate cold-room storage for temperature-sensitive medicines at 2-8C, monitored 24 hours a day with automated temperature logging. Any excursion beyond the acceptable range triggers an immediate alert. We do not ship medicines from temperature-compromised storage.</p>

        <h2>Packaging for Transit</h2>
        <p>Temperature-sensitive medicines are packed in insulated boxes with pharmaceutical-grade gel packs that maintain 2-8C for a minimum of 36 hours. This provides adequate protection for overnight and next-day delivery across most Indian cities.</p>

        <h2>Delivery Partner Standards</h2>
        <p>For cold-chain deliveries, we use partners with pharmaceutical cold-chain experience. Our packing specifications exceed the minimum transit time expected for each delivery zone to ensure safety margins.</p>

        <h2>What to Do When You Receive Cold-Chain Medicines</h2>
        <ul>
          <li>Inspect the package immediately on arrival</li>
          <li>If the gel pack is completely melted and the medicine feels warm, do not use it - contact us immediately</li>
          <li>Transfer insulin and other refrigerated medicines to your refrigerator promptly</li>
          <li>Do not place medicines directly on the freezer compartment or against the back wall of the refrigerator</li>
        </ul>

        <h2>Quality Guarantee</h2>
        <p>If any temperature-sensitive medicine you receive from SupraMeds appears compromised, we will replace it or refund it. Our goal is that every medicine you receive is in perfect condition, exactly as the manufacturer intended.</p>

        <p>Order your temperature-sensitive medicines with confidence at <strong>store.supracynpharma.com</strong>.</p>
      </div>
    ),
  },
  {
    slug: "pharmacist-review-process-every-order-checked",
    title: "Our Pharmacist Review Process: Every Order Checked",
    description: "A transparent look at how SupraMeds pharmacists review prescription medicine orders before they are dispensed.",
    date: "2026-04-15",
    author: "Suprameds Editorial",
    readTime: "4 min read",
    category: "pharmacy",
    tags: ["pharmacist review", "prescription verification", "patient safety", "quality"],
    content: () => (
      <div>
        <p>At SupraMeds, every order containing prescription medicines goes through a pharmacist review before it is packed and dispatched. This is not just a legal requirement under Indian pharmaceutical law - it is the core of how we protect our customers.</p>

        <h2>What Our Pharmacist Checks</h2>

        <h3>Prescription Validity</h3>
        <p>The pharmacist verifies that the uploaded prescription is:</p>
        <ul>
          <li>Issued by a registered medical practitioner (RMP) with a valid registration number</li>
          <li>Dated within the last 30 days for most medicines (or within the validity period stated)</li>
          <li>Legible and contains the patient's name, the prescribed medicine, dose, frequency, and duration</li>
          <li>Not a photocopy of a prescription that has already been dispensed (we track dispensing records)</li>
        </ul>

        <h3>Dose Verification</h3>
        <p>The pharmacist checks that the dose ordered matches what is prescribed and that it is within safe therapeutic ranges. If the dose on the prescription seems unusually high, the pharmacist flags the order for follow-up before dispensing.</p>

        <h3>Drug Interaction Screening</h3>
        <p>For customers with known prescription histories on our platform, the pharmacist screens for potential interactions between newly ordered medicines and their existing medicines. Significant interactions result in a call to the customer before dispensing.</p>

        <h3>Schedule X Compliance</h3>
        <p>Our system and pharmacist together screen every order for Schedule X (NDPS) drugs. These are absolutely prohibited from sale and are never dispensed under any circumstance.</p>

        <h3>Schedule H1 Compliance</h3>
        <p>Schedule H1 medicines (including certain antibiotics and strong analgesics) require the pharmacist to log the dispensing in a register maintained under the Drugs and Cosmetics Rules. This record is available for inspection by the State Drug Authority.</p>

        <h2>What Happens When There Is a Problem</h2>
        <p>If the pharmacist cannot verify a prescription or identifies a concern, the order is held and the customer is contacted with a clear explanation. We would rather delay an order by a few hours to confirm it is safe than dispatch a potentially harmful medicine quickly.</p>

        <p>This commitment to pharmacist oversight is what makes SupraMeds different from grey-market online medicine sellers. Order with confidence at <strong>store.supracynpharma.com</strong>.</p>
      </div>
    ),
  },
  {
    slug: "privacy-prescription-how-suprameds-handles-data",
    title: "Privacy and Your Prescription: How SupraMeds Handles Your Data",
    description: "How SupraMeds stores, protects, and uses prescription data and personal health information in compliance with Indian privacy law.",
    date: "2026-04-15",
    author: "Suprameds Editorial",
    readTime: "5 min read",
    category: "pharmacy",
    tags: ["privacy", "prescription data", "DPDP Act", "health data security"],
    content: () => (
      <div>
        <p>When you upload a prescription to an online pharmacy, you are sharing sensitive personal health information. Knowing how that information is stored, who can access it, and what rights you have is important. Here is exactly how SupraMeds handles your prescription and health data.</p>

        <h2>What Data We Collect</h2>
        <ul>
          <li>Your name, address, and contact number (for delivery)</li>
          <li>Uploaded prescription images (for pharmacist verification)</li>
          <li>Your medicine order history</li>
          <li>Health conditions declared during registration (optional)</li>
        </ul>

        <h2>Legal Basis for Processing</h2>
        <p>Under the Digital Personal Data Protection Act, 2023 (DPDP Act), health data is classified as sensitive personal data. We process your prescription and health data only with your explicit consent and only for the purpose of dispensing medicines to you and maintaining the pharmacy records required by law.</p>

        <h2>Who Can See Your Prescription</h2>
        <ul>
          <li><strong>Our licensed pharmacist</strong>: For verification and dispensing</li>
          <li><strong>Order fulfilment staff</strong>: Only the order number and medicine name; not the full prescription image</li>
          <li><strong>State Drug Authority inspectors</strong>: We are legally required to maintain prescription records and produce them during drug inspections. This is mandated by the Drugs and Cosmetics Rules.</li>
          <li><strong>No one else</strong>: We do not share, sell, or disclose your prescription or health data to any third party including insurers, employers, or marketing companies</li>
        </ul>

        <h2>How Your Data Is Protected</h2>
        <p>Prescription images are stored in encrypted cloud storage with access logs. Our pharmacy management system has role-based access controls so staff can only see the data necessary for their specific function. We conduct periodic access reviews and security audits.</p>

        <h2>Your Rights Under the DPDP Act</h2>
        <ul>
          <li><strong>Right to access</strong>: You can request a copy of all personal data we hold about you</li>
          <li><strong>Right to correction</strong>: You can ask us to correct inaccurate personal data</li>
          <li><strong>Right to erasure</strong>: You can ask us to delete your data, subject to our legal obligation to retain pharmacy records for the period required by the Drugs and Cosmetics Rules</li>
        </ul>

        <p>To exercise your data rights or with any privacy concern, contact us at support@supracynpharma.com. Shop securely at <strong>store.supracynpharma.com</strong>.</p>
      </div>
    ),
  },
  {
    slug: "counterfeit-medicines-india-how-to-spot-them",
    title: "Counterfeit Medicines in India: How to Spot Them",
    description: "How to identify fake and substandard medicines in India, and what to do if you suspect you have received a counterfeit product.",
    date: "2026-04-15",
    author: "Suprameds Editorial",
    readTime: "6 min read",
    category: "pharmacy",
    tags: ["counterfeit medicines", "fake drugs", "medicine quality", "consumer protection"],
    content: () => (
      <div>
        <p>The World Health Organisation estimates that roughly 1 in 10 medicines sold in low- and middle-income countries are either counterfeit or substandard. In India, despite strong regulatory frameworks, counterfeit and spurious medicines remain a real concern, particularly in smaller cities and through unverified online channels. Knowing how to spot fakes could protect your life.</p>

        <h2>Types of Fake Medicines</h2>
        <ul>
          <li><strong>Counterfeit</strong>: Deliberately mislabeled medicines that falsely use a registered brand's name and packaging while containing incorrect, inferior, or no active ingredient</li>
          <li><strong>Spurious</strong>: Medicines that claim to be a product of one manufacturer but are actually made by another, unlicensed one</li>
          <li><strong>Substandard</strong>: Genuine branded medicines that fail quality tests due to poor manufacturing, storage, or degradation</li>
          <li><strong>Unlicensed</strong>: Medicines manufactured or imported without proper approvals</li>
        </ul>

        <h2>How to Spot Suspicious Medicines</h2>

        <h3>Packaging Red Flags</h3>
        <ul>
          <li>Blurry printing, misspelled words, or uneven spacing on the box or blister pack</li>
          <li>Inconsistent font sizes or colours compared to medicines you have bought before</li>
          <li>Missing mandatory information: batch number, manufacturing date, expiry date, manufacturer's full address and licence number</li>
          <li>Box that feels flimsy or uses different cardboard quality than usual</li>
          <li>Tamper-evident seals that look damaged or were clearly replaced</li>
        </ul>

        <h3>Tablet and Capsule Red Flags</h3>
        <ul>
          <li>Unusual colour, size, or texture compared to previous purchases of the same brand</li>
          <li>Tablets that crumble, have uneven coating, or dissolve too quickly or too slowly</li>
          <li>No imprinting or embossing on tablets that should have them</li>
          <li>Strange smell or unusual taste</li>
        </ul>

        <h2>Verify With the Manufacturer</h2>
        <p>Many Indian pharmaceutical companies have toll-free numbers or QR codes for product verification. Scanning the QR code on the pack with your phone should confirm the batch details. If verification fails or the number is not reachable, report to the State Drug Controller.</p>

        <h2>What to Do if You Suspect a Fake</h2>
        <ul>
          <li>Stop using the medicine immediately</li>
          <li>Preserve the packaging and remaining tablets for testing</li>
          <li>Report to the State Drug Control Authority (their number is on the state health department website)</li>
          <li>File a complaint with CDSCO's Drug Alert system at cdscoonline.gov.in</li>
          <li>Contact the brand manufacturer directly</li>
        </ul>

        <p>SupraMeds sources all medicines only from licensed Indian manufacturers and authorised distributors. We maintain batch traceability for every product. Shop with verified quality at <strong>store.supracynpharma.com</strong>.</p>
      </div>
    ),
  },
  {
    slug: "what-licensed-pharmacy-means-india",
    title: "What Licensed Pharmacy Actually Means in India",
    description: "A clear explanation of what it takes to be a licensed pharmacy in India, and why the distinction matters when choosing where to buy your medicines.",
    date: "2026-04-16",
    author: "Suprameds Editorial",
    readTime: "5 min read",
    category: "pharmacy",
    tags: ["pharmacy licence", "drug licence", "registered pharmacist", "India"],
    content: () => (
      <div>
        <p>The word "licensed" gets thrown around loosely in Indian pharmacy marketing. But there is a specific, legal definition of what it means to be a licensed pharmacy in India, and not every medicine seller meets these standards. Here is what the licence actually requires.</p>

        <h2>The Legal Framework</h2>
        <p>The Drugs and Cosmetics Act, 1940 and the Drugs and Cosmetics Rules, 1945 govern pharmacy licensing in India. The Pharmacy Act, 1948 governs the registration of pharmacists. Together, these laws define who can sell medicines and under what conditions.</p>

        <h2>What a Retail Drug Licence Requires</h2>
        <p>To obtain and maintain a Retail Drug Licence (RDL), a pharmacy must:</p>
        <ul>
          <li><strong>Licensed premises</strong>: A physically approved dispensing location that has passed inspection by the State Drug Authority for appropriate storage conditions, temperature control, and security</li>
          <li><strong>Registered Pharmacist</strong>: A pharmacist registered with the State Pharmacy Council must be present whenever the pharmacy is open. This is not a one-time condition; if the pharmacist leaves the employment, the licence is at risk until a replacement is registered</li>
          <li><strong>Separate storage</strong>: Prescription medicines, OTC medicines, and cosmetics must be stored separately</li>
          <li><strong>Prescription records</strong>: A register must be maintained for all Schedule H1 dispensings, including the prescriber's details and patient's details</li>
          <li><strong>Renewal</strong>: The RDL must be renewed annually (or biannually depending on state) and is subject to periodic inspection</li>
        </ul>

        <h2>What a Registered Pharmacist Actually Means</h2>
        <p>A Registered Pharmacist (RP) in India holds a B.Pharm or D.Pharm degree from a recognised institution and is registered with the State Pharmacy Council. They have studied pharmacology, drug interactions, dispensing practice, and pharmaceutical law. This education is what makes pharmacist review meaningful, not just a rubber stamp.</p>

        <h2>Unlicensed Sellers Are Common and Dangerous</h2>
        <p>Many online platforms operating in India sell medicines without proper licences, without pharmacist oversight, and without prescription verification. Buying from these platforms means no quality assurance, no legal recourse if something goes wrong, and a direct contribution to antibiotic resistance through inappropriate dispensing.</p>

        <p>SupraMeds holds all required licences and maintains full-time pharmacists. View our regulatory credentials and order medicines that are dispensed legally and safely at <strong>store.supracynpharma.com</strong>.</p>
      </div>
    ),
  },
  {
    slug: "suprameds-commitment-quality-pricing-delivery",
    title: "SupraMeds Commitment: Quality, Pricing, and Delivery Promises",
    description: "Our public commitments to customers on medicine quality, pricing transparency, and delivery standards - and how we hold ourselves accountable.",
    date: "2026-04-16",
    author: "Suprameds Editorial",
    readTime: "5 min read",
    category: "pharmacy",
    tags: ["quality promise", "pricing transparency", "delivery", "customer commitment"],
    content: () => (
      <div>
        <p>SupraMeds was founded with a single mission: make quality medicines accessible and affordable to every Indian household. Here is our explicit commitment to every customer, stated plainly and publicly.</p>

        <h2>Our Quality Commitments</h2>

        <h3>Only Licensed Manufacturers</h3>
        <p>We source all medicines exclusively from manufacturers holding valid WHO-GMP or Schedule M GMP certification. We do not source from grey markets, unlicensed traders, or parallel importers. Every product on our platform has a traceable supply chain from manufacturer to your door.</p>

        <h3>FEFO Dispatch</h3>
        <p>We dispatch using First Expiry First Out (FEFO) inventory management. This means you always receive the medicine with the longest remaining shelf life in our current stock. We commit to shipping no medicine with less than 6 months of remaining shelf life.</p>

        <h3>Pharmacist Review on Every Rx Order</h3>
        <p>Every prescription medicine order is reviewed by a licensed pharmacist before dispatch. No exceptions. If a prescription cannot be verified, the order is held until it can be.</p>

        <h3>No Schedule X Sales</h3>
        <p>We do not sell Schedule X (NDPS) drugs under any circumstance. This is non-negotiable under Indian law and our own policy.</p>

        <h2>Our Pricing Commitments</h2>

        <h3>Never Above MRP</h3>
        <p>We commit to never selling any medicine above its printed Maximum Retail Price (MRP). Selling above MRP is illegal under the Drugs Price Control Order and Indian consumer protection law. You will always pay MRP or less.</p>

        <h3>50-80% Off MRP on Our Generics</h3>
        <p>Our own-brand generics from Supracyn Pharma and Daxia Healthcare are priced at 50-80% off MRP. These are identical active ingredients to higher-priced branded equivalents, manufactured under the same GMP standards.</p>

        <h3>No Hidden Fees</h3>
        <p>The price you see includes GST. Our delivery charges, if applicable, are shown before you complete your order. Your invoice reflects exactly what you paid, with full tax breakdown.</p>

        <h2>Our Delivery Commitments</h2>
        <ul>
          <li>Orders are dispatched within 24 hours of pharmacist approval</li>
          <li>You receive an SMS and email with tracking details at dispatch</li>
          <li>We deliver across India with serviceable pincodes listed at checkout</li>
          <li>If a medicine ordered is unavailable, we notify you within 24 hours rather than silently delaying your order</li>
        </ul>

        <h2>Our Accountability</h2>
        <p>If we fall short of any of these commitments, contact us at support@supracynpharma.com. We respond within 24 hours and resolve within 72 hours. Customer complaints are reviewed by our management team weekly.</p>

        <p>Thank you for trusting SupraMeds with your health. Order today at <strong>store.supracynpharma.com</strong>.</p>
      </div>
    ),
  },
]
