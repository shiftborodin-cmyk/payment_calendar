import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/features/auth/AuthContext";
import { getLocalCategories, type LocalCategory } from "@/features/categories/localCategoriesStorage";
import { getCategoryCardBackground } from "@/features/categories/categoryColors";
import { useAppSettings } from "@/features/settings/AppSettingsContext";
import { translate } from "@/features/settings/i18n";
import { formatPaymentAmount, formatPaymentDate } from "@/features/payments/paymentFormatters";
import {
  expandPaymentOccurrences,
  getDateValue,
  isPaymentOverdue,
  sortPaymentsByDate
} from "@/features/payments/paymentOccurrences";
import { deletePaymentItem, fetchPaymentItems, setPaymentItemStatus } from "@/features/payments/paymentsApi";
import { AppButton } from "@/shared/ui/AppButton";
import { AppTextInput } from "@/shared/ui/AppTextInput";
import { Card } from "@/shared/ui/Card";
import { EmptyStateText } from "@/shared/ui/PaymentPlaceholderCard";
import { ScreenContainer } from "@/shared/ui/ScreenContainer";
import { theme } from "@/shared/theme/theme";
import type { PaymentItem } from "@/types/payment";

type PaymentFilter = "all" | "unpaid" | "overdue" | "paid";

const filterOptions: Array<{ ru: string; en: string; value: PaymentFilter }> = [
  { ru: "Все", en: "All", value: "all" },
  { ru: "Активные", en: "Active", value: "unpaid" },
  { ru: "Просроченные", en: "Overdue", value: "overdue" },
  { ru: "Оплаченные", en: "Paid", value: "paid" }
];

