# Push Relay API - Bruno Collection

This Bruno collection contains all the API endpoints for the Push Relay service.

## Setup

1. **Install Bruno**: Download from [usebruno.com](https://www.usebruno.com/)
2. **Open Collection**: File → Open Collection → Select this `bruno` folder
3. **Configure Environment**:
   - Select **Local** environment for local development
   - Select **Production** environment for deployed worker
   - Update environment variables with your actual values:
     - `relay_token`: Your bridge auth token (≥32 chars)
     - `device_token_ios`: APNs device token from iOS device
          - `device_token_android`: FCM device token from Android device

## Environment Variables

### Local Environment
- `base_url`: `http://localhost:8787` (use `npm run dev` to start)
- For local development with actual push notifications, you'll need to set up `.dev.vars` file

### Production Environment
- `base_url`: `https://push-relay.rasimxyz.workers.dev` (update if using custom domain)

## API Endpoints

1. **Health Check** - Verify the relay is running
2. **Register iOS Device** - Register an iOS device for push notifications
3. **Register Android Device** - Register an Android device for push notifications
4. **Unregister Device** - Remove a device from push notifications
5. **Send Push Notification** - Send notification to all registered devices

## Testing Flow

1. Start with **Health Check** to verify connectivity
2. **Register** one or more devices (iOS/Android)
3. **Send Push Notification** to test delivery
4. **Unregister** devices when no longer needed

## Notes

- The `relay_token` is the bridge's `auth_token` from QR pairing (minimum 32 characters)
- Device tokens are obtained from the mobile app when it registers for push notifications
- All registered devices under a relay_token receive notifications when you call `/push`
- The worker automatically handles APNs JWT and FCM OAuth2 token refresh via cron

## Collecting Tokens for Testing

### 1. Relay Token (Bridge Auth Token)

The `relay_token` is the bridge's `auth_token` from the QR code.

**Get from Bridge Logs:**
```bash
cd bridge
./target/release/bridge start --agent-command "copilot --acp" --port 3001 --stdio-proxy --qr --verbose 2>&1 | grep -A 20 "QR code data"
```

Look for the `authToken` field in the JSON output. It's a long string (≥32 characters).

### 2. iOS Device Token (APNs)

**Debug builds automatically print the token:**
- Run the iOS app in Xcode (Debug configuration)
- Check console for: `"🔐 BRUNO TOKEN - iOS APNs: <token>"`
- Copy the full token string

**Production builds** do NOT print tokens for security.

### 3. Android Device Token (FCM)

**Debug builds automatically print the token:**
- Run the Android app in Android Studio (Debug build variant)
- Check Logcat for: `"🔐 BRUNO TOKEN - Android FCM: <token>"`
- Copy the full token string

**Alternatively, filter logcat:**
```bash
adb logcat | grep "BRUNO TOKEN"
```

**Production/Release builds** do NOT print tokens for security.

### 4. Update Bruno Environment

Once you have the tokens:
1. Open Bruno
2. Select **Environments** → **Production** (or Local)
3. Update variables:
   ```
   relay_token: <paste_bridge_auth_token>
   device_token_ios: <paste_ios_apns_token>
   device_token_android: <paste_android_fcm_token>
   ```
4. Save the environment

### Quick Test

1. **Start bridge** and copy auth token from logs
2. **Run mobile app** (iOS or Android) in debug mode
3. **Copy device token** from console/logcat
4. **Open Bruno** and update environment variables
5. **Test**: Send "Register iOS Device" or "Register Android Device"
6. **Verify**: Send "Send Push Notification" and check device receives it
