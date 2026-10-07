# Thakur Clinic EMR — Working Prototype

Open `index.html` in a modern browser. For the best offline/PWA behaviour, serve this folder through a local web server (for example VS Code Live Server or `python -m http.server`).

## Included
- Single-doctor clinic dashboard
- Patient UHID and Patient 360° record
- Visit timeline with previous-visit visibility
- Default vitals fields
- Medication master with add-medicine support
- Medication history
- Prescription printing
- Appointment calendar/list
- Follow-up tracking
- Fee/payment recording
- UPI payment intent generation
- Basic analytics
- English/Marathi toggle UI
- Local browser storage + JSON backup/restore
- Service worker shell for offline use

## Important prototype limitations
1. Clinical interaction checking is deliberately NOT a validated medical decision-support engine. Connect a licensed/maintained clinical interaction knowledge source before clinical use.
2. Data is stored in browser localStorage in this prototype. Do not enter real patient data until proper encryption, authentication, access control, secure backups, audit logging, and production storage are implemented.
3. Document upload UI is only a placeholder in this prototype; production should use encrypted object storage.
4. WhatsApp integration is represented by the follow-up data model but requires an official WhatsApp Business/API integration and patient consent.
5. UPI ID must be entered in Settings. The prototype generates a local UPI payment intent link; production QR rendering/payment reconciliation should be added.
6. Marathi UI is a starting toggle; full field-by-field Marathi localization should be completed before deployment.

## Clinic details configured
Thakur Clinic
Dr Ashwin Thakur MD (AM), BAMS, PGDEMS
Registration: I-108768-A
Opp Balaji Nagar Garden, Gadgadeshwar Mandir Road, Amravati, Maharashtra
9284967619 / 8378889854
A4 prescription target
