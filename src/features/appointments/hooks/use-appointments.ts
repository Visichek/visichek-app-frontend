'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api/request';
import type { Appointment, AppointmentRequest } from '@/types/visitor';

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
 * Fetch all appointments with optional filters.
 */
export function useAppointments(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: appointmentKeys.list(filters),
    queryFn: async () => {
      const data = await apiGet<Appointment[]>('/v1/appointments/', filters);
      return data;
    },
    staleTime: 30000,
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
        `/v1/appointments/${appointmentId}`
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
      const data = await apiPost<Appointment>('/v1/appointments/', request);
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
        `/v1/appointments/${appointmentId}`,
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
 * Mutation for deleting an appointment.
 * Invalidates the appointments list on success.
 */
export function useDeleteAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (appointmentId: string) => {
      await apiDelete(`/v1/appointments/${appointmentId}`);
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
