import { watch, type ComputedRef, type Ref } from 'vue';

type ToastApi = {
    add: (options: Record<string, unknown>) => string | number | { id: string | number };
    remove: (id: string | number) => void;
};

function toastNotificationId(
    value: string | number | { id: string | number },
): string | number {
    return typeof value === 'object' ? value.id : value;
}

export function useManagedToast(
    shouldShow: ComputedRef<boolean>,
    toast: ToastApi,
    toastId: Ref<string | number | undefined>,
    buildToast: () => Record<string, unknown>,
) {
    watch(shouldShow, (visible) => {
        if (!visible) {
            if (toastId.value !== undefined) {
                toast.remove(toastId.value);
                toastId.value = undefined;
            }
            return;
        }
        if (toastId.value !== undefined) return;
        toastId.value = toastNotificationId(toast.add(buildToast()));
    });
}
