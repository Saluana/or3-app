// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import ChatMessageList from '../../app/components/assistant/ChatMessageList.vue';
import type { ChatMessage } from '../../app/types/app-state';

function buildMessage(index: number): ChatMessage {
    return {
        id: `message-${index}`,
        sessionId: 'session-1',
        role: index % 2 === 0 ? 'assistant' : 'user',
        content: `Message ${index}`,
        status: 'complete',
        createdAt: new Date(2026, 4, 13, 12, 0, index).toISOString(),
    };
}

class ResizeObserverMock {
    private readonly callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
    }

    observe(target: Element) {
        this.callback(
            [
                {
                    target,
                    contentRect: {
                        width: 320,
                        height: 80,
                        top: 0,
                        left: 0,
                        bottom: 80,
                        right: 320,
                        x: 0,
                        y: 0,
                        toJSON() {
                            return {};
                        },
                    } as DOMRectReadOnly,
                } as ResizeObserverEntry,
            ],
            this as unknown as ResizeObserver,
        );
    }

    unobserve() {}

    disconnect() {}
}

describe('ChatMessageList', () => {
    beforeEach(() => {
        Object.defineProperty(globalThis, 'ResizeObserver', {
            configurable: true,
            writable: true,
            value: ResizeObserverMock,
        });
        Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
            configurable: true,
            get() {
                return 420;
            },
        });
        vi.spyOn(
            HTMLElement.prototype,
            'getBoundingClientRect',
        ).mockReturnValue({
            width: 320,
            height: 80,
            top: 0,
            left: 0,
            bottom: 80,
            right: 320,
            x: 0,
            y: 0,
            toJSON() {
                return {};
            },
        } as DOMRect);
        Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
            configurable: true,
            writable: true,
            value: 0,
        });
        Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
            configurable: true,
            value(options: ScrollToOptions) {
                if (typeof options.top === 'number') {
                    this.scrollTop = options.top;
                }
            },
        });
    });

    it('renders a virtualized subset of a long conversation', async () => {
        const messages = Array.from({ length: 200 }, (_, index) =>
            buildMessage(index),
        );

        const wrapper = mount(ChatMessageList, {
            props: { messages },
            attachTo: document.body,
            global: {
                stubs: {
                    ChatMessage: {
                        props: ['message'],
                        template:
                            '<article class="chat-message-stub">{{ message.id }}</article>',
                    },
                },
            },
        });

        await nextTick();
        await nextTick();

        const renderedItems = wrapper.findAll('.or3-scroll-item');
        expect(renderedItems.length).toBeGreaterThan(0);
        expect(renderedItems.length).toBeLessThan(messages.length);
        expect(wrapper.findAll('.chat-message-stub').length).toBe(
            renderedItems.length,
        );
    });
});
