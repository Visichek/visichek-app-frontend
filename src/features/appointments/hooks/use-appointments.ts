'use client';

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api/request';
import { apiGetList } from '@/lib/api/list';
import { bulkAction } from '@/lib/api/bulk';
import type {
  Appointment,
  AppointmentRequest,
  AppointmentCheckInRequest,
  AppointmentCheckInResponse,
  AppointmentFormRequirementsOut,
} from '@/types/visitor';
import type { ListResponse, BulkJobResult } from '@/types/list';

/**
 * Query key factory for appointment-related queries
 */
const appointmentKeys = {
  all: ['appointments'] as const,
  lists: () => ['appointments', 'list'] as const,
  list: (filters?: Record<string, unknown>) =>
    ['appointments', 'list', filters] as const,
  details: () => ['appointments', 'detail'] as const,
  detail: (id: string) => ['appointments', 'detail', id] as const,
};

/**
 * Fetch the paginated appointments list. Returns the new `{ items, meta }`
 * envelope per tables.txt §2.4.
 */
export function useAppointments(filters?: Record<string, unknown>) {
  return useQuery<ListResponse<Appointment>>({
    queryKey: appointmentKeys.list(filters),
    queryFn: () => apiGetList<Appointment>('/appointments', filters),
    staleTime: 30000,
    placeholderData: keepPreviousData,
  });
}

/**
 * Fetch the system + tenant required fields for the appointment form.
 *
 * `GET /v1/appointments/form-requirements` (super_admin / dept_admin /
 * receptionist). Renders the two visually-distinct sections in the
 * schedule form; every entry with `required=true` (in either list)
 * MUST be filled before the create call is accepted. Cached generously
 * because form definitions change rarely.
 */
export function useAppointmentFormRequirements(options?: {
  enabled?: boolean;
}) {
  return useQuery<AppointmentFormRequirementsOut>({
    queryKey: ['appointments', 'form-requirements'] as const,
    queryFn: () =>
      apiGet<AppointmentFormRequirementsOut>(
        '/appointments/form-requirements',
      ),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch a single appointment by ID.
 */
export function useAppointment(appointmentId: string) {
  return useQuery({
    queryKey: appointmentKeys.detail(appointmentId),
    queryFn: async () => {
      const data = await apiGet<Appointment>(
        `/appointments/${appointmentId}`
      );
      return data;
    },
    enabled: !!appointmentId,
    staleTime: 30000,
  });
}

/**
 * Mutation for creating an appointment.
 * Invalidates the appointments list on success.
 */
export function useCreateAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: AppointmentRequest) => {
      const data = await apiPost<Appointment>('/appointments', request);
      return data;
    },
    onSuccess: (newAppointment) => {
      // Invalidate all appointments lists
      queryClient.invalidateQueries({ queryKey: appointmentKeys.lists() });
      // Optionally cache the new appointment
      queryClient.setQueryData(
        appointmentKeys.detail(newAppointment.id),
        newAppointment
      );
    },
  });
}

/**
 * Mutation for updating an appointment.
 * Invalidates the appointments list and the specific appointment on success.
 */
export function useUpdateAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      appointmentId,
      data,
    }: {
      appointmentId: string;
      data: Partial<AppointmentRequest>;
    }) => {
      const result = await apiPatch<Appointment>(
        `/appointments/${appointmentId}`,
        data
      );
      return result;
    },
    onSuccess: (updatedAppointment) => {
      // Invalidate all appointments lists
      queryClient.invalidateQueries({ queryKey: appointmentKeys.lists() });
      // Update the specific appointment in cache
      queryClient.setQueryData(
        appointmentKeys.detail(updatedAppointment.id),
        updatedAppointment
      );
    },
  });
}

/**
 * Mutation for `POST /v1/appointments/{appointment_id}/check-in`.
 *
 * Converts a SCHEDULED appointment into a live visit-session check-in.
 * The body is optional — every field overrides the matching value on
 * the appointment / linked visitor profile, so an empty `{}` is fine
 * when nothing needs correction at the desk.
 *
 * On success with `issueBadge !== false` (the default): the response
 * includes `badgeQrToken` and `badgePdfBase64`, the visit-session is
 * `checked_in`, and the appointment transitions to `checked_in`.
 *
 * On success with `issueBadge === false`: the session is `registered`
 * and the appointment stays `scheduled` until the badge is later
 * issued via `POST /v1/visitors/check-in/{session_id}/confirm`.
 *
 * Invalidates appointments, visitors, checkins, and the unified
 * pending-approvals queue so receptionist UI updates everywhere.
 */
export function useCheckInFromAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      appointmentId: string;
      body?: AppointmentCheckInRequest;
    }) => {
      const data = await apiPost<AppointmentCheckInResponse>(
        `/appointments/${args.appointmentId}/check-in`,
        args.body ?? {},
      );
      return data;
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: appointmentKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: appointmentKeys.detail(response.appointmentId),
      });
      // The unified pending-approvals queue and the legacy checkins list
      // both live under ['checkins']; invalidate the namespace.
      queryClient.invalidateQueries({ queryKey: ['checkins'] });
      // The new visit-session shows up under visitors.
      queryClient.invalidateQueries({ queryKey: ['visitors'] });
    },
  });
}

/**
 * Mutation for deleting an appointment.
 * Invalidates the appointments list on success.
 */
export function useDeleteAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (appointmentId: string) => {
      await apiDelete(`/appointments/${appointmentId}`);
    },
    onSuccess: (_, appointmentId) => {
      // Invalidate all appointments lists
      queryClient.invalidateQueries({ queryKey: appointmentKeys.lists() });
      // Remove the deleted appointment from cache
      queryClient.removeQueries({
        queryKey: appointmentKeys.detail(appointmentId),
      });
    },
  });
}

/**
 * Bulk cancel / delete appointments per tables.txt §2.4.
 */
export function useBulkAppointmentAction(action: "cancel" | "delete") {
  const queryClient = useQueryClient();
  return useMutation<
    BulkJobResult,
    Error,
    { ids: string[]; reason?: string; atomic?: boolean }
  >({
    mutationFn: ({ ids, reason, atomic }) =>
      bulkAction(`/appointments/bulk/${action}`, ids, {
        atomic,
        extras: action === "cancel" && reason ? { reason } : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentKeys.lists() });
    },
  });
}
