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
import { CollaboratorContact, ContactPhoneItem } from '../types/contact';
import { getAllInitialContacts, loadContactsFromStorage, saveContactsToStorage } from './contactStorage';

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
 * Intelligently merges two lists of contacts without losing any contact or detail.
 * Matches by mechanical number, normalized name, or unique ID.
 */
export function mergeContactLists(
  listA: CollaboratorContact[],
  listB: CollaboratorContact[]
): CollaboratorContact[] {
  const map = new Map<string, CollaboratorContact>();

  const getMatchKey = (c: CollaboratorContact): string => {
    if (c.mechanicalNumber?.trim()) {
      const mecanDigits = c.mechanicalNumber.replace(/\D/g, '');
      if (mecanDigits) return `mecan_${mecanDigits}`;
    }
    const normName = c.name
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (normName) return `name_${normName}`;
    return `id_${c.id}`;
  };

  // Insert list A
  listA.forEach((c) => {
    const key = getMatchKey(c);
    map.set(key, { ...c });
  });

  // Merge list B
  listB.forEach((c) => {
    const key = getMatchKey(c);
    if (!map.has(key)) {
      map.set(key, { ...c });
    } else {
      const existing = map.get(key)!;
      const phone = c.phone?.trim() ? c.phone : existing.phone;
      const email = c.email?.trim() ? c.email : existing.email;
      const department = c.department?.trim() ? c.department : existing.department;
      const category = c.category?.trim() ? c.category : existing.category;
      const mechanicalNumber = c.mechanicalNumber?.trim() ? c.mechanicalNumber : existing.mechanicalNumber;
      const notes = c.notes?.trim() ? c.notes : existing.notes;

      // Merge secondary phones
      const mergedSecondary = Array.from(
        new Set([
          ...(existing.secondaryPhones || []),
          ...(c.secondaryPhones || []),
          ...(existing.phone && phone && existing.phone !== phone ? [existing.phone] : []),
        ])
      ).filter(Boolean);

      // Merge allPhones
      const seenPhoneNumbers = new Set<string>();
      const combinedAllPhones: ContactPhoneItem[] = [];
      [...(c.allPhones || []), ...(existing.allPhones || [])].forEach((p) => {
        const clean = (p.number || '').replace(/\D/g, '');
        if (clean && !seenPhoneNumbers.has(clean)) {
          seenPhoneNumbers.add(clean);
          combinedAllPhones.push(p);
        }
      });

      map.set(key, {
        ...existing,
        ...c,
        phone,
        email,
        department,
        category,
        mechanicalNumber,
        notes,
        secondaryPhones: mergedSecondary,
        allPhones: combinedAllPhones.length > 0 ? combinedAllPhones : existing.allPhones,
        updatedAt: new Date().toISOString(),
      });
    }
  });

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-PT'));
}

/**
 * Subscribes to real-time contact changes from Firestore.
 * Automatically merges cloud contacts with local storage so no local contacts (e.g. 467 contacts)
 * are ever overwritten or lost, and propagates updates across all connected platforms.
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

  let isFirstSync = true;

  const unsubscribe = onSnapshot(
    contactsCol,
    async (snapshot) => {
      try {
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

        // Always load existing local contacts from storage
        const localContacts = loadContactsFromStorage();

        // Bidirectionally merge cloud contacts with local contacts
        const mergedContacts = mergeContactLists(localContacts, cloudContacts);

        // Check if there are local contacts that need to be uploaded to cloud
        // (e.g., when the user has 467 contacts in local storage)
        if (isFirstSync || snapshot.empty || mergedContacts.length > cloudContacts.length) {
          isFirstSync = false;
          const cloudDocIds = new Set(snapshot.docs.map((d) => d.id));
          const missingInCloud = mergedContacts.filter(
            (c) => !cloudDocIds.has(toSafeContactDocId(c.id))
          );

          if (missingInCloud.length > 0) {
            onStatusChange?.('connecting', `A carregar ${missingInCloud.length} contactos para a nuvem...`);
            saveBatchContactsToCloud(missingInCloud)
              .then(() => {
                onStatusChange?.(
                  'synced',
                  `${mergedContacts.length} contactos sincronizados na nuvem em todas as plataformas`
                );
              })
              .catch((uploadErr) => {
                console.warn('Could not auto-upload missing contacts to cloud:', uploadErr);
              });
          }
        }

        // Cache full merged list in localStorage
        saveContactsToStorage(mergedContacts);

        // Update application state
        onContactsUpdate(mergedContacts);
        onStatusChange?.(
          'synced',
          `${mergedContacts.length} contactos sincronizados em todas as plataformas`
        );
      } catch (err: any) {
        console.error('Error handling contacts snapshot:', err);
        onStatusChange?.('error', err.message);
      }
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
 * Saves multiple contacts in batch to Firestore (splits in chunks of 400 for Firestore limits)
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

/**
 * Explicit one-click force sync of all contacts between local browser and Firestore cloud.
 * Reads local storage, fetches all cloud documents, merges, and uploads all to Firestore.
 */
export async function forceBidirectionalSync(): Promise<{
  totalCount: number;
  uploadedCount: number;
  contacts: CollaboratorContact[];
}> {
  const contactsCol = collection(db, CONTACTS_COLLECTION);
  const snapshot = await getDocs(contactsCol);

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

  const localContacts = loadContactsFromStorage();
  const merged = mergeContactLists(localContacts, cloudContacts);

  // Upload missing items to cloud
  const cloudDocIds = new Set(snapshot.docs.map((d) => d.id));
  const missingInCloud = merged.filter((c) => !cloudDocIds.has(toSafeContactDocId(c.id)));

  if (missingInCloud.length > 0) {
    await saveBatchContactsToCloud(missingInCloud);
  }

  saveContactsToStorage(merged);

  return {
    totalCount: merged.length,
    uploadedCount: missingInCloud.length,
    contacts: merged,
  };
}

/**
 * Export complete backup of contacts in JSON format
 */
export function exportContactsToJson(contacts: CollaboratorContact[]): void {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(contacts, null, 2));
  const a = document.createElement('a');
  a.setAttribute('href', dataStr);
  a.setAttribute('download', `Backup_Contactos_${contacts.length}_Colaboradores.json`);
  document.body.appendChild(a);
  a.click();
  a.remove();
}
