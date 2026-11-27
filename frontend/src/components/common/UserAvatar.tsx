import { useEffect, useState } from 'react'

interface UserAvatarProps {
  avatar?: string
  name?: string
  className?: string
}

function getInitials(avatar?: string, name?: string): string {
  const trimmedAvatar = avatar?.trim() ?? ''
  if (
    trimmedAvatar &&
    !/^https?:\/\//i.test(trimmedAvatar) &&
    !trimmedAvatar.startsWith('data:image/') &&
    !trimmedAvatar.startsWith('/') &&
    trimmedAvatar.length <= 4
  ) {
    return trimmedAvatar.toUpperCase()
  }

  const parts = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function UserAvatar({ avatar, name, className = '' }: UserAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false)
  const trimmed = avatar?.trim() ?? ''
  const isImageUrl =
    /^https?:\/\//i.test(trimmed) ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('/')

  useEffect(() => {
    setImgFailed(false)
  }, [trimmed])

  const initials = getInitials(trimmed, name)

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden ${className}`}
    >
      {isImageUrl && !imgFailed ? (
        <img
          src={trimmed}
          alt={name ? `${name} avatar` : 'User avatar'}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        initials
      )}
    </span>
  )
}
