import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import Head from "expo-router/head";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import StrictModeOverlay from "@/components/StrictModeOverlay";
import { FocusProvider } from "@/context/FocusContext";
import { HabitProvider } from "@/context/HabitContext";
import { UsageProvider } from "@/context/UsageContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <Head>
        <title>Focus Shield – Deep Focus & App Blocking</title>
        <meta name="description" content="Focus Shield is an offline productivity app with a custom timer, Pomodoro cycles, app blocking, Shorts & Reels blocking, streaks, and analytics to help you build deep focus habits." />
        <meta name="theme-color" content="#010f1f" />
        <meta property="og:title" content="Focus Shield – Deep Focus & App Blocking" />
        <meta property="og:description" content="Block distractions, track streaks, and build laser-sharp focus with Focus Shield's offline-first timer and app blocking system." />
        <meta property="og:type" content="website" />
        <meta name="robots" content="index, follow" />
      </Head>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <UsageProvider>
                <HabitProvider>
                  <FocusProvider>
                    <RootLayoutNav />
                    <StrictModeOverlay />
                  </FocusProvider>
                </HabitProvider>
              </UsageProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
