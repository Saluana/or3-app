export interface MessageMutationOptions {
    persist?: boolean;
    touch?: boolean;
    syncSummary?: boolean;
    /** Replace the cached message object (required for index + reactivity). */
    replace?: boolean;
}

export const HYDRATE_MUTATION_OPTIONS: MessageMutationOptions = {
    persist: false,
    syncSummary: false,
    touch: false,
    replace: true,
};
