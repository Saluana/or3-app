import { computed, ref, shallowRef } from 'vue';
import type { Or3AppError } from '~/types/app-state';
import type { CronJob, CronJobResponse, CronJobsResponse, CronStatusResponse } from '~/types/or3-api';
import { useAuthSession } from './useAuthSession';
import { useOr3Api } from './useOr3Api';

const cronJobs = ref<CronJob[]>([]);
const cronStatus = ref<CronStatusResponse | null>(null);
const cronLoading = ref(false);
const cronSaving = ref(false);
const cronError = shallowRef<Or3AppError | null>(null);

function sortCronJobs(items: CronJob[]) {
    return [...items].sort((a, b) => {
        const aNext = a.state?.next_run_at_ms ?? Number.POSITIVE_INFINITY;
        const bNext = b.state?.next_run_at_ms ?? Number.POSITIVE_INFINITY;
        if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
        if (aNext !== bNext) return aNext - bNext;
        return (b.updated_at_ms ?? 0) - (a.updated_at_ms ?? 0);
    });
}

export function useCronJobs() {
    const api = useOr3Api();
    const authSession = useAuthSession();

    const activeJobs = computed(() => cronJobs.value.filter((job) => job.enabled));
    const pausedJobs = computed(() => cronJobs.value.filter((job) => !job.enabled));
    const erroredJobs = computed(() => cronJobs.value.filter((job) => job.state?.last_status === 'error'));
    const nextJob = computed(() => activeJobs.value.find((job) => job.state?.next_run_at_ms));

    async function loadStatus() {
        cronError.value = null;
        try {
            cronStatus.value = await api.request<CronStatusResponse>('/internal/v1/cron/status');
            return cronStatus.value;
        } catch (error) {
            cronError.value = error as Or3AppError;
            throw error;
        }
    }

    async function loadJobs() {
        cronLoading.value = true;
        cronError.value = null;
        try {
            const [status, response] = await Promise.all([
                api.request<CronStatusResponse>('/internal/v1/cron/status'),
                api.request<CronJobsResponse>('/internal/v1/cron/jobs'),
            ]);
            cronStatus.value = status;
            cronJobs.value = sortCronJobs(response.items ?? []);
            return cronJobs.value;
        } catch (error) {
            cronError.value = error as Or3AppError;
            throw error;
        } finally {
            cronLoading.value = false;
        }
    }

    async function createJob(job: Partial<CronJob>) {
        cronSaving.value = true;
        cronError.value = null;
        try {
            const response = await authSession.retryWithAuth(
                (onAuthChallenge) => api.request<CronJobResponse>('/internal/v1/cron/jobs', {
                    method: 'POST',
                    body: job,
                    onAuthChallenge,
                }),
                'cron-create',
            );
            await loadJobs();
            return response.job;
        } catch (error) {
            cronError.value = error as Or3AppError;
            throw error;
        } finally {
            cronSaving.value = false;
        }
    }

    async function updateJob(id: string, job: Partial<CronJob>) {
        cronSaving.value = true;
        cronError.value = null;
        try {
            const response = await authSession.retryWithAuth(
                (onAuthChallenge) => api.request<CronJobResponse>(`/internal/v1/cron/jobs/${encodeURIComponent(id)}`, {
                    method: 'PATCH',
                    body: job,
                    onAuthChallenge,
                }),
                'cron-update',
            );
            cronJobs.value = sortCronJobs(cronJobs.value.map((item) => item.id === id ? response.job : item));
            void loadStatus().catch(() => undefined);
            return response.job;
        } catch (error) {
            cronError.value = error as Or3AppError;
            throw error;
        } finally {
            cronSaving.value = false;
        }
    }

    async function deleteJob(id: string) {
        cronSaving.value = true;
        cronError.value = null;
        try {
            await authSession.retryWithAuth(
                (onAuthChallenge) => api.request(`/internal/v1/cron/jobs/${encodeURIComponent(id)}`, {
                    method: 'DELETE',
                    onAuthChallenge,
                }),
                'cron-delete',
            );
            cronJobs.value = cronJobs.value.filter((job) => job.id !== id);
            void loadStatus().catch(() => undefined);
        } catch (error) {
            cronError.value = error as Or3AppError;
            throw error;
        } finally {
            cronSaving.value = false;
        }
    }

    async function postJobAction(id: string, action: 'run' | 'pause' | 'resume') {
        cronSaving.value = true;
        cronError.value = null;
        try {
            await authSession.retryWithAuth(
                (onAuthChallenge) => api.request(`/internal/v1/cron/jobs/${encodeURIComponent(id)}/${action}`, {
                    method: 'POST',
                    body: action === 'run' ? { force: true } : {},
                    onAuthChallenge,
                }),
                `cron-${action}`,
            );
            await loadJobs();
        } catch (error) {
            cronError.value = error as Or3AppError;
            throw error;
        } finally {
            cronSaving.value = false;
        }
    }

    return {
        cronJobs,
        cronStatus,
        cronLoading,
        cronSaving,
        cronError,
        activeJobs,
        pausedJobs,
        erroredJobs,
        nextJob,
        loadStatus,
        loadJobs,
        createJob,
        updateJob,
        deleteJob,
        runJob: (id: string) => postJobAction(id, 'run'),
        pauseJob: (id: string) => postJobAction(id, 'pause'),
        resumeJob: (id: string) => postJobAction(id, 'resume'),
    };
}
