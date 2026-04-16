import fs from 'fs'

const posts = JSON.parse(fs.readFileSync('/tmp/blog-posts-clean.json', 'utf8'))
const BACKEND = process.env.MEDUSA_BACKEND_URL || 'https://api.supracynpharma.com'

// Get token
const authRes = await fetch(`${BACKEND}/auth/user/emailpass`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: process.env.ADMIN_EMAIL || 'admin@suprameds.in',
    password: process.env.ADMIN_PASSWORD || 'Suprameds@2026!',
  }),
})
const { token } = await authRes.json()
if (!token) { console.error('Auth failed'); process.exit(1) }
console.log(`Authenticated. Importing ${posts.length} posts one by one...`)

let created = 0, skipped = 0, errors = 0

for (const p of posts) {
  try {
    const res = await fetch(`${BACKEND}/admin/blog`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        slug: p.slug,
        title: p.title,
        content: p.content,
        description: p.excerpt,
        category: p.category,
        tags: [],
        author: p.author,
        date: p.published_at.split('T')[0],
        read_time: '5 min read',
        status: 'published',
      }),
    })

    if (res.ok) {
      created++
      if (created % 10 === 0) console.log(`  ${created}/${posts.length}...`)
    } else {
      const err = await res.text()
      if (err.includes('duplicate') || err.includes('unique')) {
        skipped++
      } else {
        console.error(`  ERR ${p.slug}: ${res.status} ${err.slice(0, 100)}`)
        errors++
      }
    }
  } catch (e) {
    console.error(`  FETCH ERR ${p.slug}: ${e.message}`)
    errors++
  }
}

console.log(`\nDone! Created: ${created}, Skipped: ${skipped}, Errors: ${errors}`)
