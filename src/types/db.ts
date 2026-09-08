/**
 * Hand-written mirror of the Postgres schema in `supabase/migrations`.
 * Regenerate with `supabase gen types typescript` once the CLI is wired up;
 * until then keep this in sync by hand.
 *
 * NB: these are `type` aliases, not `interface`s, on purpose — supabase-js
 * requires each row type to be assignable to `Record<string, unknown>`, which
 * interfaces are not.
 */

export type ConversationStatus = 'pending' | 'active' | 'declined' | 'ended'

/** Olm message type: 0 = pre-key (session-establishing), 1 = normal ratchet. */
export type OlmMessageType = 0 | 1

export type ProfileRow = {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  created_at: string
}

export type DeviceRow = {
  id: string
  user_id: string
  identity_key: string
  signing_key: string
  signed_prekey: string
  signed_prekey_sig: string
  label: string
  created_at: string
  last_seen_at: string
  revoked_at: string | null
}

export type OneTimePrekeyRow = {
  id: string
  device_id: string
  key_id: string
  prekey: string
  created_at: string
}

export type ConversationRow = {
  id: string
  created_by: string
  requested_user_id: string
  status: ConversationStatus
  created_at: string
  responded_at: string | null
  ended_at: string | null
  ended_by: string | null
  last_activity_at: string
}

export type ConversationParticipantRow = {
  conversation_id: string
  user_id: string
  added_at: string
}

export type MessageRow = {
  id: string
  conversation_id: string
  sender_user_id: string
  sender_device_id: string
  created_at: string
  delivered_at: string | null
  first_read_at: string | null
  expires_at: string | null
}

export type MessagePayloadRow = {
  id: string
  message_id: string
  recipient_device_id: string
  olm_type: OlmMessageType
  ciphertext: string
}

export type PushSubscriptionRow = {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  created_at: string
}

type TableFor<T> = {
  Row: T
  Insert: Partial<T>
  Update: Partial<T>
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      profiles: TableFor<ProfileRow>
      devices: TableFor<DeviceRow>
      one_time_prekeys: TableFor<OneTimePrekeyRow>
      conversations: TableFor<ConversationRow>
      conversation_participants: TableFor<ConversationParticipantRow>
      messages: TableFor<MessageRow>
      message_payloads: TableFor<MessagePayloadRow>
      push_subscriptions: TableFor<PushSubscriptionRow>
    }
    Views: Record<string, never>
    Functions: {
      check_username: { Args: { name: string }; Returns: boolean }
      claim_prekey: {
        Args: { target_device: string }
        Returns: { key_id: string; prekey: string }[]
      }
      mark_read: { Args: { msg: string }; Returns: string | null }
      purge_message: { Args: { msg: string }; Returns: undefined }
      request_conversation: { Args: { other_username: string }; Returns: string }
      respond_to_request: {
        Args: { conversation: string; accept: boolean }
        Returns: undefined
      }
      leave_conversation: { Args: { conversation: string }; Returns: undefined }
    }
    Enums: {
      conversation_status: ConversationStatus
    }
    CompositeTypes: Record<string, never>
  }
}
