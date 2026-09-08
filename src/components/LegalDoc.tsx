import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SiteHeader } from '@/components/SiteHeader'
import { Copyright } from '@/components/Copyright'
import { GITHUB_URL } from '@/lib/site'

export interface LegalSection {
  heading: string
  paragraphs: string[]
}

export function LegalDoc({
  title,
  updated,
  intro,
  sections,
  children,
}: {
  title: string
  updated: string
  intro?: ReactNode
  sections: LegalSection[]
  children?: ReactNode
}) {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-5 py-14">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>
        {intro && (
          <div className="mt-6 text-sm leading-relaxed text-muted-foreground">
            {intro}
          </div>
        )}

        <div className="mt-10 space-y-9">
          {sections.map((section, i) => (
            <section key={section.heading}>
              <h2 className="text-lg font-medium">
                {i + 1}. {section.heading}
              </h2>
              <div className="mt-2 space-y-3">
                {section.paragraphs.map((p) => (
                  <p
                    key={p}
                    className="text-sm leading-relaxed text-muted-foreground"
                  >
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
          {children}
        </div>

        <div className="mt-12 flex items-center justify-between border-t border-border pt-6 text-sm">
          <div className="flex flex-wrap gap-4 text-muted-foreground">
            <Link to="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link to="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link to="/security" className="hover:text-foreground">
              Security
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground"
            >
              GitHub
            </a>
          </div>
          <Copyright />
        </div>
      </main>
    </div>
  )
}
