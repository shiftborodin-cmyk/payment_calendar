import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/features/auth/AuthContext";
import { formatPaymentAmount, formatPaymentDate } from "@/features/payments/paymentFormatters";
import { deletePaymentItem, fetchPaymentItems, markPaymentItemPaid } from "@/features/payments/paymentsApi";
import { AppButton } from "@/shared/ui/AppButton";
import { Card } from "@/shared/ui/Card";
import { EmptyStateText } from "@/shared/ui/PaymentPlaceholderCard";
import { ScreenContainer } from "@/shared/ui/ScreenContainer";
import { theme } from "@/shared/theme/theme";
import type { PaymentItem } from "@/types/payment";

function getTodayDateValue() {
  return new Date().toISOString().slice(0, 10);
}

function isPaymentOverdue(item: PaymentItem) {
  return item.status !== "paid" && item.date < getTodayDateValue();
}

function sortByDate(items: PaymentItem[]) {
  return [...items].sort((left, right) => left.date.localeCompare(right.date) || left.createdAt.localeCompare(right.createdAt));
}

export default function ListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const focusedRef = useRef(false);
  const loadingRef = useRef(false);
  const groupedItems = useMemo(
    () => [
      {
        title: "Просроченные",
        data: sortByDate(items.filter((item) => isPaymentOverdue(item)))
      },
      {
        title: "Ближайшие",
        data: sortByDate(items.filter((item) => item.status !== "paid" && !isPaymentOverdue(item)))
      },
      {
        title: "Оплаченные",
        data: sortByDate(items.filter((item) => item.status === "paid"))
      }
    ],
    [items]
  );

  const loadItems = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }

    if (loadingRef.current) {
      return;
    }

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const nextItems = await fetchPaymentItems(user.id);

      if (focusedRef.current) {
        setItems(nextItems);
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Не удалось загрузить платежи.";

      if (focusedRef.current) {
        setError(message);
      }
    } finally {
      loadingRef.current = false;

      if (focusedRef.current) {
        setLoading(false);
      }
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      loadItems();

      return () => {
        focusedRef.current = false;
      };
    }, [loadItems])
  );

  async function handleMarkPaid(item: PaymentItem) {
    if (!user) {
      Alert.alert("Ошибка", "Нужно войти в аккаунт.");
      return;
    }

    setActionId(item.id);

    try {
      await markPaymentItemPaid(user.id, item.id);
      await loadItems();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось отметить платёж.";
      Alert.alert("Ошибка", message);
    } finally {
      setActionId(null);
    }
  }

  async function handleDelete(item: PaymentItem) {
    if (!user) {
      Alert.alert("Ошибка", "Нужно войти в аккаунт.");
      return;
    }

    setActionId(item.id);

    try {
      await deletePaymentItem(user.id, item.id);
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

      {error ? (
        <Card style={styles.errorCard}>
          <Text style={styles.errorTitle}>Не удалось загрузить платежи</Text>
          <Text style={styles.errorText}>{error}</Text>
          <AppButton loading={loading} onPress={loadItems} title="Повторить" variant="secondary" />
        </Card>
      ) : null}

      {!error && items.length === 0 ? (
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
      ) : items.length > 0 ? (
        <View style={styles.list}>
          {groupedItems.map((group) =>
            group.data.length > 0 ? (
              <View key={group.title} style={styles.group}>
                <Text style={styles.sectionTitle}>{group.title}</Text>
                {group.data.map((item) => {
                  const overdue = isPaymentOverdue(item);

                  return (
                    <Card key={item.id} style={[styles.paymentCard, overdue && styles.overdueCard]}>
                      <View style={styles.paymentTopRow}>
                        <View style={styles.paymentIconWrap}>
                          <Ionicons
                            color={
                              item.status === "paid"
                                ? theme.colors.textMuted
                                : overdue
                                  ? theme.colors.danger
                                  : theme.colors.primary
                            }
                            name={item.status === "paid" ? "checkmark-circle-outline" : "wallet-outline"}
                            size={22}
                          />
                        </View>
                        <View style={styles.paymentMain}>
                          <Text style={[styles.paymentTitle, item.status === "paid" && styles.paidText]}>
                            {item.title}
                          </Text>
                          <Text style={styles.paymentMeta}>{formatPaymentDate(item.date)}</Text>
                          {overdue ? <Text style={styles.overdueText}>Просрочен</Text> : null}
                        </View>
                        <Text style={[styles.paymentAmount, item.status === "paid" && styles.paidText]}>
                          {formatPaymentAmount(item)}
                        </Text>
                      </View>

                      {item.comment ? <Text style={styles.comment}>{item.comment}</Text> : null}

                      <View style={styles.actions}>
                        <Pressable
                          onPress={() => router.push({ pathname: "/edit-payment/[id]", params: { id: item.id } })}
                          style={styles.smallButton}
                        >
                          <Text style={styles.smallButtonText}>Редактировать</Text>
                        </Pressable>
                        <Pressable
                          disabled={item.status === "paid" || actionId === item.id}
                          onPress={() => handleMarkPaid(item)}
                          style={[
                            styles.smallButton,
                            item.status === "paid" && styles.smallButtonDisabled
                          ]}
                        >
                          <Text style={styles.smallButtonText}>
                            {item.status === "paid" ? "Оплачено" : "Оплатить"}
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
                  );
                })}
              </View>
            ) : null
          )}
        </View>
      ) : null}
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
  errorCard: {
    gap: theme.spacing.sm
  },
  errorTitle: {
    color: theme.colors.danger,
    fontSize: 16,
    fontWeight: "700"
  },
  errorText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20
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
  group: {
    gap: theme.spacing.sm
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginTop: theme.spacing.xs
  },
  paymentCard: {
    gap: theme.spacing.md
  },
  overdueCard: {
    borderColor: theme.colors.danger
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
  overdueText: {
    color: theme.colors.danger,
    fontSize: 12,
    fontWeight: "700"
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
