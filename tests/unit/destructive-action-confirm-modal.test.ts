import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import DestructiveActionConfirmModal from '../../app/components/app/DestructiveActionConfirmModal.vue';

function mountModal() {
    return mount(DestructiveActionConfirmModal, {
        props: {
            open: true,
            title: 'Delete this scheduled task?',
            itemName: 'Morning report',
            consequence: 'This task will stop running and will be removed from the schedule.',
            undoAvailability: 'There is no undo. You can create the task again later.',
            confirmLabel: 'Delete task',
        },
        global: {
            stubs: {
                UModal: {
                    props: ['open'],
                    template: '<div data-test="modal"><slot name="content" /></div>',
                },
                DangerCallout: {
                    props: ['title', 'tone'],
                    template: '<section><h2>{{ title }}</h2><slot /></section>',
                },
                UButton: {
                    props: ['label', 'loading', 'disabled'],
                    template:
                        '<button type="button" :disabled="disabled">{{ label }}</button>',
                },
            },
        },
    });
}

describe('DestructiveActionConfirmModal', () => {
    it('renders the item name, consequence, and undo availability', () => {
        const wrapper = mountModal();

        expect(wrapper.text()).toContain('Delete this scheduled task?');
        expect(wrapper.text()).toContain('Morning report');
        expect(wrapper.text()).toContain('This task will stop running');
        expect(wrapper.text()).toContain('There is no undo');
    });

    it('emits confirm from the destructive action button', async () => {
        const wrapper = mountModal();

        await wrapper.findAll('button').at(1)?.trigger('click');

        expect(wrapper.emitted('confirm')).toHaveLength(1);
    });
});
