import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PIN_LOCKOUT_MS,
  PIN_MAX_ATTEMPTS,
  changePin,
  disable,
  enable,
  getAttemptsRemaining,
  isLockedOut,
  lock,
  resetPinLock,
  unlock,
} from '../../app/composables/usePinLock'

describe('usePinLock', () => {
  afterEach(() => {
    vi.useRealTimers()
    resetPinLock()
    sessionStorage.clear()
    localStorage.clear()
  })

  it('encrypts legacy plaintext session tokens when enabling the pin lock', async () => {
    sessionStorage.setItem('or3-app:v1:secure-host-tokens', JSON.stringify({
      'host-1': {
        pairedToken: 'paired-token',
        sessionToken: 'session-token',
        origin: 'http://127.0.0.1:9100',
      },
    }))

    await expect(enable('1234')).resolves.toMatchObject({ success: true })

    const encrypted = localStorage.getItem('or3-app:v1:secure-host-tokens')
    expect(encrypted).toContain('"iv"')
    expect(encrypted).not.toContain('paired-token')
    expect(sessionStorage.getItem('or3-app:v1:secure-host-tokens')).toBeNull()

    lock()
    await expect(unlock('1234')).resolves.toMatchObject({ success: true })
  })

  it('requires the entered current pin to change or disable the pin lock', async () => {
    await expect(enable('1234')).resolves.toMatchObject({ success: true })

    await expect(changePin('0000', '5678')).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining('Current PIN is incorrect.'),
    })
    await expect(disable('0000')).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining('Incorrect PIN.'),
    })
    await expect(disable('1234')).resolves.toMatchObject({ success: true })
  })

  it('restores attempts after the lockout window expires', async () => {
    vi.useFakeTimers()
    await expect(enable('1234')).resolves.toMatchObject({ success: true })

    lock()

    for (let attempt = 0; attempt < PIN_MAX_ATTEMPTS; attempt += 1) {
      await unlock('0000')
    }

    expect(isLockedOut()).toBe(true)
    vi.advanceTimersByTime(PIN_LOCKOUT_MS + 1)
    expect(isLockedOut()).toBe(false)
    expect(getAttemptsRemaining()).toBe(PIN_MAX_ATTEMPTS)
  })

  it('persists failed attempts across reloads before lockout kicks in', async () => {
    await expect(enable('1234')).resolves.toMatchObject({ success: true })

    lock()
    await unlock('0000')
    await unlock('0000')

    expect(localStorage.getItem('or3-app:v1:pin-lockout')).toContain('"failedAttempts":2')

    vi.resetModules()
    const freshPinLock = await import('../../app/composables/usePinLock')

    expect(freshPinLock.getAttemptsRemaining()).toBe(PIN_MAX_ATTEMPTS - 2)
  })
})
