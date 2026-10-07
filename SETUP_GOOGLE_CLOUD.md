# Connecting Thakur Clinic EMR to Google Cloud (Firebase)

Uses Firebase (part of Google Cloud): **Google sign-in** for the login and **Firestore** to store all patient data.
The free "Spark" plan is enough for a single clinic. Do this once (about 15 minutes).

1. Go to https://console.firebase.google.com -> **Add project** -> name it `thakur-clinic` (turn Analytics off).
2. **Build -> Firestore Database -> Create database**. Choose location **asia-south1 (Mumbai)**, start in *production mode*.
3. **Build -> Authentication -> Get started -> Sign-in method -> Google -> Enable** (choose a support email, Save).
4. **Authentication -> Settings -> Authorized domains -> Add domain**: your Vercel domain, e.g. `thakurclinic.vercel.app`.
5. **Project settings (gear) -> Your apps -> Web (`</>`)** -> register app -> copy the `firebaseConfig` values into `firebase-config.js`.
6. **Firestore -> Rules**: paste the contents of `firestore.rules`, replace the placeholder with the doctor's Gmail (add receptionist emails too), **Publish**.
7. Commit the `firebase-config.js` change; Vercel redeploys automatically.

(The Firebase web config is not a secret; the rules + Google login are what protect the data.)

## First login
Open the site, tap **Sign in with Google** using an allowed Gmail. Anything already in that browser is uploaded to the cloud; after that, every save syncs automatically (status shown at top: "Saved ✓"). Any other Google account is refused.

## Backups
Scheduled Firestore export needs the Blaze plan. Until then use **Export backup** in the app weekly.
