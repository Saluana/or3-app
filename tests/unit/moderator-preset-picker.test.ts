import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import ModeratorPresetPicker from '../../app/components/settings/ModeratorPresetPicker.vue';

function mountPicker(modelValue = 'balanced') {
    return mount(ModeratorPresetPicker, {
        props: { modelValue },
        global: {
            stubs: {
                UBadge: {
                    template: '<span><slot /></span>',
                },
            },
        },
    });
}

describe('ModeratorPresetPicker', () => {
    it('emits one parent-owned selection event when a preset is clicked', async () => {
        const wrapper = mountPicker();

        const button = wrapper
            .findAll('button')
            .find((candidate) => candidate.text().includes('Careful helper'));
        expect(button).toBeTruthy();

        await button!.trigger('click');

        expect(wrapper.emitted('select')).toEqual([['cautious']]);
        expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    });
});
