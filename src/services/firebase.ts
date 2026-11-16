import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { DailyBonusState, Transaction, UserProfile } from '../types/game';
import { AdTasksState } from './storage';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export async function signInWithGooglePopup(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

export interface CloudUserHydration {
  profile: UserProfile;
  highScores: Record<string, number>;
  recentGames: string[];
  dailyBonus: DailyBonusState;
  adTasks?: AdTasksState;
  transactions: Transaction[];
}

export async function loadOrCreateUserCloudAccount(user: User): Promise<CloudUserHydration> {
  const uid = user.uid;
  const userPath = `users/${uid}`;
  const privatePath = `users/${uid}/private/info`;
  const txCollectionPath = `users/${uid}/transactions`;

  const userRef = doc(db, 'users', uid);
  const privateRef = doc(db, 'users', uid, 'private', 'info');

  const safeName = (user.displayName || user.email?.split('@')[0] || 'CyberPlayer')
    .trim()
    .slice(0, 40) || 'CyberPlayer';
  const safeEmail = (user.email || '').slice(0, 200);
  const safePhoto = (user.photoURL || '').slice(0, 500);
  const today = new Date().toISOString().split('T')[0];

  let snap;
  try {
    snap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  let profile: UserProfile;
  let highScores: Record<string, number> = {};
  let recentGames: string[] = ['3d-ludo', '3d-tic-tac-toe', '3d-car-drift', '3d-bowling'];
  let dailyBonus: DailyBonusState = {
    lastClaimDate: null,
    currentStreak: 0,
    claimHistory: [],
  };
  let adTasks: AdTasksState | undefined = undefined;
  let transactions: Transaction[] = [];

  if (!snap.exists()) {
    const welcomeTx: Transaction = {
      id: `tx-welcome-${Date.now().toString(36)}`,
      title: 'RewardX Welcome Bonus',
      amount: 250,
      type: 'DAILY_BONUS',
      date: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      status: 'COMPLETED',
    };

    profile = {
      uid,
      email: safeEmail,
      photoURL: safePhoto,
      name: safeName,
      avatarId: 'avatar-1',
      level: 1,
      xp: 150,
      coins: 250,
      joinedDate: today,
      unlockedAvatars: ['avatar-1', 'avatar-2', 'avatar-3'],
      claimedBadges: ['Rookie Gamer'],
      claimedRewardIds: [],
    };

    try {
      await setDoc(userRef, {
        uid,
        name: profile.name,
        avatarId: profile.avatarId,
        level: profile.level,
        xp: profile.xp,
        coins: profile.coins,
        joinedDate: profile.joinedDate,
        unlockedAvatars: profile.unlockedAvatars,
        claimedBadges: profile.claimedBadges,
        claimedRewardIds: profile.claimedRewardIds,
        highScores,
        recentGames,
        dailyBonus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, userPath);
    }

    try {
      await setDoc(doc(db, 'users', uid, 'transactions', welcomeTx.id), {
        id: welcomeTx.id,
        userId: uid,
        title: welcomeTx.title,
        amount: welcomeTx.amount,
        type: welcomeTx.type,
        date: welcomeTx.date,
        status: welcomeTx.status,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `${txCollectionPath}/${welcomeTx.id}`);
    }

    transactions = [welcomeTx];
  } else {
    const data = snap.data();
    profile = {
      uid,
      email: safeEmail,
      photoURL: safePhoto,
      name: typeof data.name === 'string' && data.name ? data.name : safeName,
      avatarId: typeof data.avatarId === 'string' ? data.avatarId : 'avatar-1',
      level: typeof data.level === 'number' ? data.level : 1,
      xp: typeof data.xp === 'number' ? data.xp : 150,
      coins: typeof data.coins === 'number' ? data.coins : 250,
      joinedDate: typeof data.joinedDate === 'string' ? data.joinedDate : today,
      unlockedAvatars: Array.isArray(data.unlockedAvatars)
        ? data.unlockedAvatars
        : ['avatar-1', 'avatar-2', 'avatar-3'],
      claimedBadges: Array.isArray(data.claimedBadges)
        ? data.claimedBadges
        : ['Rookie Gamer'],
      claimedRewardIds: Array.isArray(data.claimedRewardIds) ? data.claimedRewardIds : [],
    };
    if (data.highScores && typeof data.highScores === 'object') {
      highScores = data.highScores as Record<string, number>;
    }
    if (Array.isArray(data.recentGames)) {
      recentGames = data.recentGames as string[];
    }
    if (data.dailyBonus && typeof data.dailyBonus === 'object') {
      dailyBonus = data.dailyBonus as DailyBonusState;
    }
    if (data.adTasks && typeof data.adTasks === 'object') {
      adTasks = data.adTasks as AdTasksState;
    }

    try {
      const txQ = query(
        collection(db, 'users', uid, 'transactions'),
        where('userId', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      const txSnap = await getDocs(txQ);
      transactions = txSnap.docs.map((d) => {
        const td = d.data();
        return {
          id: String(td.id || d.id),
          title: String(td.title || 'RewardX Activity'),
          amount: Number(td.amount || 0),
          type: (td.type as Transaction['type']) || 'EARN_GAME',
          date: String(td.date || ''),
          gameId: typeof td.gameId === 'string' ? td.gameId : undefined,
          status: (td.status as Transaction['status']) || 'COMPLETED',
        };
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, txCollectionPath);
    }
  }

  // Save/refresh isolated private PII document
  if (safeEmail) {
    try {
      await setDoc(
        privateRef,
        {
          uid,
          email: safeEmail,
          photoURL: safePhoto,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, privatePath);
    }
  }

  return {
    profile,
    highScores,
    recentGames,
    dailyBonus,
    adTasks,
    transactions,
  };
}

export async function syncUserFieldsToCloud(
  uid: string,
  fields: Record<string, unknown>
): Promise<void> {
  const userPath = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      ...fields,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export async function writeTransactionToCloud(
  uid: string,
  tx: Transaction
): Promise<void> {
  const safeId = tx.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || `tx-${Date.now()}`;
  const txPath = `users/${uid}/transactions/${safeId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'transactions', safeId), {
      id: safeId,
      userId: uid,
      title: tx.title.slice(0, 140),
      amount: Math.trunc(tx.amount),
      type: tx.type,
      date: tx.date.slice(0, 40),
      ...(tx.gameId ? { gameId: tx.gameId.slice(0, 64) } : {}),
      status: tx.status,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, txPath);
  }
}
