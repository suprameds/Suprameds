import fs from 'fs'

const posts = JSON.parse(fs.readFileSync('/tmp/blog-posts-export.json', 'utf8'))

function esc(s) {
  return (s || '').replace(/'/g, "''")
}

const batches = []
for (let i = 0; i < posts.length; i += 2) {
  const batch = posts.slice(i, i + 2)
  const values = batch.map(p => {
    const date = p.published_at.split('T')[0]
    return `(gen_random_uuid()::text, '${esc(p.slug)}', '${esc(p.title)}', '${esc(p.content)}', '${esc(p.excerpt)}', '${esc(p.category)}', '[]'::jsonb, '${esc(p.author)}', '${date}', '5 min read', 'published', NOW(), NOW())`
  }).join(',\n')
  batches.push(`INSERT INTO blog_post (id, slug, title, content, description, category, tags, author, date, read_time, status, created_at, updated_at) VALUES\n${values};`)
}

fs.writeFileSync('/tmp/blog-sql-v2.json', JSON.stringify(batches))
console.log('Generated', batches.length, 'batches')
console.log('Max size:', Math.max(...batches.map(b => b.length)), 'chars')
