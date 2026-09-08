import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { currentDevice } from '@/crypto'
import { useAuth } from '@/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import type { DeviceRow } from '@/types/db'

const KEY = ['devices'] as const

export function useMyDevices() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...KEY, user?.id],
    enabled: Boolean(user),
    // The device row is created moments after first sign-in; don't serve a
    // stale empty list from before it existed.
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as DeviceRow[]
    },
  })
}

export function useRenameDevice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: { id: string; label: string }) => {
      const { error } = await supabase
        .from('devices')
        .update({ label: args.label.trim().slice(0, 60) })
        .eq('id', args.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useRevokeDevice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (id === currentDevice()?.deviceId) {
        throw new Error(
          'That is this device. Use “Forget this device” below instead.',
        )
      }
      // Hard delete so it leaves the list immediately and can never be used
      // again. `.select()` lets us tell a real deletion from an RLS no-op.
      const { data, error } = await supabase
        .from('devices')
        .delete()
        .eq('id', id)
        .select('id')
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error(
          'Could not remove that device — it may already be gone, or you don’t have permission.',
        )
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}
