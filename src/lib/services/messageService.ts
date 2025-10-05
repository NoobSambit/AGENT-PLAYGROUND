import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { MessageRecord, MessageDocument, CreateMessageData } from '@/types/database'

const MESSAGES_COLLECTION = 'messages'

// Convert Firestore document to MessageRecord
function firestoreDocToMessage(doc: { id: string; data: () => Record<string, unknown> }): MessageRecord {
  const data = doc.data()
  return {
    id: doc.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    agentId: (data as any).agentId || '',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: (data as any).content || '',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type: (data as any).type || 'user',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    timestamp: (data as any).timestamp?.toDate?.()?.toISOString() || (data as any).timestamp || new Date().toISOString(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    roomId: (data as any).roomId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: (data as any).metadata,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    userId: (data as any).userId
  }
}

// Convert MessageRecord to Firestore document
function messageToFirestoreDoc(message: CreateMessageData): Omit<MessageDocument, 'timestamp'> & { timestamp?: Timestamp } {
  return {
    agentId: message.agentId,
    content: message.content,
    type: message.type,
    roomId: message.roomId,
    metadata: message.metadata,
    userId: message.userId,
    timestamp: Timestamp.now()
  }
}

export class MessageService {
  // Get all messages
  static async getAllMessages(): Promise<MessageRecord[]> {
    try {
      const q = query(
        collection(db, MESSAGES_COLLECTION),
        orderBy('timestamp', 'desc')
      )

      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(firestoreDocToMessage)
    } catch (error) {
      console.error('Error fetching messages:', error)
      return []
    }
  }

  // Get message by ID
  static async getMessageById(id: string): Promise<MessageRecord | null> {
    try {
      const docRef = doc(db, MESSAGES_COLLECTION, id)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        return firestoreDocToMessage(docSnap)
      }
      return null
    } catch (error) {
      console.error('Error fetching message:', error)
      return null
    }
  }

  // Get messages by agent ID
  static async getMessagesByAgentId(agentId: string): Promise<MessageRecord[]> {
    try {
      const q = query(
        collection(db, MESSAGES_COLLECTION),
        where('agentId', '==', agentId),
        orderBy('timestamp', 'desc')
      )

      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(firestoreDocToMessage)
    } catch (error) {
      console.error('Error fetching messages by agent:', error)
      return []
    }
  }

  // Get messages by room ID
  static async getMessagesByRoomId(roomId: string): Promise<MessageRecord[]> {
    try {
      const q = query(
        collection(db, MESSAGES_COLLECTION),
        where('roomId', '==', roomId),
        orderBy('timestamp', 'desc')
      )

      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(firestoreDocToMessage)
    } catch (error) {
      console.error('Error fetching messages by room:', error)
      return []
    }
  }

  // Get recent messages (last N messages)
  static async getRecentMessages(limitCount: number = 50): Promise<MessageRecord[]> {
    try {
      const q = query(
        collection(db, MESSAGES_COLLECTION),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      )

      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(firestoreDocToMessage).reverse() // Reverse to get chronological order
    } catch (error) {
      console.error('Error fetching recent messages:', error)
      return []
    }
  }

  // Create new message
  static async createMessage(messageData: CreateMessageData): Promise<MessageRecord | null> {
    try {
      const docData = messageToFirestoreDoc(messageData)
      const docRef = await addDoc(collection(db, MESSAGES_COLLECTION), docData)
      return await this.getMessageById(docRef.id)
    } catch (error) {
      console.error('Error creating message:', error)
      return null
    }
  }

  // Update message
  static async updateMessage(id: string, updates: Partial<MessageDocument>): Promise<boolean> {
    try {
      const docRef = doc(db, MESSAGES_COLLECTION, id)
      await updateDoc(docRef, {
        ...updates,
        timestamp: Timestamp.now()
      })
      return true
    } catch (error) {
      console.error('Error updating message:', error)
      return false
    }
  }

  // Delete message
  static async deleteMessage(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(db, MESSAGES_COLLECTION, id))
      return true
    } catch (error) {
      console.error('Error deleting message:', error)
      return false
    }
  }
}
