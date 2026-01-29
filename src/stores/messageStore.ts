import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { CreateMessageData } from '@/types/database'
import { useAgentStore } from '@/stores/agentStore'

export interface Message {
  id: string
  agentId: string
  content: string
  timestamp: string
  type: 'user' | 'agent' | 'system'
  roomId?: string
  metadata?: Record<string, unknown>
}

interface MessageState {
  messages: Message[]
  currentRoomId: string | null
  loading: boolean

  // Actions
  setMessages: (messages: Message[]) => void
  addMessage: (message: Message) => void
  setCurrentRoom: (roomId: string | null) => void
  setLoading: (loading: boolean) => void

  // Firestore-backed functions
  fetchMessages: (roomId?: string) => Promise<void>
  fetchMessagesByAgentId: (agentId: string) => Promise<void>
  sendMessage: (content: string, agentId: string, metadata?: Record<string, unknown>, type?: Message['type']) => Promise<void>
  clearMessages: (roomId?: string) => Promise<void>
}

export const useMessageStore = create<MessageState>()(
  devtools(
    (set, get) => ({
      messages: [],
      currentRoomId: null,
      loading: false,

      setMessages: (messages) => set({ messages }),

      addMessage: (message) => set((state) => ({
        messages: [...state.messages, message]
      })),

      setCurrentRoom: (roomId) => set({ currentRoomId: roomId }),

      setLoading: (loading) => set({ loading }),

      // Firestore-backed functions
      fetchMessages: async (roomId) => {
        set({ loading: true })
        try {
          const params = new URLSearchParams()
          if (roomId) {
            params.set('roomId', roomId)
          } else {
            params.set('limit', '100')
          }

          const response = await fetch(`/api/messages?${params.toString()}`)
          if (response.ok) {
            const data = await response.json()
            set({ messages: data.data || [] })
          } else {
            set({ messages: [] })
          }
        } catch (error) {
          console.error('Failed to fetch messages:', error)
        } finally {
          set({ loading: false })
        }
      },

      fetchMessagesByAgentId: async (agentId) => {
        set({ loading: true })
        try {
          const response = await fetch(`/api/messages?agentId=${encodeURIComponent(agentId)}`)
          if (response.ok) {
            const data = await response.json()
            set({ messages: data.data || [] })
          } else {
            set({ messages: [] })
          }
        } catch (error) {
          console.error('Failed to fetch messages by agent:', error)
        } finally {
          set({ loading: false })
        }
      },

      sendMessage: async (content, agentId, metadata, type = 'user') => {
        try {
          if (!content.trim()) {
            return
          }

          const messageData: CreateMessageData = {
            agentId,
            content,
            type,
            metadata: metadata || undefined,
          }

          const response = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messageData)
          })

          if (response.ok) {
            const data = await response.json()
            const newMessage = data.data
            if (newMessage) {
              const message: Message = {
                id: newMessage.id,
                agentId: newMessage.agentId,
                content: newMessage.content,
                timestamp: newMessage.timestamp,
                type: newMessage.type,
                roomId: newMessage.roomId,
                metadata: newMessage.metadata
              }
              get().addMessage(message)
            }
            if (data.agent) {
              const agentStore = useAgentStore.getState()
              agentStore.updateAgent(data.agent.id, data.agent)
              if (agentStore.currentAgent?.id === data.agent.id) {
                agentStore.setCurrentAgent(data.agent)
              }
            }
          }
        } catch (error) {
          console.error('Failed to send message:', error)
        }
      },

      clearMessages: async (roomId) => {
        try {
          if (roomId) {
            // Get all messages for this room
            const response = await fetch(`/api/messages?roomId=${encodeURIComponent(roomId)}`)
            const data = response.ok ? await response.json() : { data: [] }
            const roomMessages = data.data || []
            // Delete each message (in a real implementation, you'd want a batch delete)
            for (const message of roomMessages) {
              await fetch(`/api/messages?id=${encodeURIComponent(message.id)}`, {
                method: 'DELETE'
              })
            }
            set((state) => ({
              messages: state.messages.filter((msg) => msg.roomId !== roomId),
            }))
          } else {
            set({ messages: [] })
          }
        } catch (error) {
          console.error('Failed to clear messages:', error)
        }
      },
    }),
    {
      name: 'message-store',
    }
  )
)
