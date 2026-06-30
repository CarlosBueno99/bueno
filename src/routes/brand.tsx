import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from "react"
import { Navbar } from "../../components/Navbar"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Badge } from "../../components/ui/badge"
import { Alert, AlertTitle, AlertDescription } from "../../components/ui/alert"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs"

const colorGroups: { label: string; vars: { name: string; cssVar: string }[] }[] = [
  {
    label: "Surface",
    vars: [
      { name: "Background", cssVar: "--background" },
      { name: "Foreground", cssVar: "--foreground" },
      { name: "Card", cssVar: "--card" },
      { name: "Card Foreground", cssVar: "--card-foreground" },
      { name: "Popover", cssVar: "--popover" },
      { name: "Popover Foreground", cssVar: "--popover-foreground" },
    ],
  },
  {
    label: "Semantic",
    vars: [
      { name: "Primary", cssVar: "--primary" },
      { name: "Primary Foreground", cssVar: "--primary-foreground" },
      { name: "Secondary", cssVar: "--secondary" },
      { name: "Secondary Foreground", cssVar: "--secondary-foreground" },
      { name: "Muted", cssVar: "--muted" },
      { name: "Muted Foreground", cssVar: "--muted-foreground" },
      { name: "Accent", cssVar: "--accent" },
      { name: "Accent Foreground", cssVar: "--accent-foreground" },
      { name: "Destructive", cssVar: "--destructive" },
    ],
  },
  {
    label: "Borders & Ring",
    vars: [
      { name: "Border", cssVar: "--border" },
      { name: "Input", cssVar: "--input" },
      { name: "Ring", cssVar: "--ring" },
    ],
  },
  {
    label: "Chart",
    vars: [
      { name: "Chart 1", cssVar: "--chart-1" },
      { name: "Chart 2", cssVar: "--chart-2" },
      { name: "Chart 3", cssVar: "--chart-3" },
      { name: "Chart 4", cssVar: "--chart-4" },
      { name: "Chart 5", cssVar: "--chart-5" },
    ],
  },
  {
    label: "Sidebar",
    vars: [
      { name: "Sidebar", cssVar: "--sidebar" },
      { name: "Sidebar Foreground", cssVar: "--sidebar-foreground" },
      { name: "Sidebar Primary", cssVar: "--sidebar-primary" },
      { name: "Sidebar Primary Foreground", cssVar: "--sidebar-primary-foreground" },
      { name: "Sidebar Accent", cssVar: "--sidebar-accent" },
      { name: "Sidebar Accent Foreground", cssVar: "--sidebar-accent-foreground" },
      { name: "Sidebar Border", cssVar: "--sidebar-border" },
      { name: "Sidebar Ring", cssVar: "--sidebar-ring" },
    ],
  },
]

