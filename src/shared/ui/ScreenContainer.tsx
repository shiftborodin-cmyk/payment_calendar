import { Platform, ScrollView, StyleSheet, View, type ScrollViewProps, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme, type AppTheme } from "@/shared/theme/theme";

type ScreenContainerProps = {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
} & Pick<ScrollViewProps, "keyboardShouldPersistTaps" | "nestedScrollEnabled" | "scrollEnabled">;

export function ScreenContainer({
  children,
  scroll = true,
  contentStyle,
  keyboardShouldPersistTaps,
  nestedScrollEnabled,
  scrollEnabled
}: ScreenContainerProps) {
  const theme = useTheme();
  const styles = createStyles(theme);

  if (scroll) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView
          contentContainerStyle={[styles.content, contentStyle]}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          nestedScrollEnabled={nestedScrollEnabled}
          scrollEnabled={scrollEnabled}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={[styles.content, styles.flex, contentStyle]}>{children}</View>
    </SafeAreaView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  flex: {
    flex: 1
  },
  content: {
    alignSelf: "center",
    flexGrow: 1,
    gap: theme.spacing.md,
    maxWidth: Platform.OS === "web" ? 640 : undefined,
    paddingBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    width: "100%"
  }
  });
}
