<template>
  <AppShell>
    <AppHeader subtitle="CREATE" />

    <div class="space-y-6">
      <!-- Featured: New Agent Task -->
      <SurfaceCard class-name="or3-add-hero">
        <div class="or3-add-hero__inner">
          <div class="or3-add-hero__copy">
            <span class="or3-add-hero__pill">
              <span class="or3-add-hero__pill-dot" aria-hidden="true" />
              Featured
            </span>
            <h2 class="or3-add-hero__title">New Agent Task</h2>
            <p class="or3-add-hero__sub">
              Hand work off to an agent with files, tools, and approvals.
            </p>
            <div class="or3-add-hero__actions">
              <UButton
                color="primary"
                variant="solid"
                size="lg"
                type="button"
                class="or3-add-hero__cta"
                :ui="{ base: 'bg-[var(--or3-green)] text-white border hover:bg-[color:color-mix(in_srgb,var(--or3-green)_88%,black_12%)] active:bg-[color:color-mix(in_srgb,var(--or3-green)_82%,black_18%)] focus-visible:outline-[var(--or3-green)] px-5 py-3 text-base font-semibold gap-2.5 rounded-2xl' }"
                @click="goTo('/agents')"
              >
                <span>Create task</span>
                <Icon name="i-pixelarticons-arrow-right" class="size-5" />
              </UButton>
            </div>
          </div>

          <div class="or3-add-hero__mascot-shell">
            <div class="or3-add-hero__mascot-glow" aria-hidden="true" />
            <div class="or3-add-hero__mascot-glow or3-add-hero__mascot-glow--inner" aria-hidden="true" />
            <svg
              class="or3-add-hero__sparkles"
              viewBox="0 0 220 220"
              fill="none"
              aria-hidden="true"
            >
              <!-- Big plus stars -->
              <path class="or3-add-hero__sparkle or3-add-hero__sparkle--lg" d="M22 60h12m-6-6v12" />
              <path class="or3-add-hero__sparkle or3-add-hero__sparkle--lg or3-add-hero__sparkle--green" d="M188 30h14m-7-7v14" />
              <path class="or3-add-hero__sparkle or3-add-hero__sparkle--lg" d="M200 130h12m-6-6v12" />
              <path class="or3-add-hero__sparkle or3-add-hero__sparkle--lg or3-add-hero__sparkle--green" d="M44 178h12m-6-6v12" />
              <!-- Medium plus stars -->
              <path class="or3-add-hero__sparkle or3-add-hero__sparkle--green" d="M82 22h10m-5-5v10" />
              <path class="or3-add-hero__sparkle" d="M186 184h10m-5-5v10" />
              <path class="or3-add-hero__sparkle or3-add-hero__sparkle--soft" d="M14 132h8m-4-4v8" />
              <path class="or3-add-hero__sparkle or3-add-hero__sparkle--soft" d="M120 12h8m-4-4v8" />
              <!-- Small plus stars -->
              <path class="or3-add-hero__sparkle or3-add-hero__sparkle--soft" d="M64 110h6m-3-3v6" />
              <path class="or3-add-hero__sparkle or3-add-hero__sparkle--soft" d="M170 158h6m-3-3v6" />
              <!-- Pixel dots -->
              <circle class="or3-add-hero__sparkle-dot" cx="34" cy="100" r="3" />
              <circle class="or3-add-hero__sparkle-dot or3-add-hero__sparkle-dot--green" cx="30" cy="160" r="2.5" />
              <circle class="or3-add-hero__sparkle-dot" cx="196" cy="96" r="2.5" />
              <circle class="or3-add-hero__sparkle-dot" cx="108" cy="196" r="2.5" />
              <circle class="or3-add-hero__sparkle-dot or3-add-hero__sparkle-dot--green" cx="148" cy="112" r="2" />
            </svg>
            <img
              src="/computer-icons/tasks-guy.webp"
              alt=""
              class="or3-add-hero__mascot"
              draggable="false"
            />
          </div>
        </div>
      </SurfaceCard>

      <!-- Other ways to create -->
      <section>
        <p class="or3-add-section-label">Other ways to create</p>

        <div class="grid grid-cols-2 gap-3">
          <SurfaceCard
            v-for="action in gridActions"
            :key="action.label"
            interactive
            class-name="or3-add-card"
            @click="runAction(action)"
          >
            <div class="or3-add-card__top">
              <span class="or3-add-card__icon">
                <Icon :name="action.icon" class="size-5" />
              </span>
            </div>
            <div class="or3-add-card__body">
              <p class="or3-add-card__title">{{ action.label }}</p>
              <p class="or3-add-card__desc">{{ action.description }}</p>
            </div>
            <div class="or3-add-card__foot">
              <Icon
                name="i-pixelarticons-arrow-right"
                class="or3-add-card__arrow size-4"
              />
            </div>
          </SurfaceCard>
        </div>

        <div class="mt-3">
          <SurfaceCard
            interactive
            class-name="or3-add-card or3-add-card--wide"
            @click="runAction(terminalAction)"
          >
            <div class="or3-add-card__wide-row">
              <span class="or3-add-card__icon">
                <Icon :name="terminalAction.icon" class="size-5" />
              </span>
              <div class="or3-add-card__wide-copy">
                <p class="or3-add-card__title">{{ terminalAction.label }}</p>
                <p class="or3-add-card__desc">{{ terminalAction.description }}</p>
              </div>
              <Icon
                name="i-pixelarticons-arrow-right"
                class="or3-add-card__arrow size-4"
              />
            </div>
          </SurfaceCard>
        </div>
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { useToast } from '@nuxt/ui/composables'

