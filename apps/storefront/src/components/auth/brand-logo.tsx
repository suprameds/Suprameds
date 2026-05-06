export function BrandLogo({
  size = 56,
  className = "",
  id: _id = "brand",
}: {
  size?: number
  className?: string
  id?: string
}) {
  return (
    <div className={className} style={{ width: size, height: size }}>
      <img
        src="/icons/favicon-mark.png"
        alt="Suprameds"
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
      />
    </div>
  )
}
