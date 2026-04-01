import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  limit,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getPersistenceMode, readsFromPostgres } from '@/lib/db/persistence'
import { generateId } from '@/lib/db/utils'
import { runMirroredWrite } from '@/lib/persistence/writeMirror'
import { MessageRepository } from '@/lib/repositories/messageRepository'
import { CreateMessageData, MessageRecord } from '@/types/database'

const MESSAGES_COLLECTION = 'messages'

function stripUndefinedFields<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  ) as T
}

function firestoreDocToMessage(docSnap: { id: string; data: () => Record<string, unknown> }): MessageRecord {
  const data = docSnap.data()
  return {
    id: docSnap.id,
    agentId: data.agentId as string || '',
    content: data.content as string || '',
    type: (data.type as MessageRecord['type']) || 'user',
    timestamp: data.timestamp as string || new Date().toISOString(),
    roomId: data.roomId as string | undefined,
    metadata: data.metadata as Record<string, unknown> | undefined,
    userId: data.userId as string | undefined,
  }
}

function messageToFirestoreDoc(message: MessageRecord): Record<string, unknown> {
  return stripUndefinedFields({
    agentId: message.agentId,
    content: message.content,
    type: message.type,
    roomId: message.roomId,
    metadata: message.metadata,
    userId: message.userId,
    timestamp: message.timestamp,
  })
}

async function getMessageByIdFromFirestore(id: string): Promise<MessageRecord | null> {
  const docSnap = await getDoc(doc(db, MESSAGES_COLLECTION, id))
  return docSnap.exists() ? firestoreDocToMessage(docSnap) : null
}

async function getMessagesByAgentIdFromFirestore(agentId: string): Promise<MessageRecord[]> {
  const snapshot = await getDocs(query(
    collection(db, MESSAGES_COLLECTION),
    where('agentId', '==', agentId),
    orderBy('timestamp', 'asc')
  ))
  return snapshot.docs.map(firestoreDocToMessage)
}

async function getMessagesByRoomIdFromFirestore(roomId: string): Promise<MessageRecord[]> {
  const snapshot = await getDocs(query(
    collection(db, MESSAGES_COLLECTION),
    where('roomId', '==', roomId),
    orderBy('timestamp', 'asc')
  ))
  return snapshot.docs.map(firestoreDocToMessage)
}

async function getRecentMessagesFromFirestore(limitCount: number): Promise<MessageRecord[]> {
  const snapshot = await getDocs(query(
    collection(db, MESSAGES_COLLECTION),
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  ))
  return snapshot.docs.map(firestoreDocToMessage).reverse()
}

async function upsertMessageInFirestore(message: MessageRecord): Promise<void> {
  await setDoc(doc(db, MESSAGES_COLLECTION, message.id), messageToFirestoreDoc(message))
}

async function updateMessageInFirestore(id: string, updates: Partial<MessageRecord>): Promise<void> {
  await updateDoc(doc(db, MESSAGES_COLLECTION, id), stripUndefinedFields({
    content: updates.content,
    type: updates.type,
    roomId: updates.roomId,
    metadata: updates.metadata,
    userId: updates.userId,
    timestamp: updates.timestamp,
  }))
}

async function deleteMessageInFirestore(id: string): Promise<void> {
  await deleteDoc(doc(db, MESSAGES_COLLECTION, id))
}

export class MessageService {
  static async getAllMessages(): Promise<MessageRecord[]> {
    try {
      if (readsFromPostgres(getPersistenceMode())) {
        return MessageRepository.listAll()
      }

      return getRecentMessagesFromFirestore(500)
    } catch (error) {
      console.error('Error fetching messages:', error)
      return []
    }
  }

  static async getMessageById(id: string): Promise<MessageRecord | null> {
    try {
      if (readsFromPostgres(getPersistenceMode())) {
        return MessageRepository.getById(id)
      }

      return getMessageByIdFromFirestore(id)
    } catch (error) {
      console.error('Error fetching message:', error)
      return null
    }
  }

  static async getMessagesByAgentId(agentId: string): Promise<MessageRecord[]> {
    try {
      if (readsFromPostgres(getPersistenceMode())) {
        return MessageRepository.listByAgentId(agentId)
      }

      return getMessagesByAgentIdFromFirestore(agentId)
    } catch (error) {
      console.error('Error fetching messages by agent:', error)
      return []
    }
  }

