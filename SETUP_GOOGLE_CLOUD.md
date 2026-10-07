# Setting up Thakur Clinic EMR (Vercel + Google Cloud / Firebase)

The app is a static site hosted on Vercel. Login, patient data, documents and QR registrations live in **Firebase (Google Cloud)**.
The free "Spark" plan is enough for one clinic. Do this once (about 15 minutes).

## 0. Vercel
Import the GitHub repo in Vercel (Framework: **Other**, no build command, no output directory).
Vercel serves the repo's **production branch** — make sure that branch contains `index.html`
(Vercel -> Project -> Settings -> Git -> Production Branch, or merge the work into `main`). A 404 means the branch Vercel builds has no `index.html`.

## 1. Firebase project
1. https://console.firebase.google.com -> **Add project** -> `thakur-clinic` (Analytics off).
2. **Build -> Firestore Database -> Create database**, location **asia-south1 (Mumbai)**, *production mode*.
3. **Build -> Authentication -> Get started -> Sign-in method -> Google -> Enable**.
4. **Authentication -> Settings -> Authorized domains -> Add domain**: your Vercel domain (e.g. `thakurclinic.vercel.app`) and any custom domain.
5. **Project settings (gear) -> Your apps -> Web `</>`** -> register -> copy the config values into `firebase-config.js`, commit.
6. **Firestore -> Rules**: paste `firestore.rules`, replace the placeholder with the doctor's Gmail (add receptionist Gmails too), **Publish**.

The Firebase web config is not a secret; Google login + the rules are what protect the data.

## 2. First use
- Open the site -> **Sign in with Google**. Anything already in the browser is uploaded once. Other Google accounts are refused.
- **Settings -> Patient QR code** -> *Print poster* and stick it in the waiting room. Patients scan it, fill in their details (English/Marathi) and you see them on the **Today** screen with one-tap *Accept & add to queue*.
- Settings: enter the UPI ID, default fee and clinic logo.

## Daily flow
Today screen = the queue. **Arrived/Waiting -> Start visit -> Save visit -> Print / WhatsApp prescription -> Collect fee.**
Create *Templates* (Templates page, or "Save as template" inside a visit) for common illnesses; use them with one tap.

## Notes
- **Documents** (reports/photos/PDF) are stored in Firestore (photos auto-shrunk, PDF <= 650 KB) so no paid plan is needed. For bigger files, upgrade to Blaze and use Firebase Storage.
- **WhatsApp** buttons open WhatsApp with a ready message (no paid API). Fully automatic reminders need the WhatsApp Business API + patient consent.
- **Safety check** = recorded-allergy match + duplicate drug only. It is *not* a drug-interaction engine.
- **Marathi** text should be proof-read by a native speaker.
- **Activity log** (Settings) shows who added/changed/deleted what.
- QR registration is public by design but write-only and size-limited. To block automated spam later, enable Firebase App Check.

## Backups
- The app reminds you weekly to download a backup (Settings -> Download backup).
- Automatic daily cloud backup (needs Blaze plan, costs pennies): create a bucket, then
  `gcloud firestore export gs://YOUR_BUCKET --project YOUR_PROJECT` on a Cloud Scheduler job.
