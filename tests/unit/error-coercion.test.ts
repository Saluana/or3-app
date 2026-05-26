import { describe, expect, it } from 'vitest';

import {
    coerceErrorText,
    describeRequestError,
    serializeErrorForLog,
} from '../../app/utils/assistant-stream/errors';
import { userFacingErrorCopy } from '../../app/utils/assistant-stream/userErrorCopy';

describe('error coercion', () => {
    it('reads message text from Or3AppError-shaped objects', () => {
        const error = {
            code: 'validation_failed',
            status: 400,
            message: 'session_key is required',
        };
        expect(describeRequestError(error)).toBe('session_key is required');
        expect(serializeErrorForLog(error)).toMatchObject({
            error: 'session_key is required',
            code: 'validation_failed',
            status: 400,
        });
    });

    it('unwraps nested message objects instead of returning [object Object]', () => {
        const error = {
            code: 'validation_failed',
            status: 400,
            message: { field: 'session_key', reason: 'required' },
        };
        expect(describeRequestError(error)).toBe(
            '{"field":"session_key","reason":"required"}',
        );
        expect(userFacingErrorCopy(error, 'validation_failed').message).not.toBe(
            '[object Object]',
        );
    });

    it('joins validation error arrays', () => {
        expect(
            coerceErrorText({
                errors: ['session_key is required', 'message is required'],
            }),
        ).toBe('session_key is required; message is required');
    });
});
