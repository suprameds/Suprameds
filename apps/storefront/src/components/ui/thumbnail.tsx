import { clsx } from "clsx"

type ThumbnailProps = {
  thumbnail?: string | null;
  alt: string;
  className?: string;
};

export const Thumbnail = ({ thumbnail, alt, className }: ThumbnailProps) => {
  return (
    <>
      {thumbnail ? (
        <img
          src={thumbnail}
          alt={alt}
          className={clsx("w-20 h-20 object-cover bg-[var(--bg-tertiary)]", className)}
        />
      ) : (
        <div
          className={clsx(
            "w-20 h-20 bg-[var(--bg-tertiary)] flex items-center justify-center",
            className
          )}
        >
          <span className="text-xs text-[var(--text-secondary)]">No image</span>
        </div>
      )}
    </>
  )
}
