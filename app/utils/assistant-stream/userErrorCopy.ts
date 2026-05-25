import type { Or3AppErrorCode } from '~/types/app-state';
import { coerceErrorText, extractErrorCode } from './errors';

export const EMPTY_FINAL_USER_MESSAGE =
    "I finished the steps but didn't have a final answer to show. Try asking again, or open Approvals if something is waiting.";

export function isEmptyFinalUserMessage(text: string | undefined) {
    return String(text ?? '').trim() === EMPTY_FINAL_USER_MESSAGE;
}

export const EMPTY_STREAM_USER_MESSAGE =
    "I didn't get a reply back. Try sending your message again.";

export interface UserFacingErrorCopy {
    title: string;
    message: string;
    suggestion?: string;
}

const COPY_BY_CODE: Partial<Record<Or3AppErrorCode, UserFacingErrorCopy>> = {
    host_unreachable: {
        title: "Can't reach your computer",
        message: "OR3 couldn't connect to the service on your paired device.",
        suggestion: 'Check that the OR3 app on your computer is running, then try again.',
    },
    auth_required: {
        title: 'Sign-in needed',
        message: 'This device needs to sign in again before chat can continue.',
        suggestion: 'Open Settings and pair or reconnect this device.',
    },
    missing_token: {
        title: 'Not connected',
        message: "This device isn't linked to a computer yet.",
        suggestion: 'Open Settings → Pair to connect.',
    },
    invalid_token: {
        title: 'Connection expired',
        message: 'Your link to the computer is no longer valid.',
        suggestion: 'Pair this device again from Settings.',
    },
    token_replay: {
        title: 'Connection issue',
        message: 'The secure session could not be verified.',
        suggestion: 'Pair this device again from Settings.',
    },
    auth_rate_limited: {
        title: 'Please wait a moment',
        message: 'Too many sign-in attempts happened at once.',
        suggestion: 'Wait a few seconds, then try again.',
    },
    session_required: {
        title: 'Session needed',
        message: 'OR3 needs a fresh secure session before continuing.',
        suggestion: 'Open Settings and reconnect this device.',
    },
    session_expired: {
        title: 'Session expired',
        message: 'Your secure session timed out.',
        suggestion: 'Open Settings and reconnect this device.',
    },
    passkey_required: {
        title: 'Passkey required',
        message: 'This action needs your passkey.',
        suggestion: 'Complete the passkey prompt, then try again.',
    },
    step_up_required: {
        title: 'Extra confirmation needed',
        message: 'This action needs an additional security step.',
        suggestion: 'Follow the security prompt, then try again.',
    },
    forbidden: {
        title: "Can't do that",
        message: "You don't have permission for this action.",
        suggestion: 'Check Settings → Permissions or ask an admin on this computer.',
    },
    unauthorized: {
        title: "Can't do that",
        message: "You don't have permission for this action.",
        suggestion: 'Check Settings → Permissions or reconnect this device.',
    },
    rate_limited: {
        title: 'Slow down a little',
        message: 'Too many requests were sent at once.',
        suggestion: 'Wait a moment, then try again.',
    },
    validation_failed: {
        title: 'Request could not start',
        message: 'The server rejected this chat request.',
        suggestion: 'Try again. If it keeps failing, start a new chat or reconnect from Settings.',
    },
    capability_unavailable: {
        title: 'Not available on this computer',
        message: "This computer doesn't allow that level of access right now.",
        suggestion: 'Try Ask mode, or check Settings → Permissions on the computer.',
    },
    approval_required: {
        title: 'Waiting for you',
        message: 'OR3 needs your approval before it can continue.',
        suggestion: 'Review the request below and tap Approve or Deny.',
    },
    stream_failed: {
        title: 'Reply interrupted',
        message: 'The live reply stopped before it finished.',
        suggestion: 'Try again. If it keeps happening, check that your computer is awake and online.',
    },
    stream_error: {
        title: 'Reply interrupted',
        message: 'Something went wrong while the answer was streaming.',
        suggestion: 'Try again in a moment.',
    },
    stream_idle_timeout: {
        title: 'Catching up',
        message: 'Live updates paused while OR3 loads the latest result.',
        suggestion: 'Wait a few seconds, or tap Retry on the message if nothing appears.',
    },
    empty_final_text: {
        title: 'No final answer',
        message: EMPTY_FINAL_USER_MESSAGE,
    },
    provider_error: {
        title: 'Model provider issue',
        message: 'The AI provider returned an error.',
        suggestion: 'Try again or pick a different model in the composer.',
    },
    runner_missing: {
        title: 'Agent unavailable',
        message: "The selected agent isn't available on this computer.",
        suggestion: 'Choose OR3 Intern or another agent from the list.',
    },
    runner_auth_missing: {
        title: 'Agent not signed in',
        message: "The selected agent needs to be set up on your computer first.",
        suggestion: 'Open Settings on the computer or pick OR3 Intern.',
    },
    runner_chat_turn_active: {
        title: 'Still working',
        message: 'A previous request is still running for this chat.',
        suggestion: 'Wait for it to finish or tap Stop, then try again.',
    },
    aborted: {
        title: 'Stopped',
        message: 'This request was stopped before it finished.',
    },
    timeout: {
        title: 'Timed out',
        message: 'This took too long and was stopped.',
        suggestion: 'Try a shorter request or check that your computer is online.',
    },
    unknown: {
        title: 'Something went wrong',
        message: "OR3 couldn't finish this request.",
        suggestion: 'Try again. If it keeps failing, reconnect from Settings.',
    },
};

