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
    // Keep form controls at 16px+ on mobile. iOS Safari zooms the whole page when
    // focused inputs render below 16px, even if the rest of the UI looks perfect.
    input: {
      slots: {
        base: [
          'rounded-2xl bg-[var(--or3-surface)] border border-[var(--or3-border)]',
          'shadow-[var(--or3-shadow-soft)] text-base sm:text-sm text-[var(--or3-text)] placeholder:text-[var(--or3-text-muted)]',
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
          'shadow-[var(--or3-shadow-soft)] text-base sm:text-sm text-[var(--or3-text)] placeholder:text-[var(--or3-text-muted)]',
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
      slots: {
        base: [
          'w-full min-w-0 rounded-2xl bg-[var(--or3-surface)] border border-[var(--or3-border)]',
          // Make the trigger behave like a full-width field and reserve a real
          // trailing gutter for the chevron.
          'text-left pe-11',
          'text-base sm:text-sm text-[var(--or3-text)] placeholder:text-[var(--or3-text-muted)]',
          'focus-visible:ring-2 focus-visible:ring-[var(--or3-green)]/30',
        ],
        value: 'block min-w-0 flex-1 truncate pe-2 pointer-events-none',
        placeholder: 'block min-w-0 flex-1 truncate pe-2 text-[var(--or3-text-muted)]',
        trailing: 'absolute inset-y-0 end-0 flex w-10 items-center justify-center pe-3',
        trailingIcon: 'size-4 text-[var(--or3-text-muted)]',
        content: [
          'overflow-hidden rounded-2xl border border-[var(--or3-border)]',
          'bg-[var(--or3-surface)] shadow-[0_18px_40px_rgba(42,35,25,0.18)]',
          'backdrop-blur-md',
        ],
        viewport: 'p-0 divide-y-0',
        group: 'p-1.5 space-y-1 isolate',
        // Kill the default border-b on the search input and round it so it
        // doesn't render that hard black underline inside the popover.
        input: [
          'rounded-2xl border border-[var(--or3-border)] bg-[var(--or3-surface)] shadow-[var(--or3-shadow-soft)]',
          'px-3 py-2.5 text-sm text-[var(--or3-text)] placeholder:text-[var(--or3-text-muted)]',
          'focus:outline-none focus:ring-0 focus-visible:ring-0',
        ],
        item: [
          // Bigger touch target so hovered/selected items have breathing room.
          'rounded-xl px-3! py-3 text-sm font-medium leading-5 text-[var(--or3-text)]',
          'data-[highlighted]:bg-[var(--or3-green-soft)] data-[highlighted]:text-[var(--or3-green-dark)]',
          'data-[state=checked]:text-[var(--or3-green-dark)]',
        ],
        itemTrailing: 'ms-auto inline-flex min-h-5 items-center gap-1.5 ps-3',
        itemLeadingIcon: 'text-[var(--or3-text-muted)] size-4',
        itemTrailingIcon: 'text-[var(--or3-green)] size-4',
        itemLabel: 'truncate',
      },
      defaultVariants: {
        color: 'neutral',
        variant: 'outline',
        size: 'lg',
      },
    },

    select: {
      slots: {
        base: [
          'w-full min-w-0 rounded-2xl bg-[var(--or3-surface)] border border-[var(--or3-border)]',
          'text-left pe-11',
          'text-base sm:text-sm text-[var(--or3-text)] placeholder:text-[var(--or3-text-muted)]',
          'focus-visible:ring-2 focus-visible:ring-[var(--or3-green)]/30',
        ],
        value: 'block min-w-0 flex-1 truncate pe-2 pointer-events-none',
        placeholder: 'block min-w-0 flex-1 truncate pe-2 text-[var(--or3-text-muted)]',
        trailing: 'absolute inset-y-0 end-0 flex w-10 items-center justify-center pe-3',
        trailingIcon: 'size-4 text-[var(--or3-text-muted)]',
        content: [
          'overflow-hidden rounded-2xl border border-[var(--or3-border)]',
          'bg-[var(--or3-surface)] shadow-[0_18px_40px_rgba(42,35,25,0.18)]',
          'backdrop-blur-md',
        ],
        viewport: 'p-0 divide-y-0',
        group: 'p-1.5 space-y-1 isolate',
        item: [
          'rounded-xl px-3! py-3 text-sm font-medium leading-5 text-[var(--or3-text)]',
          'data-[highlighted]:bg-[var(--or3-green-soft)] data-[highlighted]:text-[var(--or3-green-dark)]',
        ],
        itemTrailing: 'ms-auto inline-flex min-h-5 items-center gap-1.5 ps-3',
      },
      defaultVariants: {
        color: 'neutral',
        variant: 'outline',
        size: 'lg',
      },
    },

    dropdownMenu: {
      slots: {
        content: [
          'overflow-hidden rounded-2xl border border-[var(--or3-border)]',
          'bg-[var(--or3-surface)] shadow-[0_18px_40px_rgba(42,35,25,0.18)]',
          'backdrop-blur-md',
        ],
        viewport: 'p-1.5',
        item: [
          'rounded-xl px-3! py-2.5 text-sm font-medium text-[var(--or3-text)]',
          'data-[highlighted]:bg-[var(--or3-green-soft)] data-[highlighted]:text-[var(--or3-green-dark)]',
        ],
        itemLeadingIcon: 'text-[var(--or3-text-muted)] size-4',
        itemTrailingIcon: 'text-[var(--or3-text-muted)] size-4',
      },
    },

    contextMenu: {
      slots: {
        content: [
          'overflow-hidden rounded-2xl border border-[var(--or3-border)]',
          'bg-[var(--or3-surface)] shadow-[0_18px_40px_rgba(42,35,25,0.18)]',
          'backdrop-blur-md',
        ],
        viewport: 'p-1.5',
        item: [
          'rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--or3-text)]',
          'data-[highlighted]:bg-[var(--or3-green-soft)] data-[highlighted]:text-[var(--or3-green-dark)]',
        ],
      },
    },

    popover: {
      slots: {
        content: [
          'rounded-2xl border border-[var(--or3-border)]',
          'bg-[var(--or3-surface)] shadow-[0_18px_40px_rgba(42,35,25,0.18)]',
        ],
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
      slots: {
        root: 'relative inline-flex items-center justify-end',
        container: 'flex !h-6 items-center',
        base: [
          'inline-flex !h-6 !w-11 items-center shrink-0 rounded-full border !px-[2px]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 transition-[background,border-color,box-shadow] duration-200',
          'border-[color:rgba(136,117,89,0.22)] data-[state=unchecked]:!bg-[#d6cab4]',
          'data-[state=checked]:border-[var(--or3-green)] data-[state=checked]:!bg-[#3f8f58]',
          'focus-visible:outline-[var(--or3-green)] shadow-[inset_0_1px_2px_rgba(42,35,25,0.10)]',
        ],
        thumb: [
          'group pointer-events-none flex items-center justify-center rounded-full bg-white',
          'shadow-[0_1px_2px_rgba(42,35,25,0.25)] ring-1 ring-black/5',
          '!h-[18px] !w-[18px] transition-transform duration-200',
          'data-[state=unchecked]:translate-x-0 data-[state=unchecked]:rtl:-translate-x-0',
          'data-[state=checked]:!translate-x-5 data-[state=checked]:rtl:!translate-x-5',
        ],
      },
      defaultVariants: {
        size: 'lg',
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
