import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import SettingsLogViewer from '../../app/components/settings/SettingsLogViewer.vue';

function mountViewer(propOverrides: Record<string, unknown> = {}) {
    return mount(SettingsLogViewer, {
        props: {
            title: 'App Events',
            entries: [
                {
                    id: 'app-1',
                    createdAt: '2026-05-14T00:00:00Z',
                    level: 'info',
                    area: 'api',
                    event: 'stream:open',
                    detail: 'opened',
                    traceId: 'trace-a',
                },
                {
                    id: 'app-2',
                    createdAt: '2026-05-14T00:00:01Z',
                    level: 'error',
                    area: 'terminal',
                    event: 'action:failed',
                    detail: 'failed',
                    traceId: 'trace-b',
                },
            ],
            emptyText: 'No events',
            ...propOverrides,
        },
        global: {
            stubs: {
                SurfaceCard: { template: '<section><slot /></section>' },
                UButton: {
                    template:
                        '<button type="button"><slot />{{ label }}</button>',
                    props: ['label'],
                },
            },
        },
    });
}

describe('SettingsLogViewer', () => {
    it('filters entries by level, component, and trace', async () => {
        const wrapper = mountViewer();
        expect(wrapper.text()).toContain('stream:open');
        expect(wrapper.text()).toContain('action:failed');

        const errorButton = wrapper
            .findAll('button')
            .find((button) => button.text() === 'Error');
        await errorButton?.trigger('click');
        expect(wrapper.text()).not.toContain('stream:open');
        expect(wrapper.text()).toContain('action:failed');

        await wrapper.findAll('input')[0].setValue('api');
        expect(wrapper.text()).toContain('No events');

        const allButton = wrapper
            .findAll('button')
            .find((button) => button.text() === 'All');
        await allButton?.trigger('click');
        expect(wrapper.text()).toContain('stream:open');

        await wrapper.findAll('input')[1].setValue('trace-b');
        expect(wrapper.text()).not.toContain('stream:open');
        expect(wrapper.text()).not.toContain('action:failed');
    });

    it('paginates entries past the current page size', async () => {
        const wrapper = mountViewer({
            limit: 1,
            entries: [
                {
                    id: 'app-1',
                    createdAt: '2026-05-14T00:00:00Z',
                    level: 'info',
                    area: 'api',
                    event: 'stream:open',
                    detail: 'opened',
                    traceId: 'trace-a',
                },
                {
                    id: 'app-2',
                    createdAt: '2026-05-14T00:00:01Z',
                    level: 'warn',
                    area: 'runner',
                    event: 'refresh:error',
                    detail: 'retrying',
                    traceId: 'trace-b',
                },
                {
                    id: 'app-3',
                    createdAt: '2026-05-14T00:00:02Z',
                    level: 'error',
                    area: 'terminal',
                    event: 'action:failed',
                    detail: 'failed',
                    traceId: 'trace-c',
                },
            ],
        });

        expect(wrapper.text()).toContain('Showing 1-1 of 3');
        expect(wrapper.text()).toContain('stream:open');
        expect(wrapper.text()).not.toContain('refresh:error');

        const olderButton = wrapper
            .findAll('button')
            .find((button) => button.text() === 'Older');
        await olderButton?.trigger('click');

        expect(wrapper.text()).toContain('Showing 2-2 of 3');
        expect(wrapper.text()).toContain('refresh:error');
        expect(wrapper.text()).not.toContain('stream:open');

        await olderButton?.trigger('click');

        expect(wrapper.text()).toContain('Showing 3-3 of 3');
        expect(wrapper.text()).toContain('action:failed');

        const newerButton = wrapper
            .findAll('button')
            .find((button) => button.text() === 'Newer');
        await newerButton?.trigger('click');

        expect(wrapper.text()).toContain('Showing 2-2 of 3');
        expect(wrapper.text()).toContain('refresh:error');
    });
});