function copyFromMessagePattern(message: string): UserFacingErrorCopy | null {
    const lower = message.toLowerCase();
    if (
        lower.includes('requested tools exceed service capability') ||
        lower.includes('tool exceeds service capability')
    ) {
        return {
            title: 'Safer mode required',
            message: "This computer only allows safer tools for that request.",
            suggestion: 'Switch to Ask mode and try again.',
        };
    }
    if (lower.includes('network') || lower.includes('fetch')) {
        return {
            title: 'Connection problem',
            message: "OR3 couldn't reach your computer over the network.",
            suggestion: 'Check Wi‑Fi or VPN, then try again.',
        };
    }
    return null;
}

export function userFacingErrorCopy(
    error: unknown,
    errorCode?: Or3AppErrorCode,
): UserFacingErrorCopy {
    const code = errorCode ?? extractErrorCode(error);
    const raw = coerceErrorText(error);
    if (code === 'validation_failed' && raw) {
        return {
            title: 'Request could not start',
            message: raw,
            suggestion:
                'Try again. If it keeps failing, start a new chat or reconnect from Settings.',
        };
    }
    if (code && COPY_BY_CODE[code]) {
        return COPY_BY_CODE[code]!;
    }
    const fromPattern = raw ? copyFromMessagePattern(raw) : null;
    if (fromPattern) return fromPattern;

    return {
        title: COPY_BY_CODE.unknown!.title,
        message: raw || COPY_BY_CODE.unknown!.message,
        suggestion: COPY_BY_CODE.unknown!.suggestion,
    };
}

export function formatUserFacingErrorMessage(copy: UserFacingErrorCopy) {
    const parts = [copy.message];
    if (copy.suggestion) parts.push(copy.suggestion);
    return parts.join('\n\n');
}

export function formatUserFacingErrorInline(
    error: unknown,
    errorCode?: Or3AppErrorCode,
) {
    return formatUserFacingErrorMessage(
        userFacingErrorCopy(error, errorCode),
    );
}

export function userFacingErrorToastDescription(
    error: unknown,
    errorCode?: Or3AppErrorCode,
) {
    const copy = userFacingErrorCopy(error, errorCode);
    return copy.suggestion || copy.message;
}
