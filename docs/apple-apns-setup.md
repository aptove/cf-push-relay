# Apple Push Notification Service (APNs) Setup Guide

This guide walks you through obtaining the necessary credentials to send push notifications to iOS devices via APNs.

## Overview

APNs uses token-based authentication with ES256 (ECDSA with P-256 curve) signing. You'll need:
- **Private Key** (`.p8` file) - Used to sign JWT tokens
- **Key ID** - 10-character identifier for your key
- **Team ID** - 10-character identifier for your Apple Developer account

## Prerequisites

- Active **Apple Developer Program** membership ($99/year)
- Access to [Apple Developer Portal](https://developer.apple.com/account)

## Cost

| Item | Cost | Notes |
|------|------|-------|
| Apple Developer Program | **$99/year** | Required for APNs |
| APNs API usage | **FREE** | Unlimited push notifications |

**Total: $99/year** (Developer Program membership only)

## Step-by-Step Setup

### 1. Sign in to Apple Developer Portal

Go to [https://developer.apple.com/account](https://developer.apple.com/account) and sign in with your Apple ID.

### 2. Navigate to Keys Section

1. Click **Certificates, Identifiers & Profiles** in the sidebar
2. Under **Keys**, click **Keys** (or go to **All** → **Keys**)
3. Click the **+** button (or "Create a key")

### 3. Create APNs Key

1. **Key Name**: Enter a descriptive name (e.g., "Aptove Push Notifications Key")
2. **Key Services**: Check **Apple Push Notifications service (APNs)**
3. Click **Continue**
4. Review and click **Register**

### 4. Download the Key

⚠️ **IMPORTANT**: You can only download the `.p8` file **once**. Store it securely!

1. Click **Download** to get the `.p8` file
2. The file will be named `AuthKey_XXXXXXXXXX.p8` (where X's are your Key ID)
3. Save this file securely - you'll need it for the relay configuration

### 5. Note Key Details

On the download page, you'll see:

```
Key ID: ABC1234567 (10 characters)
```

Also note your **Team ID** which you can find:
- At the top-right of the developer portal (next to your account name)
- In **Membership** section of your account
- Format: `XYZ9876543` (10 characters)

Example:
```
Key ID:  52ZW4GTM93
Team ID: 36BES5W42Q
```

### 6. Enable Push Notifications for Your App

1. Go to **Identifiers** in the developer portal
2. Select your app's identifier (e.g., `com.aptove.ios`)
3. Scroll down and check **Push Notifications**
4. Click **Save**

**Note**: You don't need to create certificates when using token-based authentication (`.p8` keys). The key works for all your apps.

## Extract Key Contents

Open the `.p8` file in a text editor. It should look like:

```
-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQgu/Mo5RFoqG4ALHPV
GKg4fjYoeBd/T7vJVz9fHCyeB8ygCgYIKoZIzj0DAQehRANCAAQ+Baf2smhk4rCY
mHj5350teXN9IlRTorFrox67yDuTFc+2mN8X7HOmnr2M/CH6/TYrkYGzHtepZ4wr
g61VHQEL
-----END PRIVATE KEY-----
```

Copy the **entire contents** (including the BEGIN/END lines) for use in the next step.

## Configure Cloudflare Worker Secrets

Now set these values as secrets in your Cloudflare Worker:

```bash
cd cf-push-relay

# Paste the entire contents of the .p8 file (including BEGIN/END lines)
npx wrangler secret put APNS_PRIVATE_KEY

# Enter your 10-character Key ID
npx wrangler secret put APNS_KEY_ID
# Example: 52ZW4GTM93

# Enter your 10-character Team ID
npx wrangler secret put APNS_TEAM_ID
# Example: 36BES5W42Q
```

## Configure Worker Variables

Update `wrangler.toml`:

```toml
[vars]
APNS_BUNDLE_ID = "com.aptove.ios"  # Your iOS app's bundle identifier
APNS_SANDBOX = "false"              # "true" for development, "false" for production
```

### Sandbox vs Production

| Mode | Use Case | APNs URL |
|------|----------|----------|
| **Sandbox** (`"true"`) | Development builds, TestFlight internal testing | `api.sandbox.push.apple.com` |
| **Production** (`"false"`) | App Store builds, TestFlight public beta, enterprise distribution | `api.push.apple.com` |

**How to determine which to use:**
- Development builds (Xcode, debug): Use **Sandbox**
- TestFlight builds: Use **Production**
- App Store builds: Use **Production**

**Tip**: If notifications aren't working, try switching between sandbox and production modes.

## Deploy & Test

```bash
npm run deploy
```

Test the health endpoint:
```bash
curl https://push.aptove.com/health
```

## Security Best Practices

### Key Management

✅ **DO:**
- Store the `.p8` file in a secure location (password manager, encrypted storage)
- Use Cloudflare secrets (never commit to git)
- One key can be used for all your apps
- Limit access to the key to only necessary team members

❌ **DON'T:**
- Commit the `.p8` file to version control
- Share the key via email or Slack
- Upload to public repositories
- Store in plain text files

### Key Rotation

- APNs keys don't expire, but you can rotate them if needed
- Create a new key and update secrets
- Old key continues working until you delete it
- Maximum 2 active keys per team

### Revocation

If your key is compromised:
1. Go to Apple Developer Portal → Keys
2. Select the compromised key
3. Click **Revoke**
4. Create a new key immediately
5. Update Cloudflare secrets

## Troubleshooting

### "Authentication error" from APNs

- **Cause**: Invalid Key ID, Team ID, or malformed private key
- **Fix**: Verify all three values are correct and properly formatted

### "Invalid token" from APNs

- **Cause**: JWT signing issue or expired token
- **Fix**: Check that the private key is properly formatted (including BEGIN/END lines)

### "Missing topic" error

- **Cause**: `APNS_BUNDLE_ID` not configured
- **Fix**: Set your iOS app's bundle identifier in `wrangler.toml`

### "BadDeviceToken" error

- **Cause**: Using production endpoint with sandbox token (or vice versa)
- **Fix**: Switch `APNS_SANDBOX` setting and redeploy

### Notifications not delivered

1. Check logs: `npx wrangler tail`
2. Verify bundle ID matches your iOS app
3. Ensure push notifications capability is enabled in Xcode
4. Check sandbox vs production mode
5. Verify device token is current (regenerate if needed)

## Testing

### Manual Test with curl

```bash
# Register a device (get device token from iOS app logs)
curl -X POST https://push.aptove.com/register \
  -H "Content-Type: application/json" \
  -d '{
    "relay_token": "test-token-min-32-chars-xxxxx",
    "device_token": "YOUR_APNS_DEVICE_TOKEN_HERE",
    "platform": "ios",
    "bundle_id": "com.aptove.ios"
  }'

# Send test push
curl -X POST https://push.aptove.com/push \
  -H "Content-Type: application/json" \
  -d '{
    "relay_token": "test-token-min-32-chars-xxxxx",
    "title": "Test",
    "body": "Hello from APNs!"
  }'
```

### Get Device Token from iOS App

Add this to your iOS app to see the device token:

```swift
func application(_ application: UIApplication, 
                 didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    let token = deviceToken.map { String(format: "%02x", $0) }.joined()
    print("📱 APNs Device Token: \(token)")
}
```

## Cost Summary

| Component | Cost | Frequency |
|-----------|------|-----------|
| Apple Developer Program | $99 | Per year |
| APNs Key Creation | Free | One-time |
| APNs Push Notifications | Free | Unlimited |
| Cloudflare Worker (Push Relay) | Free* | Per month |

*Cloudflare Workers free tier: 100,000 requests/day, more than enough for most use cases.

**Total ongoing cost: $99/year** for Apple Developer Program membership.

## Resources

- [APNs Documentation](https://developer.apple.com/documentation/usernotifications)
- [Token-Based Authentication](https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/establishing_a_token-based_connection_to_apns)
- [APNs Provider API](https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/sending_notification_requests_to_apns)
- [Apple Developer Portal](https://developer.apple.com/account)

## Next Steps

After configuring APNs:
1. ✅ Set up Firebase/FCM for Android (see [firebase-fcm-setup.md](firebase-fcm-setup.md))
2. ✅ Deploy push relay: `npm run deploy`
3. ✅ Test with Bruno API collection
4. ✅ Integrate with iOS and Android apps