export default function ListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { settings } = useAppSettings();
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [categories, setCategories] = useState<LocalCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<PaymentFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [repeatingOnly, setRepeatingOnly] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [search, setSearch] = useState("");
  const focusedRef = useRef(false);
  const loadingRef = useRef(false);
  const availableItems = useMemo(
    () => items.filter((item) => settings.includeIncome || item.type !== "income"),
    [items, settings.includeIncome]
  );
  const expandedItems = useMemo(
    () =>
      expandPaymentOccurrences(availableItems, {
        startDate: "1970-01-01"
      }),
    [availableItems]
  );
  const visibleItems = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("ru-RU");

    return expandedItems.filter((item) => {
      if (normalizedSearch && !item.title.toLocaleLowerCase("ru-RU").includes(normalizedSearch)) {
        return false;
      }

      if (categoryFilter && item.categoryId !== categoryFilter) {
        return false;
      }

      if (repeatingOnly && item.repeatRule === "none" && !item.isGeneratedOccurrence) {
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

      return true;
    });
  }, [categoryFilter, expandedItems, filter, repeatingOnly, search]);
  const groupedItems = useMemo(
    () => [
      {
        title: translate("Просроченные", "Overdue"),
        data: sortPaymentsByDate(visibleItems.filter((item) => isPaymentOverdue(item)))
      },
      {
        title: translate("Ближайшие", "Upcoming"),
        data: sortPaymentsByDate(visibleItems.filter((item) => item.status !== "paid" && !isPaymentOverdue(item)))
      },
      {
        title: translate("Оплаченные", "Paid"),
        data: sortPaymentsByDate(visibleItems.filter((item) => item.status === "paid"))
      }
    ],
    [settings.language, visibleItems]
  );
  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );
  const advancedFilterCount = Number(Boolean(categoryFilter)) + Number(repeatingOnly);

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
      const message = loadError instanceof Error ? loadError.message : translate("Не удалось загрузить платежи.", "Could not load payments.");

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

  async function handleTogglePaid(item: PaymentItem) {
    if (!user) {
      Alert.alert(translate("Ошибка", "Error"), translate("Нужно войти в аккаунт.", "Please sign in."));
      return;
    }

    setActionId(item.id);

    try {
      await setPaymentItemStatus(user.id, item.id, item.status === "paid" ? "scheduled" : "paid");
      await loadItems();
    } catch (error) {
      const message = error instanceof Error ? error.message : translate("Не удалось изменить статус платежа.", "Could not change payment status.");
      Alert.alert(translate("Ошибка", "Error"), message);
    } finally {
      setActionId(null);
    }
  }

  async function deleteItem(item: PaymentItem) {
    if (!user) {
      Alert.alert(translate("Ошибка", "Error"), translate("Нужно войти в аккаунт.", "Please sign in."));
      return;
    }

    setActionId(item.id);

    try {
      await deletePaymentItem(user.id, item.id);
      await loadItems();
    } catch (error) {
      const message = error instanceof Error ? error.message : translate("Не удалось удалить платёж.", "Could not delete payment.");
      Alert.alert(translate("Ошибка", "Error"), message);
    } finally {
      setActionId(null);
    }
  }

  function handleDelete(item: PaymentItem) {
    Alert.alert(
      translate("Удалить платёж?", "Delete payment?"),
      translate(`«${item.title}» будет удалён без возможности восстановления.`, `“${item.title}” will be permanently deleted.`),
      [
        { text: translate("Отмена", "Cancel"), style: "cancel" },
        { text: translate("Удалить", "Delete"), style: "destructive", onPress: () => void deleteItem(item) }
      ]
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{translate("Список", "List")}</Text>
          <Pressable
            accessibilityLabel={translate("Добавить платёж", "Add payment")}
            onPress={() => router.push("/add-payment")}
            style={({ pressed }) => [styles.addIconButton, pressed && styles.buttonPressed]}
          >
            <Ionicons color={theme.colors.background} name="add" size={25} />
          </Pressable>
        </View>
        <EmptyStateText>
          {loading ? translate("Загружаю платежи...", "Loading payments...") : translate("Все платежи по порядку дат", "All payments ordered by date")}
        </EmptyStateText>
      </View>

      <AppTextInput
        autoCapitalize="none"
        label={translate("Поиск", "Search")}
        onChangeText={setSearch}
        placeholder={translate("Название платежа", "Payment name")}
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
              {translate(option.ru, option.en)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={() => setShowAdvancedFilters((current) => !current)}
        style={({ pressed }) => [styles.advancedFilterButton, pressed && styles.buttonPressed]}
      >
        <Ionicons color={theme.colors.primary} name="options-outline" size={18} />
        <Text style={styles.advancedFilterButtonText}>
          {translate("Фильтры", "Filters")}{advancedFilterCount > 0 ? ` · ${advancedFilterCount}` : ""}
        </Text>
        <Ionicons
          color={theme.colors.textMuted}
          name={showAdvancedFilters ? "chevron-up" : "chevron-down"}
          size={17}
        />
      </Pressable>

      {showAdvancedFilters ? (
        <Card style={styles.advancedFiltersCard}>
          <Text style={styles.filterLabel}>{translate("Дополнительно", "More filters")}</Text>
          <View style={styles.filterRow}>
            <Pressable
              onPress={() => setRepeatingOnly((current) => !current)}
              style={[styles.filterChip, repeatingOnly && styles.filterChipActive]}
            >
              <Ionicons color={repeatingOnly ? theme.colors.primary : theme.colors.textMuted} name="repeat" size={15} />
              <Text style={[styles.filterText, repeatingOnly && styles.filterTextActive]}>{translate("Повторяющиеся", "Repeating")}</Text>
            </Pressable>
          </View>

          {categories.length > 0 ? (
            <>
              <Text style={styles.filterLabel}>{translate("Категория", "Category")}</Text>
              <View style={styles.filterRow}>
                <Pressable
                  onPress={() => setCategoryFilter(null)}
                  style={[styles.filterChip, categoryFilter === null && styles.filterChipActive]}
                >
                  <Text style={[styles.filterText, categoryFilter === null && styles.filterTextActive]}>{translate("Все", "All")}</Text>
                </Pressable>
                {categories.map((category) => (
                  <Pressable
                    key={category.id}
                    onPress={() => setCategoryFilter(category.id)}
                    style={[styles.filterChip, categoryFilter === category.id && styles.filterChipActive]}
                  >
                    <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                    <Text style={[styles.filterText, categoryFilter === category.id && styles.filterTextActive]}>
                      {category.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {advancedFilterCount > 0 ? (
            <Pressable
              onPress={() => {
                setCategoryFilter(null);
                setRepeatingOnly(false);
              }}
            >
              <Text style={styles.resetFiltersText}>{translate("Сбросить дополнительные фильтры", "Reset extra filters")}</Text>
            </Pressable>
          ) : null}
        </Card>
      ) : null}

      {error ? (
        <Card style={styles.errorCard}>
          <Text style={styles.errorTitle}>{translate("Не удалось загрузить платежи", "Could not load payments")}</Text>
          <Text style={styles.errorText}>{error}</Text>
          <AppButton loading={loading} onPress={loadItems} title={translate("Повторить", "Retry")} variant="secondary" />
        </Card>
      ) : null}

      {!error && visibleItems.length === 0 ? (
        <Card style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}>
            <Ionicons color={theme.colors.primary} name="receipt-outline" size={24} />
          </View>
          <View style={styles.emptyTextWrap}>
            <Text style={styles.emptyTitle}>{translate("Пока без записей", "No entries yet")}</Text>
            <Text style={styles.emptyDescription}>
              {availableItems.length === 0
                ? translate("Когда вы добавите платежи, они появятся здесь по порядку дат.", "Your payments will appear here in date order.")
                : translate("По текущему поиску и фильтрам ничего не найдено.", "Nothing matches the current search and filters.")}
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
                    <Card
                      key={item.id}
                      style={[
                        styles.paymentCard,
                        category ? { backgroundColor: getCategoryCardBackground(category.color) } : null,
                        overdue && styles.overdueCard
                      ]}
                    >
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
                            name={item.status === "paid" ? "checkmark-circle-outline" : item.type === "income" ? "cash-outline" : (category?.icon as keyof typeof Ionicons.glyphMap) ?? "wallet-outline"}
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
                              <Ionicons color={category.color} name={category.icon as keyof typeof Ionicons.glyphMap} size={14} />
                              <Text style={styles.categoryText}>{category.name}</Text>
                            </View>
                          ) : null}
                          {item.type === "income" ? <Text style={styles.incomeText}>{translate("Доход", "Income")}</Text> : null}
                          {item.type === "income" && item.status === "paid" ? (
                            <Text style={styles.receivedText}>{translate("Получено", "Received")}</Text>
                          ) : null}
                          {overdue ? <Text style={styles.overdueText}>{translate("Просрочен", "Overdue")}</Text> : null}
                          {isRepeating ? <Text style={styles.repeatText}>{translate("Повторяется", "Repeating")}</Text> : null}
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
                            <Text style={styles.smallButtonText}>{translate("Редактировать исходный платёж", "Edit original payment")}</Text>
                          </Pressable>
                        ) : (
                          <>
                            <Pressable
                              onPress={() => router.push({ pathname: "/edit-payment/[id]", params: { id: item.id } })}
                              style={styles.smallButton}
                            >
                              <Text style={styles.smallButtonText}>{translate("Редактировать", "Edit")}</Text>
                            </Pressable>
                            <Pressable
                              disabled={actionId === item.id}
                              onPress={() => handleTogglePaid(item)}
                              style={styles.smallButton}
                            >
                              <Text style={styles.smallButtonText}>
                                {item.status === "paid"
                                  ? translate("Вернуть в запланированные", "Restore to planned")
                                  : item.type === "income"
                                    ? translate("Получено", "Mark received")
                                    : translate("Оплатить", "Mark paid")}
                              </Text>
                            </Pressable>
                            <Pressable
                              disabled={actionId === item.id}
                              onPress={() => handleDelete(item)}
                              style={[styles.smallButton, styles.deleteButton]}
                            >
                              <Text style={[styles.smallButtonText, styles.deleteButtonText]}>{translate("Удалить", "Delete")}</Text>
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
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  title: {
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: "700"
  },
  addIconButton: {
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  buttonPressed: {
    opacity: 0.78
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  filterChip: {
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.xs,
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
  advancedFilterButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.xs,
    minHeight: 38,
    paddingHorizontal: theme.spacing.md
  },
  advancedFilterButtonText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: "700"
  },
  advancedFiltersCard: {
    gap: theme.spacing.sm
  },
  filterLabel: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: "700"
  },
  resetFiltersText: {
    color: theme.colors.primary,
    fontSize: 13,
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
  repeatText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: "700"
  },
  incomeText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: "700"
  },
  receivedText: {
    color: theme.colors.textMuted,
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
