/**
 * Nuxt UI theme defaults for or3-app.
 *
 * Goal: a calm, retro-professional iOS feel. Warm off-white surfaces,
 * muted green accents, large rounded corners, generous touch targets.
 *
 * If you want to tweak colors or component sizing app-wide,
 * change it here once instead of in every component.
 */
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'green',
      secondary: 'stone',
      success: 'green',
      info: 'sky',
      warning: 'amber',
      error: 'rose',
      neutral: 'stone',
    },

    // Buttons feel like soft pill controls, with a subtle press animation.
    button: {
      slots: {
        base: [
          'rounded-2xl font-medium transition active:scale-[0.98]',
          'focus-visible:ring-2 focus-visible:ring-[var(--or3-green)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--or3-background)]',
        ],
      },
      defaultVariants: {
        color: 'primary',
        variant: 'solid',
        size: 'md',
      },
    },

    // Inputs sit on the cream background, so we add a clear border + cream-white fill.
    input: {
      slots: {
        base: [
          'rounded-2xl bg-[var(--or3-surface)] border border-[var(--or3-border)]',
          'shadow-[var(--or3-shadow-soft)] text-[var(--or3-text)] placeholder:text-[var(--or3-text-muted)]',
          'focus:border-[var(--or3-green)] focus-visible:ring-2 focus-visible:ring-[var(--or3-green)]/30',
        ],
      },
      defaultVariants: {
        color: 'neutral',
        variant: 'outline',
        size: 'lg',
      },
    },

    textarea: {
      slots: {
        base: [
          'rounded-2xl bg-[var(--or3-surface)] border border-[var(--or3-border)]',
          'shadow-[var(--or3-shadow-soft)] text-[var(--or3-text)] placeholder:text-[var(--or3-text-muted)]',
          'focus:border-[var(--or3-green)] focus-visible:ring-2 focus-visible:ring-[var(--or3-green)]/30',
        ],
      },
      defaultVariants: {
        color: 'neutral',
        variant: 'outline',
        size: 'lg',
      },
    },

    selectMenu: {
      defaultVariants: {
        color: 'neutral',
        variant: 'outline',
        size: 'lg',
      },
    },

    select: {
      defaultVariants: {
        color: 'neutral',
        variant: 'outline',
        size: 'lg',
      },
    },

    formField: {
      slots: {
        label: 'text-sm font-medium text-[var(--or3-text)]',
        description: 'text-xs text-[var(--or3-text-muted)] mt-1',
        help: 'text-xs text-[var(--or3-text-muted)] mt-1',
        error: 'text-xs text-[var(--or3-danger)] mt-1',
      },
    },

    switch: {
      defaultVariants: {
        color: 'primary',
        size: 'md',
      },
    },

    badge: {
      defaultVariants: {
        size: 'sm',
        variant: 'subtle',
      },
    },

    modal: {
      slots: {
        content:
          'bg-[var(--or3-surface)] border border-[var(--or3-border)] rounded-3xl shadow-[var(--or3-shadow)]',
      },
    },

    slideover: {
      slots: {
        content: 'bg-[var(--or3-background)] border-l border-[var(--or3-border)]',
      },
    },
  },
});
