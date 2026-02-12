# Firebase Cloud Messaging (FCM) Setup Guide

This guide walks you through setting up Firebase Cloud Messaging to send push notifications to Android devices.

## Overview

FCM uses OAuth2 authentication with service account credentials. You'll need:
- **Firebase Project** - Container for your app and services
- **Service Account Private Key** - RSA private key for OAuth2 authentication
- **Service Account Email** - Client email for the service account
- **Project ID** - Your Firebase project identifier

## Prerequisites

- **Google Account** (free - you already have this with Google Dev account)
- Internet browser

## Cost

| Item | Cost | Notes |
|------|------|-------|
| Firebase Project | **FREE** | Unlimited projects |
| FCM API usage | **FREE** | Unlimited push notifications |
| Firebase Services | **FREE** | (Blaze plan required only for other services) |

**Total: $0** - Completely FREE! 🎉

## Step-by-Step Setup

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Sign in with your Google Account
3. Click **"Add project"** (or **"Create a project"**)
4. Enter project name:
   - Example: `Aptove Push Notifications`
   - Project ID will be auto-generated (e.g., `aptove-push-notifications-abc123`)
5. (Optional) Disable Google Analytics if you don't need it
6. Click **"Continue"** → **"Create project"**
7. Wait ~30 seconds for project creation

### 2. Add Android App to Firebase

