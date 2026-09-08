import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** React Router keeps scroll position across route changes; reset it to the top. */
export function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) return // let in-page anchor links do their thing
    window.scrollTo(0, 0)
  }, [pathname, hash])

  return null
}
