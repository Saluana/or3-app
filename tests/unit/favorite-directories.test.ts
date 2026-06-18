import { ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const persist = vi.fn();
const state = ref({
    preferences: {} as Record<string, unknown>,
});

vi.mock('~/composables/useLocalCache', () => ({
    useLocalCache: () => ({ state, persist }),
}));

vi.mock('~/composables/useActiveHost', () => ({
    useActiveHost: () => ({ activeHost: ref({ id: 'host-1' }) }),
}));

import { useFavoriteDirectories } from '../../app/composables/useFavoriteDirectories';

describe('favorite directories', () => {
    beforeEach(() => {
        persist.mockClear();
        state.value.preferences = {
            'favorite-directories:host-1': {
                favorites: [
                    {
                        rootId: 'computer',
                        rootLabel: 'Computer',
                        path: 'Users/brendon/.intern',
                        label: '.intern',
                        addedAt: '2026-05-09T00:00:00.000Z',
                    },
                ],
            },
        };
    });

    it('removes a favorite without requiring its root to still exist', () => {
        const favorites = useFavoriteDirectories();

        expect(
            favorites.removeFavorite(
                'computer',
                'Users/brendon/.intern',
            ),
        ).toBe(true);
        expect(favorites.favoriteDirectories.value).toEqual([]);
        expect(persist).toHaveBeenCalledOnce();
    });

    it('does not persist when the favorite does not exist', () => {
        const favorites = useFavoriteDirectories();

        expect(favorites.removeFavorite('home', '.intern')).toBe(false);
        expect(persist).not.toHaveBeenCalled();
    });
});