function ColorSwatch({ cssVar, name }: { cssVar: string; name: string }) {
  const [value, setValue] = useState("")
  useEffect(() => {
    function read() {
      setValue(getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim())
    }
    read()
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [cssVar])

  return (
    <div className="flex items-center gap-3 p-2 rounded-md border bg-card">
      <div
        className="size-10 shrink-0 rounded-md border"
        style={{ backgroundColor: `var(${cssVar})` }}
      />
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{name}</div>
        <div className="text-xs text-muted-foreground font-mono truncate">
          {value || `var(${cssVar})`}
        </div>
      </div>
    </div>
  )
}

function ColorPalette() {
  return (
    <div className="space-y-8">
      {colorGroups.map((group) => (
        <div key={group.label}>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {group.label}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {group.vars.map((v) => (
              <ColorSwatch key={v.cssVar} cssVar={v.cssVar} name={v.name} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const typographyTokens = [
  { name: "Font Sans", value: "Geist, system-ui, sans-serif", class: "font-sans" },
  { name: "Font Mono", value: "Geist Mono, monospace", class: "font-mono" },
]

const textSamples = [
  { name: "xs (0.75rem)", class: "text-xs" },
  { name: "sm (0.875rem)", class: "text-sm" },
  { name: "base (1rem)", class: "text-base" },
  { name: "lg (1.125rem)", class: "text-lg" },
  { name: "xl (1.25rem)", class: "text-xl" },
  { name: "2xl (1.5rem)", class: "text-2xl" },
  { name: "3xl (1.875rem)", class: "text-3xl font-bold" },
]

const radiusTokens = [
  { name: "Radius (base)", var: "--radius", class: "rounded-lg" },
  { name: "Radius SM", var: "--radius-sm", class: "rounded-sm" },
  { name: "Radius MD", var: "--radius-md", class: "rounded-md" },
  { name: "Radius XL", var: "--radius-xl", class: "rounded-xl" },
]

function TypographySection() {
  const [radiusValues, setRadiusValues] = useState<Record<string, string>>({})
  useEffect(() => {
    function read() {
      const values: Record<string, string> = {}
      for (const r of radiusTokens) {
        values[r.var] = getComputedStyle(document.documentElement).getPropertyValue(r.var).trim()
      }
      setRadiusValues(values)
    }
    read()
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Font Families
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {typographyTokens.map((t) => (
            <div key={t.name} className="p-4 rounded-md border bg-card">
              <div className="text-xs text-muted-foreground font-mono mb-1">{t.name}</div>
              <div className="text-lg" style={{ fontFamily: `var(${t.name === "Font Sans" ? "--font-geist-sans" : "--font-geist-mono"})` }}>
                {t.name === "Font Sans" ? "The quick brown fox jumps over the lazy dog." : "console.log('hello world')"}
              </div>
              <div className="text-xs text-muted-foreground font-mono mt-1">{t.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Text Scale
        </h3>
        <div className="space-y-2">
          {textSamples.map((s) => (
            <div key={s.name} className="flex items-baseline gap-4 p-2 rounded-md border bg-card">
              <span className="text-xs text-muted-foreground font-mono w-32 shrink-0">{s.name}</span>
              <span className={s.class}>The quick brown fox</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Border Radius
        </h3>
        <div className="grid sm:grid-cols-4 gap-3">
          {radiusTokens.map((r) => (
            <div key={r.var} className="p-4 rounded-md border bg-card text-center">
              <div className="mx-auto mb-2 size-12 border-2" style={{ borderRadius: `var(${r.var})` }} />
              <div className="text-sm font-medium">{r.name}</div>
              <div className="text-xs text-muted-foreground font-mono">
                {radiusValues[r.var] || `var(${r.var})`}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ComponentsPreview() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Button
        </h3>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-wrap gap-2">
              <Button variant="default">Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Badge
        </h3>
        <Card>
          <CardContent className="flex flex-wrap gap-2 pt-6">
            <Badge variant="default">Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="outline">Outline</Badge>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Card
        </h3>
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>Card Description provides additional context.</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Card content area. Use this space for primary content, forms, or data display.</p>
          </CardContent>
          <CardFooter className="border-t pt-6">
            <Button size="sm">Action</Button>
          </CardFooter>
        </Card>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Alert
        </h3>
        <div className="space-y-3">
          <Alert variant="default">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            <AlertTitle>Heads up!</AlertTitle>
            <AlertDescription>This is a default alert with an icon.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Something went wrong. Please try again.</AlertDescription>
          </Alert>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Tabs
        </h3>
        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue="tab1">
              <TabsList>
                <TabsTrigger value="tab1">Tab One</TabsTrigger>
                <TabsTrigger value="tab2">Tab Two</TabsTrigger>
                <TabsTrigger value="tab3">Tab Three</TabsTrigger>
              </TabsList>
              <TabsContent value="tab1" className="mt-4 text-sm text-muted-foreground">
                Content for the first tab.
              </TabsContent>
              <TabsContent value="tab2" className="mt-4 text-sm text-muted-foreground">
                Content for the second tab.
              </TabsContent>
              <TabsContent value="tab3" className="mt-4 text-sm text-muted-foreground">
                Content for the third tab.
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Brand() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow w-full max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Brand Guidelines</h1>
          <p className="text-muted-foreground mt-1">
            Design tokens, component primitives, and usage rules for the Bueno Dashboard
          </p>
        </div>

        <Tabs defaultValue="colors">
          <TabsList className="mb-6">
            <TabsTrigger value="colors">Colors</TabsTrigger>
            <TabsTrigger value="typography">Typography</TabsTrigger>
            <TabsTrigger value="components">Components</TabsTrigger>
            <TabsTrigger value="usage">Usage</TabsTrigger>
          </TabsList>

          <TabsContent value="colors">
            <ColorPalette />
          </TabsContent>

          <TabsContent value="typography">
            <TypographySection />
          </TabsContent>

          <TabsContent value="components">
            <ComponentsPreview />
          </TabsContent>

          <TabsContent value="usage">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Color Usage</CardTitle>
                  <CardDescription>How to apply the theme tokens</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium mb-1">Background & Surface</h4>
                      <p className="text-muted-foreground">Use <code className="text-xs bg-muted px-1 py-0.5 rounded">bg-background</code> for page backgrounds and <code className="text-xs bg-muted px-1 py-0.5 rounded">bg-card</code> for elevated surfaces.</p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-1">Text</h4>
                      <p className="text-muted-foreground">Use <code className="text-xs bg-muted px-1 py-0.5 rounded">text-foreground</code> for primary text, <code className="text-xs bg-muted px-1 py-0.5 rounded">text-muted-foreground</code> for secondary text.</p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-1">Interactive</h4>
                      <p className="text-muted-foreground">Use <code className="text-xs bg-muted px-1 py-0.5 rounded">bg-primary</code> for primary actions, <code className="text-xs bg-muted px-1 py-0.5 rounded">bg-secondary</code> for secondary, <code className="text-xs bg-muted px-1 py-0.5 rounded">bg-destructive</code> for destructive actions.</p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-1">Accents</h4>
                      <p className="text-muted-foreground">Use <code className="text-xs bg-muted px-1 py-0.5 rounded">bg-accent</code> for hover states and highlighted items. Use <code className="text-xs bg-muted px-1 py-0.5 rounded">text-accent-foreground</code> for text on accent backgrounds.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Component Conventions</CardTitle>
                  <CardDescription>Patterns to follow</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <ul className="space-y-2 list-disc pl-5 text-muted-foreground">
                    <li>Import <code className="text-xs bg-muted px-1 py-0.5 rounded">cn()</code> from <code className="text-xs bg-muted px-1 py-0.5 rounded">@/lib/utils</code> for class merging</li>
                    <li>Use <code className="text-xs bg-muted px-1 py-0.5 rounded">class-variance-authority</code> (CVA) for component variants</li>
                    <li>Reference theme variables via Tailwind utilities (e.g. <code className="text-xs bg-muted px-1 py-0.5 rounded">bg-card</code> not <code className="text-xs bg-muted px-1 py-0.5 rounded">bg-gray-100</code>)</li>
                    <li>Use <code className="text-xs bg-muted px-1 py-0.5 rounded">shadcn/ui</code> primitives for consistency; extend via <code className="text-xs bg-muted px-1 py-0.5 rounded">className</code></li>
                    <li>All new UI components go in <code className="text-xs bg-muted px-1 py-0.5 rounded">components/ui/</code></li>
                    <li>Page-level layout uses <code className="text-xs bg-muted px-1 py-0.5 rounded">min-h-screen flex flex-col</code> with <code className="text-xs bg-muted px-1 py-0.5 rounded">max-w-5xl mx-auto px-4 py-8</code> for the main area</li>
                    <li>Use <code className="text-xs bg-muted px-1 py-0.5 rounded">text-muted-foreground</code> for secondary/description text</li>
                    <li>Prefer <code className="text-xs bg-muted px-1 py-0.5 rounded">lucide-react</code> for icons</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tailwind v4 Theme</CardTitle>
                  <CardDescription>All tokens are defined in <code className="text-xs bg-muted px-1 py-0.5 rounded">src/globals.css</code></CardDescription>
                </CardHeader>
                <CardContent className="text-sm">
                  <p className="text-muted-foreground mb-3">
                    This project uses Tailwind CSS v4 with <code className="text-xs bg-muted px-1 py-0.5 rounded">@theme inline</code> for design tokens. Colors use the <code className="text-xs bg-muted px-1 py-0.5 rounded">oklch()</code> color space. The base color is <strong>Neutral</strong> (shadcn new-york style). Light and dark themes are controlled via the <code className="text-xs bg-muted px-1 py-0.5 rounded">.dark</code> class on <code className="text-xs bg-muted px-1 py-0.5 rounded">&lt;html&gt;</code>.
                  </p>
                  <p className="text-muted-foreground">
                    Fonts: <strong>Geist</strong> (sans, 100-900) and <strong>Geist Mono</strong> (mono, 100-900), loaded from Google Fonts in <code className="text-xs bg-muted px-1 py-0.5 rounded">index.html</code>.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

export const Route = createFileRoute('/brand')({
  component: Brand,
})
