import { useEffect } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { forgetConversationMessages } from '@/crypto'
import { useAuth } from '@/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import type {
  ConversationRow,
  ConversationStatus,
  ProfileRow,
} from '@/types/db'

export interface ConversationSummary {
  id: string
  status: ConversationStatus
  peer: ProfileRow | null
  /** 'inviter' = I sent the request; 'invitee' = I was invited. */
  role: 'inviter' | 'invitee'
  lastActivityAt: string
  endedBy: string | null
  unread: number
}

const KEY = ['conversations'] as const

async function fetchConversations(userId: string): Promise<ConversationSummary[]> {
  const { data: rows, error } = await supabase
    .from('conversations')
    .select('*')
    .order('last_activity_at', { ascending: false })
  if (error) throw error
  const convos = (rows ?? []) as ConversationRow[]

  const peerIds = [
    ...new Set(
      convos.map((c) =>
        c.created_by === userId ? c.requested_user_id : c.created_by,
      ),
    ),
  ]

  const profileById = new Map<string, ProfileRow>()
  if (peerIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', peerIds)
    for (const p of (profiles ?? []) as ProfileRow[]) profileById.set(p.id, p)
  }

  const unreadByConversation = new Map<string, number>()
  const { data: unreadRows } = await supabase
    .from('messages')
    .select('conversation_id')
    .is('first_read_at', null)
    .neq('sender_user_id', userId)
  for (const row of (unreadRows ?? []) as { conversation_id: string }[]) {
    unreadByConversation.set(
      row.conversation_id,
      (unreadByConversation.get(row.conversation_id) ?? 0) + 1,
    )
  }

  return convos.map((c) => {
    const peerId = c.created_by === userId ? c.requested_user_id : c.created_by
    return {
      id: c.id,
      status: c.status,
      peer: profileById.get(peerId) ?? null,
      role: c.created_by === userId ? 'inviter' : 'invitee',
      lastActivityAt: c.last_activity_at,
      endedBy: c.ended_by,
      unread: unreadByConversation.get(c.id) ?? 0,
    }
  })
}

export function useConversations() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: [...KEY, user?.id],
    queryFn: () => fetchConversations(user!.id),
    enabled: Boolean(user),
  })

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('conversations-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => queryClient.invalidateQueries({ queryKey: KEY }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => queryClient.invalidateQueries({ queryKey: KEY }),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user, queryClient])

  return query
}

export function useRequestConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (username: string) => {
      const { data, error } = await supabase.rpc('request_conversation', {
        other_username: username,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useRespondToRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: { conversation: string; accept: boolean }) => {
      const { error } = await supabase.rpc('respond_to_request', args)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useLeaveConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (conversation: string) => {
      const { error } = await supabase.rpc('leave_conversation', { conversation })
      if (error) throw error
      await forgetConversationMessages(conversation)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}
