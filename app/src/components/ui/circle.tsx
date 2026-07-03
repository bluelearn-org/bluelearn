import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const circleVariants = cva(
  "inline-flex items-center justify-center rounded-full font-medium",
  {
    variants: {
      color: {
        gray: "bg-gray-300",
      },
    },
    defaultVariants: {
      color: "gray",
    },
  }
)

// helper to get initials from the user
function getInitials(name: string) {
  const words = name.trim().split(" ")
  const firstLetter = words[0][0]
  const lastLetter = words.length > 1 ? words[words.length - 1][0] : ""
  return (firstLetter + lastLetter).toUpperCase()
}

function Circle({
  name,
  content,
  size = 36,
  color,
  className,
}: {
  name: string
  size?: number
  content?: string | number
  color?: "gray"
  className?: string
}) {
  const label = content ?? (name ? getInitials(name) : "")
  return (
    <span
      className={cn(circleVariants({ color }), className)}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {label}
    </span>
  )
}

export { Circle }
