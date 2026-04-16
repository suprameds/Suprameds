import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Select,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { ArrowLeftMini } from "@medusajs/icons"
import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { sdk } from "../../../lib/client"

// ── Types ───────────────────────────────────────────────────────────────

type BlogPost = {
  id: string
  title: string
  slug: string
  category: string
  status: "draft" | "published"
  author: string
  date: string
  read_time: string
  description: string
  tags: string[]
  featured_image: string | null
  content: string
}

type BlogPostResponse = {
  post: BlogPost
}

// ── Helpers ─────────────────────────────────────────────────────────────

const slugify = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")

const todayISO = () => new Date().toISOString().split("T")[0]

const CATEGORIES = [
  { value: "guides", label: "Guides" },
  { value: "health", label: "Health" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "savings", label: "Savings" },
]

const STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
]

// ── Component ───────────────────────────────────────────────────────────

const BlogPostPage = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isNew = id === "new"

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // Form state
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [category, setCategory] = useState("guides")
  const [status, setStatus] = useState<"draft" | "published">("draft")
  const [author, setAuthor] = useState("Suprameds Pharmacy Team")
  const [date, setDate] = useState(todayISO())
  const [readTime, setReadTime] = useState("5 min read")
  const [description, setDescription] = useState("")
  const [tagsStr, setTagsStr] = useState("")
  const [featuredImage, setFeaturedImage] = useState("")
  const [content, setContent] = useState("")

  // Load existing post
  useEffect(() => {
    if (isNew) return
    const loadPost = async () => {
      setLoading(true)
      try {
        const json = await sdk.client.fetch<BlogPostResponse>(
          `/admin/blog/${id}`
        )
        const p = json.post
        setTitle(p.title)
        setSlug(p.slug)
        setSlugTouched(true)
        setCategory(p.category)
        setStatus(p.status)
        setAuthor(p.author)
        setDate(p.date)
        setReadTime(p.read_time)
        setDescription(p.description || "")
        setTagsStr(Array.isArray(p.tags) ? p.tags.join(", ") : "")
        setFeaturedImage(p.featured_image || "")
        setContent(p.content || "")
      } catch (err) {
        console.error("[blog-admin] Failed to load post:", err)
        toast.error("Failed to load blog post")
      } finally {
        setLoading(false)
      }
    }
    loadPost()
  }, [id, isNew])

  const handleTitleBlur = () => {
    if (!slugTouched && title) {
      setSlug(slugify(title))
    }
  }

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Title is required")
      return
    }
    if (!slug.trim()) {
      toast.error("Slug is required")
      return
    }

    setSaving(true)
    const body = {
      title: title.trim(),
      slug: slug.trim(),
      category,
      status,
      author: author.trim(),
      date,
      read_time: readTime.trim(),
      description: description.trim(),
      tags: tagsStr
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      featured_image: featuredImage.trim() || null,
      content,
    }

    try {
      const url = isNew ? "/admin/blog" : `/admin/blog/${id}`
      await sdk.client.fetch(url, { method: "POST", body })
      toast.success(isNew ? "Post created" : "Post updated")
      navigate("/blog")
    } catch (err) {
      console.error("[blog-admin] Save failed:", err)
      toast.error("Failed to save post")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Container>
        <Heading level="h1" className="mb-4">
          {isNew ? "New Post" : "Edit Post"}
        </Heading>
        <Text className="text-ui-fg-subtle">Loading...</Text>
      </Container>
    )
  }

  return (
    <Container>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="small"
            onClick={() => navigate("/blog")}
          >
            <ArrowLeftMini />
            Back
          </Button>
          <Heading level="h1">{isNew ? "New Post" : "Edit Post"}</Heading>
        </div>
        <Button size="small" onClick={handleSave} isLoading={saving}>
          {isNew ? "Create Post" : "Save Changes"}
        </Button>
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* Row 1: Title + Slug */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Post title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
            />
          </div>
          <div>
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              placeholder="url-friendly-slug"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value)
                setSlugTouched(true)
              }}
            />
          </div>
        </div>

        {/* Row 2: Category + Status */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <Select.Trigger>
                <Select.Value placeholder="Select category" />
              </Select.Trigger>
              <Select.Content>
                {CATEGORIES.map((c) => (
                  <Select.Item key={c.value} value={c.value}>
                    {c.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as "draft" | "published")}>
              <Select.Trigger>
                <Select.Value placeholder="Select status" />
              </Select.Trigger>
              <Select.Content>
                {STATUSES.map((s) => (
                  <Select.Item key={s.value} value={s.value}>
                    {s.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
        </div>

        {/* Row 3: Author + Date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="author">Author</Label>
            <Input
              id="author"
              placeholder="Author name"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        {/* Row 4: Read Time + Tags */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="readTime">Read Time</Label>
            <Input
              id="readTime"
              placeholder="5 min read"
              value={readTime}
              onChange={(e) => setReadTime(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              placeholder="generic, medicines, savings"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="description">Description (SEO)</Label>
          <Textarea
            id="description"
            placeholder="Short description for search engines..."
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Featured Image */}
        <div>
          <Label htmlFor="featuredImage">Featured Image URL</Label>
          <Input
            id="featuredImage"
            placeholder="https://..."
            value={featuredImage}
            onChange={(e) => setFeaturedImage(e.target.value)}
          />
        </div>

        {/* Content */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <Label htmlFor="content">Content (HTML)</Label>
            <Button
              variant="secondary"
              size="small"
              onClick={() => setShowPreview((p) => !p)}
            >
              {showPreview ? "Edit" : "Preview"}
            </Button>
          </div>
          {showPreview ? (
            <div
              className="prose max-w-none rounded-lg border border-ui-border-base bg-ui-bg-base p-6"
              style={{ lineHeight: 1.8 }}
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ) : (
            <Textarea
              id="content"
              placeholder="<h2>Your blog post content...</h2>"
              rows={24}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          )}
        </div>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Blog Post",
})

export default BlogPostPage
