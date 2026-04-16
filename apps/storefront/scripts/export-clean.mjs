import fs from 'fs'

// Read the already-exported posts
const posts = JSON.parse(fs.readFileSync('/tmp/blog-posts-export.json', 'utf8'))

// Strip data-med-* and data-component-* and data-content attributes from HTML
const cleaned = posts.map(p => ({
  ...p,
  content: p.content
    .replace(/ data-med-[a-z-]+="[^"]*"/g, '')
    .replace(/ data-component-[a-z-]+="[^"]*"/g, '')
    .replace(/ data-content="[^"]*"/g, '')
    .replace(/<div>/, '')       // strip outer div wrapper
    .replace(/<\/div>$/, '')    // strip closing div
}))

fs.writeFileSync('/tmp/blog-posts-clean.json', JSON.stringify(cleaned))
console.log(`Cleaned ${cleaned.length} posts`)
console.log(`Sample content (first 200 chars):`, cleaned[0].content.slice(0, 200))
