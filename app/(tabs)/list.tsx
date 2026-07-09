import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/features/auth/AuthContext";
import { formatPaymentAmount, formatPaymentDate } from "@/features/payments/paymentFormatters";
import { deletePaymentItem, fetchPaymentItems, markPaymentItemPaid } from "@/features/payments/paymentsApi";
import { Card } from "@/shared/ui/Card";
import { EmptyStateText } from "@/shared/ui/PaymentPlaceholderCard";
import { ScreenContainer } from "@/shared/ui/ScreenContainer";
import { theme } from "@/shared/theme/theme";
import type { PaymentItem } from "@/types/payment";

export default function ListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }

    setLoading(true);

    try {
      const nextItems = await fetchPaymentItems(user.id);
      setItems(nextItems);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось загрузить платежи.";
      Alert.alert("Ошибка", message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems])
  );

  async function handleMarkPaid(item: PaymentItem) {
    setActionId(item.id);

    try {
      await markPaymentItemPaid(item.id);
      await loadItems();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось отметить платёж.";
      Alert.alert("Ошибка", message);
    } finally {
      setActionId(null);
    }
  }

  async function handleDelete(item: PaymentItem) {
    setActionId(item.id);

    try {
      await deletePaymentItem(item.id);
      await loadItems();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось удалить платёж.";
      Alert.alert("Ошибка", message);
    } finally {
      setActionId(null);
    }
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>Список</Text>
        <EmptyStateText>
          {loading ? "Загружаю ближайшие платежи..." : "Ближайшие платежи появятся здесь"}
        </EmptyStateText>
      </View>

      <Pressable onPress={() => router.push("/add-payment")} style={styles.addButton}>
        <Ionicons color={theme.colors.background} name="add" size={20} />
        <Text style={styles.addButtonText}>Добавить платёж</Text>
      </Pressable>

      {items.length === 0 ? (
        <Card style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}>
            <Ionicons color={theme.colors.primary} name="receipt-outline" size={24} />
          </View>
          <View style={styles.emptyTextWrap}>
            <Text style={styles.emptyTitle}>Пока без записей</Text>
            <Text style={styles.emptyDescription}>
              Когда вы добавите платежи, они появятся здесь по порядку дат.
            </Text>
          </View>
        </Card>
      ) : (
        <View style={styles.list}>
          {items.map((item) => (
            <Card key={item.id} style={styles.paymentCard}>
              <View style={styles.paymentTopRow}>
                <View style={styles.paymentIconWrap}>
                  <Ionicons
                    color={item.status === "paid" ? theme.colors.textMuted : theme.colors.primary}
                    name={item.status === "paid" ? "checkmark-circle-outline" : "wallet-outline"}
                    size={22}
                  />
                </View>
                <View style={styles.paymentMain}>
                  <Text style={[styles.paymentTitle, item.status === "paid" && styles.paidText]}>
                    {item.title}
                  </Text>
                  <Text style={styles.paymentMeta}>{formatPaymentDate(item.date)}</Text>
                </View>
                <Text style={[styles.paymentAmount, item.status === "paid" && styles.paidText]}>
                  {formatPaymentAmount(item)}
                </Text>
              </View>

              {item.comment ? <Text style={styles.comment}>{item.comment}</Text> : null}

              <View style={styles.actions}>
                <Pressable
                  disabled={item.status === "paid" || actionId === item.id}
                  onPress={() => handleMarkPaid(item)}
                  style={[
                    styles.smallButton,
                    item.status === "paid" && styles.smallButtonDisabled
                  ]}
                >
                  <Text style={styles.smallButtonText}>
                    {item.status === "paid" ? "Оплачено" : "Отметить оплачено"}
                  </Text>
                </Pressable>
                <Pressable
                  disabled={actionId === item.id}
                  onPress={() => handleDelete(item)}
                  style={[styles.smallButton, styles.deleteButton]}
                >
                  <Text style={[styles.smallButtonText, styles.deleteButtonText]}>Удалить</Text>
                </Pressable>
              </View>
            </Card>
          ))}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm
  },
  title: {
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: "700"
  },
  addButton: {
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: theme.spacing.md
  },
  addButtonText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: "700"
  },
  emptyCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md
  },
  emptyIconWrap: {
    alignItems: "center",
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radius.md,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  emptyTextWrap: {
    flex: 1,
    gap: theme.spacing.xs
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "600"
  },
  emptyDescription: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  list: {
    gap: theme.spacing.sm
  },
  paymentCard: {
    gap: theme.spacing.md
  },
  paymentTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md
  },
  paymentIconWrap: {
    alignItems: "center",
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radius.md,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  paymentMain: {
    flex: 1,
    gap: 3
  },
  paymentTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  paymentMeta: {
    color: theme.colors.textMuted,
    fontSize: 13
  },
  paymentAmount: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "700"
  },
  paidText: {
    color: theme.colors.textMuted,
    textDecorationLine: "line-through"
  },
  comment: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  actions: {
    flexDirection: "row",
    gap: theme.spacing.sm
  },
  smallButton: {
    alignItems: "center",
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    flex: 1,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.sm
  },
  smallButtonDisabled: {
    opacity: 0.55
  },
  smallButtonText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center"
  },
  deleteButton: {
    backgroundColor: "rgba(255, 107, 107, 0.12)"
  },
  deleteButtonText: {
    color: theme.colors.danger
  }
});