interface AddAction {
  label: string
  description: string
  icon: string
  route?: string
  hash?: string
  toastTitle?: string
  toastDescription?: string
}

const router = useRouter()
const toast = useToast()

const gridActions: AddAction[] = [
  {
    label: 'Prompt',
    description: 'Start a conversation with or3-intern.',
    icon: 'i-pixelarticons-message-text',
    route: '/prompts',
  },
  {
    label: 'Note',
    description: 'Write a quick note or idea to save.',
    icon: 'i-pixelarticons-notes',
    route: '/notes',
  },
  {
    label: 'File',
    description: 'Upload a file and ask or3-intern about it.',
    icon: 'i-pixelarticons-upload',
    route: '/computer/files',
  },
  {
    label: 'Cron Job',
    description: 'Schedule a task to run on a recurring basis.',
    icon: 'i-pixelarticons-clock',
    route: '/scheduled',
  },
]

const terminalAction: AddAction = {
  label: 'Terminal',
  description: 'Open a terminal session with or3-intern.',
  icon: 'i-pixelarticons-script-text',
  route: '/computer/terminal',
}

async function goTo(path: string) {
  await router.push(path)
}

async function runAction(action: AddAction) {
  if (action.toastTitle) {
    toast.add({
      title: action.toastTitle,
      description: action.toastDescription,
      color: 'neutral',
    })
  }
  if (!action.route) return
  await router.push(action.hash ? { path: action.route, hash: `#${action.hash}` } : action.route)
}
</script>

<style scoped>
/* Featured hero card ---------------------------------------------------- */
.or3-add-hero {
  position: relative;
  overflow: hidden;
}

.or3-add-hero::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 88% 18%, color-mix(in srgb, var(--or3-green-soft) 55%, transparent) 0%, transparent 32%),
    radial-gradient(circle at 8% 90%, rgba(255, 255, 255, 0.78) 0%, transparent 30%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.2), transparent 32%);
}

.or3-add-hero__inner {
  position: relative;
  display: flex;
  align-items: center;
  gap: 1rem;
  min-width: 0;
}

.or3-add-hero__copy {
  flex: 1 1 auto;
  min-width: 0;
}

.or3-add-hero__pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  border: 1.5px solid color-mix(in srgb, var(--or3-green) 30%, white 70%);
  background: color-mix(in srgb, var(--or3-green-soft) 60%, white 40%);
  color: color-mix(in srgb, var(--or3-green-dark) 85%, var(--or3-text) 15%);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.or3-add-hero__pill-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--or3-green);
}

.or3-add-hero__title {
  margin: 0.7rem 0 0;
  font-family: Georgia, 'Iowan Old Style', 'Times New Roman', serif;
  font-size: clamp(1.7rem, 5.6vw, 2.15rem);
  line-height: 1.02;
  font-weight: 700;
  color: var(--or3-text);
  letter-spacing: -0.025em;
}

.or3-add-hero__sub {
  margin: 0.55rem 0 0;
  max-width: 18rem;
  font-size: 0.92rem;
  line-height: 1.5;
  color: var(--or3-text-muted);
}

.or3-add-hero__actions {
  margin-top: 1.1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}


