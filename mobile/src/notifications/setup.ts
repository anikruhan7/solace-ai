import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "@/services/api";
import type { Preferences } from "@/store/auth.store";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export const REMINDER_CHANNEL = "reminders";

export async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
      name: "Gentle reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: "#7A9B76",
    });
  } catch (e) {
    // Expo Go on some Android phones can't create channels; the app works without it.
    console.warn("Notification channel skipped:", (e as Error)?.message);
  }
}

export async function ensurePermission() {
  await ensureAndroidChannel();
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "granted") return true;
  const ask = await Notifications.requestPermissionsAsync();
  return ask.status === "granted";
}

/** Push token is optional: local reminders work without it, so failures here never block scheduling. */
async function registerPushToken() {
  try {
    if (!Device.isDevice) return;
    const projectId =
      (Constants.expoConfig?.extra as any)?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
    if (!projectId) return;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await api.post("/api/profile/device-token", { token, platform: Platform.OS === "ios" ? "ios" : "android" });
  } catch (e) {
    console.warn("Push token registration skipped:", (e as Error)?.message);
  }
}

function parseTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  return { hour: h || 0, minute: m || 0 };
}

export const REMINDERS = [
  { key: "dailyMoodReminder", timeKey: "dailyMoodTime", label: "Mood check-in", title: "A gentle check-in", body: "How are you feeling right now? Sol is here.", route: "/(tabs)/home" },
  { key: "affirmationReminder", timeKey: "affirmationTime", label: "Daily affirmation", title: "Today's affirmation", body: "A few kind words to start your day.", route: "/affirmations" },
  { key: "breathingReminder", timeKey: "breathingTime", label: "Breathing break", title: "Time to breathe", body: "Two minutes of calm, whenever you're ready.", route: "/breathe" },
  { key: "selfCareReminder", timeKey: "selfCareTime", label: "Self-care moment", title: "A small kindness", body: "Pick one tiny thing that would feel good right now.", route: "/(tabs)/discover" },
] as const;

export type ReminderKey = (typeof REMINDERS)[number]["key"];

/**
 * Replaces every scheduled reminder with exactly the enabled ones, so turning a reminder off
 * really stops it and there are never duplicates. Returns false if permission was refused.
 */
export async function syncReminders(prefs: Partial<Preferences>): Promise<boolean> {
  const anyOn = REMINDERS.some((r) => prefs[r.key]);
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!anyOn) return true;
  if (!(await ensurePermission())) return false;
  registerPushToken();

  for (const r of REMINDERS) {
    if (!prefs[r.key]) continue;
    const { hour, minute } = parseTime((prefs[r.timeKey] as string) ?? "09:00");
    await Notifications.scheduleNotificationAsync({
      content: { title: r.title, body: r.body, data: { route: r.route } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: REMINDER_CHANNEL },
    });
  }
  return true;
}

export function cancelAllReminders() {
  return Notifications.cancelAllScheduledNotificationsAsync();
}

/** Fires one reminder 5 seconds from now so the user can see it works. */
export async function sendTestReminder() {
  if (!(await ensurePermission())) return false;
  await Notifications.scheduleNotificationAsync({
    content: { title: "Hi from Sol", body: "This is what a gentle reminder looks like.", data: { route: "/(tabs)/home" } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: REMINDER_CHANNEL },
  });
  return true;
}
