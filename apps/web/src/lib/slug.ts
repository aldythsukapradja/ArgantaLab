// Pretty, unique share slug: "Rooftop Ninja" + g_ab12cd3 -> "rooftop-ninja-2cd3"
export function makeSlug(title: string, id: string): string {
  const base = title.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'game'
  return `${base}-${id.slice(-4)}`
}
