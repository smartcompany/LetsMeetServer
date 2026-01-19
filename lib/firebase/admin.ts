import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';

let firebaseApp: App | null = null;
let auth: Auth | null = null;

export function getFirebaseAdmin(): { app: App; auth: Auth } {
  if (!firebaseApp || !auth) {
    // 이미 초기화된 앱이 있으면 재사용
    if (getApps().length > 0) {
      firebaseApp = getApps()[0];
      auth = getAuth(firebaseApp);
    } else {
      // Firebase Admin SDK 초기화
      // 환경 변수에서 서비스 계정 키 사용
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      
      if (!serviceAccount) {
        throw new Error(
          'FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set. ' +
          'Please set it to the path of your Firebase service account JSON file or the JSON content itself.'
        );
      }

      let serviceAccountJson;
      try {
        // JSON 문자열로 제공된 경우 파싱
        serviceAccountJson = JSON.parse(serviceAccount);
      } catch {
        // 파일 경로로 제공된 경우 require 사용
        try {
          serviceAccountJson = require(serviceAccount);
        } catch {
          throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_KEY. Must be JSON string or file path.');
        }
      }

      firebaseApp = initializeApp({
        credential: cert(serviceAccountJson),
      });
      auth = getAuth(firebaseApp);
    }
  }

  return { app: firebaseApp, auth };
}
