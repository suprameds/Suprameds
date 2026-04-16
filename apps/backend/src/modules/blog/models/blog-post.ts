import { model } from "@medusajs/framework/utils"

const BlogPost = model.define("blog_post", {
  id: model.id().primaryKey(),
  slug: model.text().unique(),
  title: model.text(),
  content: model.text(),
  description: model.text(),
  category: model.text(),
  tags: model.json().default([] as any),
  author: model.text().default("Suprameds Pharmacy Team"),
  date: model.text(),
  read_time: model.text().default("5 min read"),
  status: model.enum(["draft", "published"]).default("published"),
  featured_image_url: model.text().nullable(),
  seo_title: model.text().nullable(),
  seo_description: model.text().nullable(),
})

export default BlogPost