/* Mascot ---------------------------------------------------------------- */
.or3-add-hero__mascot-shell {
  position: relative;
  flex-shrink: 0;
  width: clamp(150px, 36vw, 200px);
  min-height: clamp(170px, 40vw, 215px);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Outer ambient halo: soft, wide, low opacity */
.or3-add-hero__mascot-glow {
  position: absolute;
  inset: -28px -22px -10px -22px;
  border-radius: 999px;
  pointer-events: none;
  background:
    radial-gradient(ellipse 70% 65% at 50% 55%,
      color-mix(in srgb, var(--or3-green-soft) 90%, white 10%) 0%,
      color-mix(in srgb, var(--or3-green-soft) 70%, white 30%) 22%,
      color-mix(in srgb, var(--or3-green-soft) 35%, transparent) 48%,
      transparent 78%),
    radial-gradient(ellipse 50% 45% at 48% 70%,
      rgba(238, 255, 197, 0.85) 0%,
      rgba(214, 245, 178, 0.55) 30%,
      transparent 65%);
  filter: blur(10px);
  opacity: 0.95;
}

/* Inner highlight: tighter, brighter, sits right behind the mascot */
.or3-add-hero__mascot-glow--inner {
  inset: 4px 6px 14px 6px;
  background:
    radial-gradient(ellipse 60% 55% at 50% 55%,
      rgba(255, 255, 255, 0.55) 0%,
      color-mix(in srgb, var(--or3-green-soft) 65%, white 35%) 28%,
      transparent 70%);
  filter: blur(4px);
  opacity: 0.85;
}

.or3-add-hero__sparkles {
  position: absolute;
  inset: -16px -12px -4px -12px;
  width: calc(100% + 24px);
  height: calc(100% + 20px);
  pointer-events: none;
  z-index: 2;
  overflow: visible;
}

.or3-add-hero__sparkle {
  stroke: rgba(255, 255, 255, 0.98);
  stroke-width: 4;
  stroke-linecap: square;
  filter: drop-shadow(0 0 6px rgba(193, 229, 145, 0.85));
  opacity: 0.95;
}

.or3-add-hero__sparkle--lg {
  stroke-width: 5;
  filter: drop-shadow(0 0 8px rgba(193, 229, 145, 0.9));
}

.or3-add-hero__sparkle--green {
  stroke: color-mix(in srgb, var(--or3-green) 55%, white 45%);
  opacity: 0.85;
}

.or3-add-hero__sparkle--soft {
  opacity: 0.55;
  stroke-width: 3;
}

.or3-add-hero__sparkle-dot {
  fill: rgba(255, 255, 255, 0.95);
  filter: drop-shadow(0 0 5px rgba(193, 229, 145, 0.78));
}

.or3-add-hero__sparkle-dot--green {
  fill: color-mix(in srgb, var(--or3-green) 55%, white 45%);
}

.or3-add-hero__mascot {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 188px;
  height: auto;
  image-rendering: pixelated;
  user-select: none;
}

/* Section label --------------------------------------------------------- */
.or3-add-section-label {
  margin: 0 0 0.65rem 0.15rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--or3-text-muted);
}

/* Action cards ---------------------------------------------------------- */
.or3-add-card {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  min-height: 0;
  padding: 1rem;
}

.or3-add-card__top {
  display: flex;
  align-items: flex-start;
}

.or3-add-card__foot {
  display: flex;
  justify-content: flex-end;
  margin-top: auto;
}

.or3-add-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--or3-surface-soft) 70%, white 30%);
  border: 1px solid var(--or3-border);
  color: var(--or3-text);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 1px 0 rgba(42, 35, 25, 0.04);
}

.or3-add-card__arrow {
  color: var(--or3-text-muted);
  transition: transform 0.15s ease, color 0.15s ease;
}

.or3-add-card:hover .or3-add-card__arrow {
  color: var(--or3-green-dark);
  transform: translateX(2px);
}

.or3-add-card__title {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 1rem;
  font-weight: 700;
  color: var(--or3-text);
  letter-spacing: -0.01em;
}

.or3-add-card__desc {
  margin: 0.25rem 0 0;
  font-size: 0.8rem;
  line-height: 1.4;
  color: var(--or3-text-muted);
}

/* Wide (terminal) card -------------------------------------------------- */
.or3-add-card--wide {
  min-height: 0;
  padding: 1rem;
}

.or3-add-card--wide .or3-add-card__wide-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.or3-add-card--wide .or3-add-card__wide-copy {
  flex: 1 1 auto;
  min-width: 0;
}

/* Mobile tweaks --------------------------------------------------------- */
@media (max-width: 480px) {
  .or3-add-hero__inner {
    gap: 0.5rem;
  }

  .or3-add-hero__title {
    margin-top: 0.55rem;
    font-size: clamp(1.5rem, 7.4vw, 1.95rem);
  }

  .or3-add-hero__sub {
    font-size: 0.86rem;
  }

  .or3-add-hero__mascot-shell {
    width: clamp(106px, 32vw, 142px);
    min-height: clamp(118px, 34vw, 152px);
  }

  .or3-add-hero__mascot {
    max-width: 132px;
  }

  .or3-add-card {
    gap: 0.65rem;
    padding: 0.875rem;
  }

  .or3-add-card__icon {
    width: 42px;
    height: 42px;
  }

  .or3-add-card__title {
    font-size: 0.9rem;
  }

  .or3-add-card__desc {
    font-size: 0.72rem;
    line-height: 1.35;
  }
}
</style>
