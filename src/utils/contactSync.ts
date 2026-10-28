import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  getDocs,
  Unsubscribe,
} from 'firebase/firestore';
import { db, testFirestoreConnection } from '../lib/firebase';
import { CollaboratorContact } from '../types/contact';
import { getAllInitialContacts, saveContactsToStorage } from './contactStorage';

const CONTACTS_COLLECTION = 'contacts';

/**
 * Sanitizes contact ID to be safe for Firestore document keys and rule matching
 */
export function toSafeContactDocId(id: string): string {
  if (!id) return `contact_${Date.now()}`;
  return id.replace(/[^a-zA-Z0-9_\-.:]/g, '_').slice(0, 120);
}

/**
 * Normalizes contact object for clean Firestore storage
 */
export function normalizeContactForCloud(contact: CollaboratorContact): Record<string, any> {
  const safeId = toSafeContactDocId(contact.id);
  const now = new Date().toISOString();

  const payload: Record<string, any> = {
    id: safeId,
    name: contact.name.trim(),
    phone: contact.phone.trim(),
    email: contact.email.trim(),
    createdAt: contact.createdAt || now,
    updatedAt: now,
  };

  if (contact.mechanicalNumber?.trim()) {
    payload.mechanicalNumber = contact.mechanicalNumber.trim();
  }
  if (contact.department?.trim()) {
    payload.department = contact.department.trim();
  }
  if (contact.category?.trim()) {
    payload.category = contact.category.trim();
  }
  if (contact.notes?.trim()) {
    payload.notes = contact.notes.trim();
  }
  if (Array.isArray(contact.secondaryPhones) && contact.secondaryPhones.length > 0) {
    payload.secondaryPhones = contact.secondaryPhones.map((p) => String(p).trim()).filter(Boolean);
  }
  if (Array.isArray(contact.secondaryEmails) && contact.secondaryEmails.length > 0) {
    payload.secondaryEmails = contact.secondaryEmails.map((e) => String(e).trim()).filter(Boolean);
  }
  if (Array.isArray(contact.allPhones) && contact.allPhones.length > 0) {
    payload.allPhones = contact.allPhones.map((item) => ({
      number: String(item.number || '').trim(),
      isWhatsApp: Boolean(item.isWhatsApp),
      label: String(item.label || '').trim(),
    }));
  }

  return payload;
}

/**
 * Subscribes to real-time contact changes from Firestore.
 * Automatically propagates updates across all connected and hosted systems.
 */
export function subscribeToCloudContacts(
  onContactsUpdate: (contacts: CollaboratorContact[]) => void,
  onStatusChange?: (status: 'connecting' | 'synced' | 'error', details?: string) => void
): Unsubscribe {
  onStatusChange?.('connecting');
  const contactsCol = collection(db, CONTACTS_COLLECTION);

  // Test server connectivity on setup
  testFirestoreConnection().catch((e) => {
    console.warn('Initial Firestore connection check failed:', e);
  });

  const unsubscribe = onSnapshot(
    contactsCol,
    async (snapshot) => {
      // If collection is completely empty in cloud, seed with initial defaults once
      if (snapshot.empty) {
        try {
          const defaults = getAllInitialContacts();
          await saveBatchContactsToCloud(defaults);
          onContactsUpdate(defaults);
          saveContactsToStorage(defaults);
          onStatusChange?.('synced', `${defaults.length} contactos sincronizados na nuvem`);
          return;
        } catch (seedErr: any) {
          console.warn('Could not auto-seed cloud contacts:', seedErr);
        }
      }

      const cloudContacts: CollaboratorContact[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        cloudContacts.push({
          id: data.id || docSnap.id,
          name: data.name || '',
          mechanicalNumber: data.mechanicalNumber,
          phone: data.phone || '',
          secondaryPhones: Array.isArray(data.secondaryPhones) ? data.secondaryPhones : [],
          allPhones: Array.isArray(data.allPhones) ? data.allPhones : [],
          email: data.email || '',
          secondaryEmails: Array.isArray(data.secondaryEmails) ? data.secondaryEmails : [],
          department: data.department,
          category: data.category,
          notes: data.notes,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        });
      });

      // Sort alphabetically by employee name
      cloudContacts.sort((a, b) => a.name.localeCompare(b.name, 'pt-PT'));

      // Cache locally for offline resilience
      saveContactsToStorage(cloudContacts);

      onContactsUpdate(cloudContacts);
      onStatusChange?.('synced', `${cloudContacts.length} contactos sincronizados`);
    },
    (error) => {
      console.error('Firestore contact subscription error:', error);
      onStatusChange?.('error', error.message);
    }
  );

  return unsubscribe;
}

/**
 * Saves or updates a single contact in the cloud database
 */
export async function saveContactToCloud(contact: CollaboratorContact): Promise<void> {
  const safeId = toSafeContactDocId(contact.id);
  const contactDocRef = doc(db, CONTACTS_COLLECTION, safeId);
  const data = normalizeContactForCloud(contact);
  await setDoc(contactDocRef, data, { merge: true });
}

/**
 * Saves multiple contacts in batch to Firestore (splits in chunks of 400 for safety)
 */
export async function saveBatchContactsToCloud(contacts: CollaboratorContact[]): Promise<void> {
  if (!contacts || contacts.length === 0) return;

  const chunkSize = 400;
  for (let i = 0; i < contacts.length; i += chunkSize) {
    const chunk = contacts.slice(i, i + chunkSize);
    const batch = writeBatch(db);

    chunk.forEach((c) => {
      const safeId = toSafeContactDocId(c.id);
      const docRef = doc(db, CONTACTS_COLLECTION, safeId);
      const data = normalizeContactForCloud(c);
      batch.set(docRef, data, { merge: true });
    });

    await batch.commit();
  }
}

/**
 * Deletes a contact from the cloud database
 */
export async function deleteContactFromCloud(contactId: string): Promise<void> {
  const safeId = toSafeContactDocId(contactId);
  const docRef = doc(db, CONTACTS_COLLECTION, safeId);
  await deleteDoc(docRef);
}

/**
 * Deletes multiple contacts from the cloud database
 */
export async function deleteMultipleContactsFromCloud(contactIds: string[]): Promise<void> {
  if (!contactIds || contactIds.length === 0) return;

  const chunkSize = 400;
  for (let i = 0; i < contactIds.length; i += chunkSize) {
    const chunk = contactIds.slice(i, i + chunkSize);
    const batch = writeBatch(db);

    chunk.forEach((id) => {
      const safeId = toSafeContactDocId(id);
      const docRef = doc(db, CONTACTS_COLLECTION, safeId);
      batch.delete(docRef);
    });

    await batch.commit();
  }
}
