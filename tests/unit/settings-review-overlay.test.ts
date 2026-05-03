import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('settings review overlay layering', () => {
  it('keeps the review sheet above the bottom nav', () => {
    const review = readFileSync(resolve(process.cwd(), 'app/components/settings/SettingSaveReview.vue'), 'utf8')
    const bottomNav = readFileSync(resolve(process.cwd(), 'app/components/app/BottomNav.vue'), 'utf8')

    expect(review).toContain('z-[60]')
    expect(bottomNav).toContain('z-50')
  })
})
