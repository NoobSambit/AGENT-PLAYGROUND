import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { MessageService } from '@/lib/services/messageService'
import { generateAgentResponse } from '@/utils/llm'
import { CreateMessageData } from '@/types/database'

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
          let messages
          if (roomId) {
            messages = await MessageService.getMessagesByRoomId(roomId)
          } else {
            messages = await MessageService.getRecentMessages(100)
          }
          set({ messages })
        } catch (error) {
          console.error('Failed to fetch messages:', error)
        } finally {
          set({ loading: false })
        }
      },

      sendMessage: async (content, agentId, metadata, type = 'user') => {
        try {
          const messageData: CreateMessageData = {
            agentId,
            content,
            type,
            metadata: metadata || undefined,
          }

          const newMessage = await MessageService.createMessage(messageData)
          if (newMessage) {
            // Convert MessageRecord to Message format
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

            // If this is a user message, trigger real AI response
            if (type === 'user') {
                  // Get agent info for context
                  const { useAgentStore } = await import('@/stores/agentStore')
                  const agent = useAgentStore.getState().agents.find((a: { id: string }) => a.id === agentId)

              if (agent) {
                // Get recent conversation history for context
                const recentMessages = get().messages
                  .filter(msg => msg.agentId === agentId)
                  .slice(-10) // Last 10 messages for context
                  .map(msg => ({
                    role: msg.type === 'user' ? 'user' as const : 'assistant' as const,
                    content: msg.content
                  }))

                try {
                  const aiResponse = await generateAgentResponse(content, agent.persona, agent.goals, recentMessages)

                  const aiMessageData: CreateMessageData = {
                    agentId,
                    content: aiResponse.content,
                    type: 'agent',
                    roomId: message.roomId || undefined,
                  }

                  const aiMessage = await MessageService.createMessage(aiMessageData)
                  if (aiMessage) {
                    get().addMessage(aiMessage)
                  }
                } catch (error) {
                  console.error('Failed to generate AI response:', error)
                }
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
            const roomMessages = await MessageService.getMessagesByRoomId(roomId)
            // Delete each message (in a real implementation, you'd want a batch delete)
            for (const message of roomMessages) {
              await MessageService.deleteMessage(message.id)
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
