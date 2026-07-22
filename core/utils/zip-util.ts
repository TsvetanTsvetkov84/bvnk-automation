import AdmZip from 'adm-zip'

export function readZip<T>(zip: AdmZip, matcher: (name: string) => boolean): T[] {
  const entry = zip.getEntries().find((e) => matcher(e.entryName))
  if (!entry) return []

  return entry
    .getData()
    .toString('utf-8')
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as T]
      } catch {
        return []
      }
    })
}
