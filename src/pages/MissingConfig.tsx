export function MissingConfig() {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-6 text-center">
      <div className="max-w-md">
        <h1 className="text-xl font-semibold text-foreground">
          Encryptext isn’t configured yet
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Create a file called <code>.env.local</code> in the project root with
          your Supabase project’s URL and anon key, then restart{' '}
          <code>npm run dev</code>.
        </p>
        <pre className="mt-4 rounded-lg border border-border bg-surface p-4 text-left text-xs text-foreground">
          {`VITE_SUPABASE_URL=https://YOUR-REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key`}
        </pre>
        <p className="mt-3 text-xs text-muted-foreground">
          Find both under Supabase → Project Settings → API.
        </p>
      </div>
    </div>
  )
}
