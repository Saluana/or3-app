import { computed } from 'vue';
import { useActiveHost } from './useActiveHost';
import { useLocalCache } from './useLocalCache';

export interface FavoriteDirectory {
    rootId: string;
    rootLabel: string;
    path: string;
    label: string;
    addedAt: string;
}

interface FavoriteDirectoryPreferences {
    favorites: FavoriteDirectory[];
}

function favoriteDirectoriesKey(hostId: string | null | undefined) {
    return `favorite-directories:${hostId || 'local'}`;
}

function favoriteDirectoryLabel(rootLabel: string, path: string) {
    if (!path || path === '.') return rootLabel || 'Root';
    const parts = path.split('/').filter(Boolean);
    const label = parts.at(-1) || path;
    return label.length > 22 ? `${label.slice(0, 19)}...` : label;
}

function compactFavoritePath(path: string, maxLength = 32) {
    if (!path || path === '.') return '.';
    const parts = path.split('/').filter(Boolean);
    let visible = parts.join('/');
    if (visible.length <= maxLength) return visible;
    while (parts.length > 2) {
        parts.shift();
        visible = `.../${parts.join('/')}`;
        if (visible.length <= maxLength) return visible;
    }
    return visible.length > maxLength
        ? `${visible.slice(0, maxLength - 3)}...`
        : visible;
}

function normalizeFavoriteDirectory(raw: unknown): FavoriteDirectory | null {
    if (!raw || typeof raw !== 'object') return null;
    const source = raw as Record<string, unknown>;
    const rootId =
        typeof source.rootId === 'string' ? source.rootId.trim() : '';
    const rootLabel =
        typeof source.rootLabel === 'string' ? source.rootLabel.trim() : '';
    const path =
        typeof source.path === 'string' && source.path.trim()
            ? source.path.trim()
            : '.';
    if (!rootId) return null;
    const label =
        typeof source.label === 'string' && source.label.trim()
            ? source.label.trim()
            : favoriteDirectoryLabel(rootLabel, path);
    const addedAt =
        typeof source.addedAt === 'string' && source.addedAt.trim()
            ? source.addedAt.trim()
            : new Date(0).toISOString();
    return {
        rootId,
        rootLabel,
        path,
        label,
        addedAt,
    };
}

export function favoriteDirectoryDescription(favorite: FavoriteDirectory) {
    if (favorite.path === '.') return `Top of ${favorite.rootLabel}`;
    return `${favorite.rootLabel}/${compactFavoritePath(favorite.path)}`;
}

export function useFavoriteDirectories() {
    const cache = useLocalCache();
    const { activeHost } = useActiveHost();

    const preferences = computed<FavoriteDirectoryPreferences>(() => {
        const raw =
            cache.state.value.preferences[
                favoriteDirectoriesKey(activeHost.value?.id)
            ];
        if (!raw || typeof raw !== 'object') {
            return { favorites: [] };
        }
        const favorites = Array.isArray(
            (raw as FavoriteDirectoryPreferences).favorites,
        )
            ? (raw as FavoriteDirectoryPreferences).favorites
                  .map((entry) => normalizeFavoriteDirectory(entry))
                  .filter((entry): entry is FavoriteDirectory => Boolean(entry))
            : [];
        return { favorites };
    });

    const favoriteDirectories = computed(() => preferences.value.favorites);

    function savePreferences(nextValue: FavoriteDirectoryPreferences) {
        cache.state.value.preferences[
            favoriteDirectoriesKey(activeHost.value?.id)
        ] = nextValue;
        cache.persist();
    }

    function isFavorite(rootId: string, path: string) {
        const normalizedPath = path?.trim() || '.';
        return favoriteDirectories.value.some(
            (favorite) =>
                favorite.rootId === rootId && favorite.path === normalizedPath,
        );
    }

    function toggleFavorite(rootId: string, path: string, rootLabel: string) {
        const normalizedPath = path?.trim() || '.';
        const existingIndex = favoriteDirectories.value.findIndex(
            (favorite) =>
                favorite.rootId === rootId && favorite.path === normalizedPath,
        );
        if (existingIndex >= 0) {
            const nextFavorites = favoriteDirectories.value.filter(
                (_, index) => index !== existingIndex,
            );
            savePreferences({ favorites: nextFavorites });
            return false;
        }

        const nextFavorite: FavoriteDirectory = {
            rootId,
            rootLabel,
            path: normalizedPath,
            label: favoriteDirectoryLabel(rootLabel, normalizedPath),
            addedAt: new Date().toISOString(),
        };
        savePreferences({
            favorites: [nextFavorite, ...favoriteDirectories.value],
        });
        return true;
    }

    return {
        favoriteDirectories,
        isFavorite,
        toggleFavorite,
    };
}
