import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/features/auth/AuthContext";
import { getLocalCategories, type LocalCategory } from "@/features/categories/localCategoriesStorage";
import { formatPaymentAmount, formatPaymentDate } from "@/features/payments/paymentFormatters";
import {
  expandPaymentOccurrences,
  getDateValue,
  isPaymentOverdue,
  sortPaymentsByDate
} from "@/features/payments/paymentOccurrences";
import { deletePaymentItem, fetchPaymentItems, markPaymentItemPaid } from "@/features/payments/paymentsApi";
import { AppButton } from "@/shared/ui/AppButton";
import { AppTextInput } from "@/shared/ui/AppTextInput";
import { Card } from "@/shared/ui/Card";
import { EmptyStateText } from "@/shared/ui/PaymentPlaceholderCard";
import { ScreenContainer } from "@/shared/ui/ScreenContainer";
import { theme } from "@/shared/theme/theme";
import type { PaymentItem } from "@/types/payment";

type PaymentFilter = "all" | "unpaid" | "overdue" | "paid" | "repeating";

const filterOptions: Array<{ label: string; value: PaymentFilter }> = [
  { label: "Все", value: "all" },
  { label: "Неоплаченные", value: "unpaid" },
  { label: "Просроченные", value: "overdue" },
  { label: "Оплаченные", value: "paid" },
  { label: "Повторяющиеся", value: "repeating" }
];

export default function ListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [categories, setCategories] = useState<LocalCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<PaymentFilter>("all");
  const [search, setSearch] = useState("");
  const focusedRef = useRef(false);
  const loadingRef = useRef(false);
  const expandedItems = useMemo(
    () =>
      expandPaymentOccurrences(items, {
        startDate: "1970-01-01"
      }),
    [items]
  );
  const visibleItems = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("ru-RU");

    return expandedItems.filter((item) => {
      if (normalizedSearch && !item.title.toLocaleLowerCase("ru-RU").includes(normalizedSearch)) {
        return false;
      }

      if (filter === "unpaid") {
        return item.status !== "paid";
      }

      if (filter === "overdue") {
        return isPaymentOverdue(item);
      }

      if (filter === "paid") {
        return item.status === "paid";
      }

      if (filter === "repeating") {
        return item.repeatRule !== "none" || Boolean(item.isGeneratedOccurrence);
      }

      return true;
    });
  }, [expandedItems, filter, search]);
  const groupedItems = useMemo(
    () => [
      {
        title: "Просроченные",
        data: sortPaymentsByDate(visibleItems.filter((item) => isPaymentOverdue(item)))
      },
      {
        title: "Ближайшие",
        data: sortPaymentsByDate(visibleItems.filter((item) => item.status !== "paid" && !isPaymentOverdue(item)))
      },
      {
        title: "Оплаченные",
        data: sortPaymentsByDate(visibleItems.filter((item) => item.status === "paid"))
      }
    ],
    [visibleItems]
  );
  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
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
      const nextCategories = await getLocalCategories(user.id).catch(() => null);

      if (focusedRef.current) {
        setItems(nextItems);
        if (nextCategories) {
          setCategories(nextCategories);
        }
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

      <AppTextInput
        autoCapitalize="none"
        label="Поиск"
        onChangeText={setSearch}
        placeholder="Название платежа"
        value={search}
      />

      <View style={styles.filterRow}>
        {filterOptions.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => setFilter(option.value)}
            style={[styles.filterChip, filter === option.value && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, filter === option.value && styles.filterTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? (
        <Card style={styles.errorCard}>
          <Text style={styles.errorTitle}>Не удалось загрузить платежи</Text>
          <Text style={styles.errorText}>{error}</Text>
          <AppButton loading={loading} onPress={loadItems} title="Повторить" variant="secondary" />
        </Card>
      ) : null}

      {!error && visibleItems.length === 0 ? (
        <Card style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}>
            <Ionicons color={theme.colors.primary} name="receipt-outline" size={24} />
          </View>
          <View style={styles.emptyTextWrap}>
            <Text style={styles.emptyTitle}>Пока без записей</Text>
            <Text style={styles.emptyDescription}>
              {items.length === 0
                ? "Когда вы добавите платежи, они появятся здесь по порядку дат."
                : "По текущему поиску и фильтрам ничего не найдено."}
            </Text>
          </View>
        </Card>
      ) : visibleItems.length > 0 ? (
        <View style={styles.list}>
          {groupedItems.map((group) =>
            group.data.length > 0 ? (
              <View key={group.title} style={styles.group}>
                <Text style={styles.sectionTitle}>{group.title}</Text>
                {group.data.map((item) => {
                  const overdue = isPaymentOverdue(item);
                  const sourcePaymentId = item.originalPaymentId ?? item.id;
                  const isRepeating = item.repeatRule !== "none" || Boolean(item.isGeneratedOccurrence);
                  const category = item.categoryId ? categoriesById.get(item.categoryId) : null;

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
                          {category ? (
                            <View style={styles.categoryBadge}>
                              <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                              <Text style={styles.categoryText}>{category.name}</Text>
                            </View>
                          ) : null}
                          {overdue ? <Text style={styles.overdueText}>Просрочен</Text> : null}
                          {isRepeating ? <Text style={styles.repeatText}>Повторяется</Text> : null}
                        </View>
                        <Text style={[styles.paymentAmount, item.status === "paid" && styles.paidText]}>
                          {formatPaymentAmount(item)}
                        </Text>
                      </View>

                      {item.comment ? <Text style={styles.comment}>{item.comment}</Text> : null}

                      <View style={styles.actions}>
                        {item.isGeneratedOccurrence ? (
                          <Pressable
                            onPress={() =>
                              router.push({ pathname: "/edit-payment/[id]", params: { id: sourcePaymentId } })
                            }
                            style={styles.smallButton}
                          >
                            <Text style={styles.smallButtonText}>Редактировать исходный платёж</Text>
                          </Pressable>
                        ) : (
                          <>
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
                          </>
                        )}
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
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  filterChip: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  filterChipActive: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary
  },
  filterText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: "700"
  },
  filterTextActive: {
    color: theme.colors.primary
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
  repeatText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: "700"
  },
  categoryBadge: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.xs
  },
  categoryDot: {
    borderRadius: 5,
    height: 10,
    width: 10
  },
  categoryText: {
    color: theme.colors.textMuted,
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