  static async getMessagesByRoomId(roomId: string): Promise<MessageRecord[]> {
    try {
      if (readsFromPostgres(getPersistenceMode())) {
        return MessageRepository.listByRoomId(roomId)
      }

      return getMessagesByRoomIdFromFirestore(roomId)
    } catch (error) {
      console.error('Error fetching messages by room:', error)
      return []
    }
  }

  static async getRecentMessages(limitCount: number = 50): Promise<MessageRecord[]> {
    try {
      if (readsFromPostgres(getPersistenceMode())) {
        return MessageRepository.listRecent(limitCount)
      }

      return getRecentMessagesFromFirestore(limitCount)
    } catch (error) {
      console.error('Error fetching recent messages:', error)
      return []
    }
  }

  static async createMessage(messageData: CreateMessageData): Promise<MessageRecord | null> {
    try {
      const record: MessageRecord = {
        id: generateId('message'),
        agentId: messageData.agentId,
        content: messageData.content,
        type: messageData.type,
        roomId: messageData.roomId,
        metadata: messageData.metadata,
        userId: messageData.userId,
        timestamp: new Date().toISOString(),
      }

      const mode = getPersistenceMode()
      if (mode === 'firestore') {
        await upsertMessageInFirestore(record)
        return record
      }

      if (mode === 'dual-write-firestore-read') {
        return runMirroredWrite({
          entityType: 'message',
          entityId: record.id,
          operation: 'create',
          payload: messageToFirestoreDoc(record),
          primary: async () => {
            await upsertMessageInFirestore(record)
            return record
          },
          secondary: async () => {
            await MessageRepository.create(record)
          },
        })
      }

      return runMirroredWrite({
        entityType: 'message',
        entityId: record.id,
        operation: 'create',
        payload: messageToFirestoreDoc(record),
        primary: async () => MessageRepository.create(record),
        secondary: mode === 'dual-write-postgres-read'
          ? async () => {
              await upsertMessageInFirestore(record)
            }
          : undefined,
      })
    } catch (error) {
      console.error('Error creating message:', error)
      return null
    }
  }

  static async updateMessage(id: string, updates: Partial<MessageRecord>): Promise<boolean> {
    try {
      const mode = getPersistenceMode()

      if (mode === 'firestore') {
        await updateMessageInFirestore(id, updates)
        return true
      }

      if (mode === 'dual-write-firestore-read') {
        await runMirroredWrite({
          entityType: 'message',
          entityId: id,
          operation: 'update',
          payload: updates as Record<string, unknown>,
          primary: async () => {
            await updateMessageInFirestore(id, updates)
            return true
          },
          secondary: async () => {
            await MessageRepository.update(id, updates)
          },
        })
        return true
      }

      await runMirroredWrite({
        entityType: 'message',
        entityId: id,
        operation: 'update',
        payload: updates as Record<string, unknown>,
        primary: async () => MessageRepository.update(id, updates),
        secondary: mode === 'dual-write-postgres-read'
          ? async () => {
              await updateMessageInFirestore(id, updates)
            }
          : undefined,
      })
      return true
    } catch (error) {
      console.error('Error updating message:', error)
      return false
    }
  }

  static async deleteMessage(id: string): Promise<boolean> {
    try {
      const mode = getPersistenceMode()

      if (mode === 'firestore') {
        await deleteMessageInFirestore(id)
        return true
      }

      if (mode === 'dual-write-firestore-read') {
        await runMirroredWrite({
          entityType: 'message',
          entityId: id,
          operation: 'delete',
          payload: { id },
          primary: async () => {
            await deleteMessageInFirestore(id)
            return true
          },
          secondary: async () => {
            await MessageRepository.delete(id)
          },
        })
        return true
      }

      await runMirroredWrite({
        entityType: 'message',
        entityId: id,
        operation: 'delete',
        payload: { id },
        primary: async () => MessageRepository.delete(id),
        secondary: mode === 'dual-write-postgres-read'
          ? async () => {
              await deleteMessageInFirestore(id)
            }
          : undefined,
      })
      return true
    } catch (error) {
      console.error('Error deleting message:', error)
      return false
    }
  }
}
