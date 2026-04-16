import fs from 'fs'

const posts = JSON.parse(fs.readFileSync('/tmp/blog-posts-export.json', 'utf8'))

function esc(s) {
  return (s || '').replace(/'/g, "''")
}

const sqls = posts.map(p => {
  const date = p.published_at.split('T')[0]
  return `INSERT INTO blog_post (id, slug, title, content, description, category, tags, author, date, read_time, status, created_at, updated_at) VALUES (gen_random_uuid()::text, '${esc(p.slug)}', '${esc(p.title)}', '${esc(p.content)}', '${esc(p.excerpt)}', '${esc(p.category)}', '[]'::jsonb, '${esc(p.author)}', '${date}', '5 min read', 'published', NOW(), NOW()) ON CONFLICT (slug) DO NOTHING;`
})

fs.writeFileSync('/tmp/blog-single-sqls.json', JSON.stringify(sqls))
console.log('Generated', sqls.length, 'individual inserts')
console.log('Sizes:', sqls.map(s => s.length).sort((a,b) => b-a).slice(0,5).join(', '), '(top 5)')
console.log('Smallest:', Math.min(...sqls.map(s => s.length)))
