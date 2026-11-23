import { createElement } from 'react'

type HeadingTag = 'h1' | 'h2' | 'h3' | 'p' | 'span'

export function LineReveal({
  lines,
  as = 'h2',
  className = '',
  lineClassName = '',
}: {
  lines: string[]
  as?: HeadingTag
  className?: string
  lineClassName?: string
  delay?: number
  immediate?: boolean
}) {
  return createElement(
    as,
    { className, 'aria-label': lines.join(' ') },
    lines.map((line, index) => (
      <span key={`${line}-${index}`} className={`block ${lineClassName}`} aria-hidden="true">
        {line}
      </span>
    )),
  )
}
