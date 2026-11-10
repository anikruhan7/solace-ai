import { useEffect } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAuth } from "@/store/auth.store";
import { ensureAndroidChannel } from "@/notifications/setup";
import { colors } from "@/theme";

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });

function openFromNotification(response: Notifications.NotificationResponse | null) {
  const route = response?.notification.request.content.data?.route;
  if (typeof route !== "string") return;
  // Wait until the user is signed in; the splash screen routes signed-out users to login.
  const go = () => {
    if (useAuth.getState().user) router.push(route as any);
  };
  if (useAuth.getState().loading) {
    const unsub = useAuth.subscribe((s) => {
      if (!s.loading) {
        unsub();
        setTimeout(go, 1200);
      }
    });
  } else go();
}

export default function RootLayout() {
  const hydrate = useAuth((s) => s.hydrate);

  useEffect(() => {
    hydrate();
    ensureAndroidChannel();
    // App opened from a notification while it was closed.
    Notifications.getLastNotificationResponseAsync().then(openFromNotification);
    // Notification tapped while the app is running or in the background.
    const sub = Notifications.addNotificationResponseReceivedListener(openFromNotification);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    // Signed out (logout or expired token): drop cached personal data.
    return useAuth.subscribe((s, prev) => {
      if (prev.user && !s.user) qc.clear();
    });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <QueryClientProvider client={qc}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: "fade_from_bottom" }} />
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
