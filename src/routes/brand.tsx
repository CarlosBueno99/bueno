import { createFileRoute } from "@tanstack/react-router"
import type { ComponentType, ReactNode } from "react"
import { useEffect, useState } from "react"
import {
  BadgeCheck,
  Download,
  ImageIcon,
  LayoutDashboard,
  Palette,
  Shapes,
  Sparkles,
  Type,
} from "lucide-react"
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

const logoExamples = [
  {
    name: "Primary Lockup",
    description: "Use for navigation, headers, and places where the full name has room to breathe.",
    tone: "Light surface",
    className: "bg-background",
  },
  {
    name: "Dark Lockup",
    description: "Use on editorial cards, overlays, or dark marketing panels.",
    tone: "Inverted",
    className: "bg-foreground text-background",
  },
  {
    name: "Mark Only",
    description: "Use where space is tight, like favicons, avatars, badges, and mobile affordances.",
    tone: "Compact",
    className: "bg-primary text-primary-foreground",
  },
]

const voiceGuidelines = [
  "Useful before clever. Product copy should help people move faster.",
  "Plain-spoken and calm. Prefer short sentences with concrete nouns.",
  "Opinionated when it helps. Surface a recommended action when the path is clear.",
]

const layoutExamples = [
  { label: "Dashboard", icon: LayoutDashboard, text: "Dense data, calm hierarchy, direct actions." },
  { label: "Media", icon: ImageIcon, text: "Rounded image crops with restrained borders." },
  { label: "Status", icon: BadgeCheck, text: "Badges clarify state without stealing focus." },
]

function BrandMark({ className = "" }: { className?: string }) {
  return (
    <div className={`grid size-12 place-items-center overflow-hidden rounded-2xl bg-background shadow-sm ring-1 ring-border ${className}`}>
      <img
        src="/favicon.png"
        alt="Carlos Bueno logo"
        className="size-full object-cover"
      />
    </div>
  )
}

function LogoLockup({ inverted = false, compact = false }: { inverted?: boolean; compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <BrandMark className={compact ? "size-14 rounded-3xl" : ""} />
      {!compact && (
        <div>
          <div className={`text-xl font-bold tracking-tight ${inverted ? "text-background" : "text-foreground"}`}>
            Carlos Bueno
          </div>
          <div className={`text-xs font-medium uppercase tracking-[0.32em] ${inverted ? "text-background/60" : "text-muted-foreground"}`}>
            Dashboard
          </div>
        </div>
      )}
    </div>
  )
}

function SectionLabel({ icon: Icon, children }: { icon: ComponentType<{ className?: string }>; children: ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
      <Icon className="size-4" />
      {children}
    </div>
  )
}

function CopyBlock({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
      {children}
    </code>
  )
}

