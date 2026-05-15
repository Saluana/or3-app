import { computed, ref } from 'vue'

let nextId = 0
const activeHintId = ref<number | null>(null)

export function useHintGroup() {
    function createHintOpen() {
        const myId = nextId++

        return computed({
            get() {
                return activeHintId.value === myId
            },
            set(value: boolean) {
                activeHintId.value = value ? myId : null
            },
        })
    }

    return { createHintOpen }
}
