import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Badge,
  Button,
  Container,
  Heading,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import { ArrowPath, PlusMini, PencilSquare, Trash } from "@medusajs/icons"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { sdk } from "../../lib/client"

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
  created_at: string
  updated_at: string
}

type BlogListResponse = {
  posts: BlogPost[]
  count: number
}

// ── Helpers ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

const statusColor = (s: string): "green" | "orange" => {
  return s === "published" ? "green" : "orange"
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const formatDate = (d: string) => {
  try {
    return new Date(d).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  } catch {
    return d
  }
}

const StatCard = ({
  label,
  value,
}: {
  label: string
  value: string | number
}) => (
  <div className="rounded-lg border border-ui-border-base bg-ui-bg-base p-4">
    <Text className="text-xs uppercase tracking-wide text-ui-fg-subtle">
      {label}
    </Text>
    <Text className="mt-1 text-2xl font-semibold">{value}</Text>
  </div>
)

// ── Component ───────────────────────────────────────────────────────────

const BlogListPage = () => {
  const navigate = useNavigate()
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<"all" | "published" | "draft">("all")
  const [page, setPage] = useState(0)

  const fetchPosts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (tab !== "all") params.set("status", tab)
      params.set("limit", String(PAGE_SIZE))
      params.set("offset", String(page * PAGE_SIZE))
      const qs = params.toString()
      const json = await sdk.client.fetch<BlogListResponse>(
        `/admin/blog${qs ? `?${qs}` : ""}`
      )
      setPosts(json.posts)
      setCount(json.count)
    } catch (err) {
      console.error("[blog-admin] Failed to load:", err)
      toast.error("Failed to load blog posts")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPage(0)
  }, [tab])

  useEffect(() => {
    fetchPosts()
  }, [tab, page])

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return
    try {
      await sdk.client.fetch(`/admin/blog/${id}`, { method: "DELETE" })
      toast.success("Post deleted")
      fetchPosts()
    } catch (err) {
      console.error("[blog-admin] Delete failed:", err)
      toast.error("Failed to delete post")
    }
  }

  // Stats
  const totalPosts = count
  const publishedCount = posts.filter((p) => p.status === "published").length
  const draftCount = posts.filter((p) => p.status === "draft").length

  const totalPages = Math.ceil(count / PAGE_SIZE)
  const canPrev = page > 0
  const canNext = page < totalPages - 1

  return (
    <Container>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <Heading level="h1">Blog Posts</Heading>
        <div className="flex gap-2">
          <Button variant="secondary" size="small" onClick={fetchPosts}>
            <ArrowPath />
            Refresh
          </Button>
          <Button size="small" onClick={() => navigate("/blog/new")}>
            <PlusMini />
            New Post
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <StatCard label="Total Posts" value={totalPosts} />
        <StatCard label="Published" value={publishedCount} />
        <StatCard label="Drafts" value={draftCount} />
      </div>

      {/* Filter Tabs */}
      <div className="mb-4 flex gap-2">
        {(["all", "published", "draft"] as const).map((t) => (
          <Button
            key={t}
            variant={tab === t ? "primary" : "secondary"}
            size="small"
            onClick={() => setTab(t)}
          >
            {cap(t)}
          </Button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <Text className="text-ui-fg-subtle">Loading blog posts...</Text>
      ) : posts.length === 0 ? (
        <div className="rounded-lg border border-ui-border-base bg-ui-bg-base p-8 text-center">
          <Text className="text-ui-fg-subtle">
            No blog posts found. Create your first post!
          </Text>
        </div>
      ) : (
        <>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Title</Table.HeaderCell>
                <Table.HeaderCell>Category</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Date</Table.HeaderCell>
                <Table.HeaderCell className="text-right">
                  Actions
                </Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {posts.map((post) => (
                <Table.Row key={post.id}>
                  <Table.Cell>
                    <Text className="font-medium">{post.title}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color="blue">{cap(post.category)}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color={statusColor(post.status)}>
                      {cap(post.status)}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-ui-fg-subtle">
                      {formatDate(post.date)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => navigate(`/blog/${post.id}`)}
                      >
                        <PencilSquare />
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="small"
                        onClick={() => handleDelete(post.id, post.title)}
                      >
                        <Trash />
                        Delete
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <Text className="text-sm text-ui-fg-subtle">
                Page {page + 1} of {totalPages} ({count} total)
              </Text>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="small"
                  disabled={!canPrev}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  disabled={!canNext}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Blog",
})

export default BlogListPage