1. In your new Firebase project, click **Android icon** (or **"Add app"** → **Android**)
2. **Register app**:
   - **Android package name**: `com.acp.chat` (must match your app's `applicationId`)
   - **App nickname** (optional): `ACP Chat`
   - **Debug signing certificate SHA-1** (optional): Skip for now
3. Click **"Register app"**

### 3. Download google-services.json

1. Click **"Download google-services.json"**
2. Save the file
3. Place it in your Android project:
   ```bash
   cp ~/Downloads/google-services.json \
      /Users/saltuk/code/openspec-acp-swift-sdk/android/app/google-services.json
   ```
4. Click **"Next"** → **"Next"** → **"Continue to console"**

**Note**: You already have this file, but make sure it's current!

### 4. Generate Service Account Key

This is what the push relay needs to authenticate with FCM.

1. In Firebase Console, click **⚙️ Project Settings** (gear icon, top-left)
2. Go to **"Service Accounts"** tab
3. Select **"Firebase Admin SDK"** at the top
4. Click **"Generate new private key"**
5. Confirm by clicking **"Generate key"**
6. A JSON file will download (e.g., `aptove-push-notifications-abc123-firebase-adminsdk-xxxxx.json`)

⚠️ **IMPORTANT**: Keep this file secure! It contains your service account credentials.

### 5. Extract Credentials from JSON

Open the downloaded JSON file. It should look like:

```json
{
  "type": "service_account",
  "project_id": "aptove-push-notifications-abc123",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBA...very long key...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@aptove-push-notifications-abc123.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

You need three values:
1. **`project_id`** - Example: `aptove-push-notifications-abc123`
2. **`private_key`** - The entire RSA key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
3. **`client_email`** - Example: `firebase-adminsdk-xxxxx@aptove-push-notifications-abc123.iam.gserviceaccount.com`

### 6. Configure Cloudflare Worker Secrets

Set the extracted values as secrets:

```bash
cd cf-push-relay

# Paste the ENTIRE private_key value (including BEGIN/END lines)
npx wrangler secret put FCM_PRIVATE_KEY

# Paste the client_email value
npx wrangler secret put FCM_CLIENT_EMAIL
```

**Example input for `FCM_PRIVATE_KEY`:**
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
...very long key...
...ends with...
-----END PRIVATE KEY-----
```

### 7. Configure Worker Variables

Update `wrangler.toml`:

```toml
[vars]
FCM_PROJECT_ID = "aptove-push-notifications-abc123"  # Your project_id from JSON
```

## Deploy & Test

```bash
npm run deploy
```

Test the health endpoint:
```bash
curl https://push.aptove.com/health
```

## Verify Android App Configuration

### 1. Check build.gradle.kts

Verify Firebase dependencies are present (they should already be there):

```kotlin
dependencies {
    // Firebase Cloud Messaging
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-messaging-ktx")
}
```

And the plugin:
```kotlin
plugins {
    id("com.google.gms.google-services")
}
```

### 2. Check AndroidManifest.xml

Will be updated when we implement the FirebaseMessagingService (next step).

## Security Best Practices

### Service Account Key Management

✅ **DO:**
- Store the JSON file securely (password manager, encrypted storage)
- Use Cloudflare secrets (never commit to git)
- Add `*-firebase-adminsdk-*.json` to `.gitignore`
- Limit access to only necessary team members

❌ **DON'T:**
- Commit the JSON file to version control
- Share via email or Slack
- Upload to public repositories
- Store in plain text without encryption

### Key Rotation

If your service account key is compromised:

1. Go to Firebase Console → **Project Settings** → **Service Accounts**
2. Click **"Manage service account permissions"** (opens Google Cloud Console)
3. Find your service account
4. Go to **Keys** tab
5. Delete the compromised key
6. Create a new key
7. Update Cloudflare secrets immediately

## Troubleshooting

### "Authentication error" from FCM

- **Cause**: Invalid private key or client email
- **Fix**: Re-download service account JSON and re-paste credentials

### "Project not found" error

- **Cause**: Wrong `project_id` or project doesn't exist
- **Fix**: Verify `FCM_PROJECT_ID` matches the `project_id` in your JSON file

### "Invalid registration token" from FCM

- **Cause**: Device token is invalid or expired
- **Fix**: App should request new token and re-register

### google-services.json errors in Android build

- **Cause**: File missing or package name mismatch
- **Fix**: 
  1. Verify file is at `android/app/google-services.json`
  2. Check package name matches: `com.acp.chat`
  3. Re-download from Firebase Console if needed

### Notifications not received

1. Check logs: `npx wrangler tail`
2. Verify `google-services.json` package name matches app
3. Ensure Firebase project has billing enabled (even though FCM is free, some Google Cloud features require it)
4. Check device token is current
5. Verify notification channel is created in Android app

## Testing

### Manual Test with curl

```bash
# Register a device (get device token from Android app logs)
curl -X POST https://push.aptove.com/register \
  -H "Content-Type: application/json" \
  -d '{
    "relay_token": "test-token-min-32-chars-xxxxx",
    "device_token": "YOUR_FCM_DEVICE_TOKEN_HERE",
    "platform": "android",
    "bundle_id": "com.acp.chat"
  }'

# Send test push
curl -X POST https://push.aptove.com/push \
  -H "Content-Type: application/json" \
  -d '{
    "relay_token": "test-token-min-32-chars-xxxxx",
    "title": "Test",
    "body": "Hello from FCM!"
  }'
```

### Get Device Token from Android App

The device token will be logged when you implement `FirebaseMessagingService` (next step).

## Firebase Console Overview

Useful sections in Firebase Console:

| Section | Purpose |
|---------|---------|
| **Project Overview** | Add apps, view project info |
| **Cloud Messaging** | View message statistics (requires sending via Firebase Console) |
| **Project Settings** | Manage apps, service accounts, API keys |
| **Users and Permissions** | Add team members |

## FCM Features (All Free!)

| Feature | Included | Notes |
|---------|----------|-------|
| Push notifications | ✅ Yes | Unlimited |
| Topics | ✅ Yes | Group messaging |
| Device groups | ✅ Yes | Multi-device users |
| Analytics | ✅ Yes | With Google Analytics |
| A/B testing | ✅ Yes | Via Firebase Console |
| Scheduling | ✅ Yes | Via Firebase Console |

## Cost Summary

| Component | Cost | Frequency |
|-----------|------|-----------|
| Firebase Project | FREE | One-time |
| Service Account | FREE | One-time |
| FCM API Calls | FREE | Unlimited |
| google-services.json | FREE | One-time |
| Cloudflare Worker (Push Relay) | FREE* | Per month |

*Cloudflare Workers free tier: 100,000 requests/day

**Total cost: $0** 🎉

## Resources

- [Firebase Console](https://console.firebase.google.com)
- [FCM Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Android FCM Setup](https://firebase.google.com/docs/cloud-messaging/android/client)
- [Service Account Keys](https://firebase.google.com/docs/admin/setup#initialize-sdk)
- [FCM HTTP v1 API](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages)

## Next Steps

After configuring FCM:
1. ✅ Implement Android FirebaseMessagingService
2. ✅ Implement Android PushNotificationManager
3. ✅ Test push notifications end-to-end
4. ✅ Deploy to production

## Comparison: APNs vs FCM

| Feature | APNs (iOS) | FCM (Android) |
|---------|-----------|---------------|
| **Cost** | $99/year | FREE |
| **Setup Time** | 10 minutes | 5 minutes |
| **Authentication** | JWT (ES256) | OAuth2 |
| **Credentials** | .p8 key file | JSON file |
| **Expiration** | Never | Never (unless revoked) |
| **Sandbox Mode** | Yes | No (uses package signature) |
| **Delivery** | Very reliable | Very reliable |
| **Latency** | Low | Low |
