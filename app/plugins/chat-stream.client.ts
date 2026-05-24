import {
    installChatStreamSideEffects,
    useAssistantStream,
} from '~/composables/useAssistantStream';

export default defineNuxtPlugin(() => {
    const { send } = useAssistantStream();
    installChatStreamSideEffects(send);
});