function LogoShowcase() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {logoExamples.map((example) => (
          <Card key={example.name} className="overflow-hidden p-0">
            <div className={`grid min-h-48 place-items-center border-b p-8 ${example.className}`}>
              {example.name === "Mark Only" ? (
                <LogoLockup compact />
              ) : (
                <LogoLockup inverted={example.name === "Dark Lockup"} />
              )}
            </div>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>{example.name}</CardTitle>
                <Badge variant="outline">{example.tone}</Badge>
              </div>
              <CardDescription>{example.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Logo In Use</CardTitle>
            <CardDescription>Examples for product surfaces, cards, and compact placements.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border bg-muted/40 p-4">
              <div className="flex items-center justify-between rounded-xl border bg-card p-3 shadow-sm">
                <LogoLockup />
                <Button size="sm">Open App</Button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {layoutExamples.map((item) => (
                  <div key={item.label} className="rounded-xl border bg-card p-4">
                    <item.icon className="mb-3 size-5 text-muted-foreground" />
                    <div className="font-medium">{item.label}</div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clearspace</CardTitle>
            <CardDescription>Give the mark enough room to stay crisp in dense UI.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-dashed p-6">
              <div className="grid place-items-center rounded-xl border border-dashed p-8">
                <BrandMark className="size-20 rounded-[2rem]" />
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Keep at least half the mark width as clearspace on every side. Avoid placing it over busy photos or low contrast gradients.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

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
      <Card className="overflow-hidden p-0">
        <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="border-b bg-muted/40 p-6 lg:border-b-0 lg:border-r">
            <SectionLabel icon={Shapes}>Components</SectionLabel>
            <h3 className="text-2xl font-semibold tracking-tight">Keep the interface composed and tactile.</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Controls should feel precise, slightly rounded, and quiet until they need attention. Use the strongest contrast for decisions and lighter treatments for navigation.
            </p>
          </div>
          <div className="space-y-6 p-6">
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Button
              </h3>
              <div className="space-y-4">
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
                    <Download className="size-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Badge
              </h3>
              <div className="flex flex-wrap gap-2">
                <Badge variant="default">Live</Badge>
                <Badge variant="secondary">Draft</Badge>
                <Badge variant="destructive">Action needed</Badge>
                <Badge variant="outline">Read only</Badge>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Campaign Health</CardTitle>
            <CardDescription>Example card for dashboard summaries.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold tracking-tight">94%</div>
            <p className="mt-2 text-sm text-muted-foreground">Most systems are healthy. Two items need review before launch.</p>
          </CardContent>
          <CardFooter className="border-t">
            <Button size="sm">Review</Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alert Pattern</CardTitle>
            <CardDescription>Use icons and short descriptions for system feedback.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Alert variant="default">
              <Sparkles className="size-4" />
              <AlertTitle>Ready to publish</AlertTitle>
              <AlertDescription>The visual system passes contrast and spacing checks.</AlertDescription>
            </Alert>
            <Alert variant="destructive">
              <BadgeCheck className="size-4" />
              <AlertTitle>Needs attention</AlertTitle>
              <AlertDescription>Use destructive styling only for irreversible or blocking states.</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
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
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="relative flex-grow overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(circle_at_20%_10%,var(--accent),transparent_28%),radial-gradient(circle_at_80%_0%,var(--muted),transparent_26%)]" />
        <div className="w-full max-w-6xl mx-auto px-4 py-10 md:py-14">
          <section className="mb-10 overflow-hidden rounded-[2rem] border bg-card shadow-sm">
            <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="p-6 md:p-10">
                <Badge className="mb-5" variant="outline">
                  <Sparkles className="size-3" />
                  Brand system
                </Badge>
                <h1 className="max-w-3xl text-4xl font-black tracking-tight md:text-6xl">
                  Style guide for myself and I.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                  Logos, color tokens, typography, component examples, and usage rules in one polished route. Built to feel calm, confident, and useful.
                </p>
              </div>
              <div className="relative min-h-80 border-t bg-foreground p-6 text-background lg:border-l lg:border-t-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,hsl(0_0%_100%/.24),transparent_28%),linear-gradient(135deg,hsl(0_0%_100%/.12),transparent_42%)]" />
                <div className="relative flex h-full flex-col justify-between rounded-[1.5rem] border border-background/15 bg-background/10 p-6 backdrop-blur">
                  <LogoLockup inverted />
                  <div>
                    <div className="mb-3 grid grid-cols-5 gap-2">
                      {["--primary", "--secondary", "--accent", "--chart-1", "--chart-2"].map((token) => (
                        <div key={token} className="h-16 rounded-xl border border-background/15" style={{ backgroundColor: `var(${token})` }} />
                      ))}
                    </div>
                    <p className="text-sm leading-6 text-background/70">
                      A compact identity system that scales from a browser favicon to product dashboards and internal tools.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <Tabs defaultValue="logos">
            <TabsList className="mb-6 flex h-auto w-full flex-wrap justify-start gap-1 rounded-2xl p-1 md:w-fit">
              <TabsTrigger value="logos">Logos</TabsTrigger>
              <TabsTrigger value="colors">Colors</TabsTrigger>
              <TabsTrigger value="typography">Typography</TabsTrigger>
              <TabsTrigger value="components">Components</TabsTrigger>
              <TabsTrigger value="usage">Usage</TabsTrigger>
            </TabsList>

            <TabsContent value="logos">
              <LogoShowcase />
            </TabsContent>

            <TabsContent value="colors">
              <Card className="mb-6 overflow-hidden">
                <CardHeader>
                  <SectionLabel icon={Palette}>Color</SectionLabel>
                  <CardTitle className="text-3xl tracking-tight">Neutral first, accent with intention.</CardTitle>
                  <CardDescription>
                    The palette keeps everyday UI quiet while reserving stronger colors for status, charts, and decision points.
                  </CardDescription>
                </CardHeader>
              </Card>
              <ColorPalette />
            </TabsContent>

            <TabsContent value="typography">
              <Card className="mb-6">
                <CardHeader>
                  <SectionLabel icon={Type}>Typography</SectionLabel>
                  <CardTitle className="text-3xl tracking-tight">Geist gives the product a crisp, technical voice.</CardTitle>
                  <CardDescription>
                    Use weight and spacing before adding decoration. Let headings carry personality and body text stay direct.
                  </CardDescription>
                </CardHeader>
              </Card>
              <TypographySection />
            </TabsContent>

            <TabsContent value="components">
              <ComponentsPreview />
            </TabsContent>

            <TabsContent value="usage">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Voice & Tone</CardTitle>
                    <CardDescription>How the product should sound across interfaces.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 md:grid-cols-3">
                      {voiceGuidelines.map((guideline) => (
                        <div key={guideline} className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                          {guideline}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Color Usage</CardTitle>
                  <CardDescription>How to apply the theme tokens</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium mb-1">Background & Surface</h4>
                      <p className="text-muted-foreground">Use <CopyBlock>bg-background</CopyBlock> for page backgrounds and <CopyBlock>bg-card</CopyBlock> for elevated surfaces.</p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-1">Text</h4>
                      <p className="text-muted-foreground">Use <CopyBlock>text-foreground</CopyBlock> for primary text, <CopyBlock>text-muted-foreground</CopyBlock> for secondary text.</p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-1">Interactive</h4>
                      <p className="text-muted-foreground">Use <CopyBlock>bg-primary</CopyBlock> for primary actions, <CopyBlock>bg-secondary</CopyBlock> for secondary, <CopyBlock>bg-destructive</CopyBlock> for destructive actions.</p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-1">Accents</h4>
                      <p className="text-muted-foreground">Use <CopyBlock>bg-accent</CopyBlock> for hover states and highlighted items. Use <CopyBlock>text-accent-foreground</CopyBlock> for text on accent backgrounds.</p>
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
                    <li>Import <CopyBlock>cn()</CopyBlock> from <CopyBlock>@/lib/utils</CopyBlock> for class merging</li>
                    <li>Use <CopyBlock>class-variance-authority</CopyBlock> (CVA) for component variants</li>
                    <li>Reference theme variables via Tailwind utilities, like <CopyBlock>bg-card</CopyBlock>, instead of raw gray scales</li>
                    <li>Use <CopyBlock>shadcn/ui</CopyBlock> primitives for consistency; extend via <CopyBlock>className</CopyBlock></li>
                    <li>All new UI components go in <CopyBlock>components/ui/</CopyBlock></li>
                    <li>Use <CopyBlock>text-muted-foreground</CopyBlock> for secondary and descriptive text</li>
                    <li>Prefer <CopyBlock>lucide-react</CopyBlock> for icons</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tailwind v4 Theme</CardTitle>
                  <CardDescription>All tokens are defined in <CopyBlock>src/globals.css</CopyBlock></CardDescription>
                </CardHeader>
                <CardContent className="text-sm">
                  <p className="text-muted-foreground mb-3">
                    This project uses Tailwind CSS v4 with <CopyBlock>@theme inline</CopyBlock> for design tokens. Colors use the <CopyBlock>oklch()</CopyBlock> color space. The base color is <strong>Neutral</strong> (shadcn new-york style). Light and dark themes are controlled via the <CopyBlock>.dark</CopyBlock> class on <CopyBlock>&lt;html&gt;</CopyBlock>.
                  </p>
                  <p className="text-muted-foreground">
                    Fonts: <strong>Geist</strong> (sans, 100-900) and <strong>Geist Mono</strong> (mono, 100-900), loaded from Google Fonts in <CopyBlock>index.html</CopyBlock>.
                  </p>
                </CardContent>
              </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}

export const Route = createFileRoute('/brand')({
  component: Brand,
})
