import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/features/auth/AuthContext";
import {
  createLocalCategory,
  deleteLocalCategory,
  getLocalCategories,
  updateLocalCategory,
  type LocalCategory
} from "@/features/categories/localCategoriesStorage";
import { clearLocalPaymentCategory } from "@/features/payments/localPaymentsStorage";
import { AppButton } from "@/shared/ui/AppButton";
import { AppTextInput } from "@/shared/ui/AppTextInput";
import { Card } from "@/shared/ui/Card";
import { ScreenContainer } from "@/shared/ui/ScreenContainer";
import { theme } from "@/shared/theme/theme";

const categoryColors = ["#36D17D", "#4FB3FF", "#F2C94C", "#7BDCB5", "#66D9EF", "#9BAAA2", "#FF8A65", "#B48CFF"];
const categoryIcons = [
  "home-outline",
  "briefcase-outline",
  "card-outline",
  "repeat-outline",
  "document-text-outline",
  "car-outline",
  "cart-outline",
  "ellipsis-horizontal-outline"
] as const;

export default function CategoriesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [categories, setCategories] = useState<LocalCategory[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState(categoryColors[0]);
  const [icon, setIcon] = useState<(typeof categoryIcons)[number]>(categoryIcons[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    if (!user) {
      setCategories([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nextCategories = await getLocalCategories(user.id);
      setCategories(nextCategories);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Не удалось загрузить категории.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadCategories();
    }, [loadCategories])
  );

  function resetForm() {
    setName("");
    setColor(categoryColors[0]);
    setIcon(categoryIcons[0]);
    setEditingId(null);
  }

  function handleEdit(category: LocalCategory) {
    setEditingId(category.id);
    setName(category.name);
    setColor(category.color);
    setIcon((categoryIcons.includes(category.icon as (typeof categoryIcons)[number])
      ? category.icon
      : categoryIcons[categoryIcons.length - 1]) as (typeof categoryIcons)[number]);
  }

  async function handleSave() {
    if (saving) {
      return;
    }

    if (!user) {
      setError("Нужно войти в аккаунт.");
      return;
    }

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Введите название категории.");
      return;
    }

    const duplicate = categories.some(
      (category) =>
        category.id !== editingId &&
        category.name.trim().toLocaleLowerCase("ru-RU") === trimmedName.toLocaleLowerCase("ru-RU")
    );

    if (duplicate) {
      setError("Категория с таким названием уже есть.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (editingId) {
        await updateLocalCategory(user.id, editingId, { name: trimmedName, color, icon });
        setCategories((current) =>
          current.map((category) =>
            category.id === editingId
              ? {
                  ...category,
                  name: trimmedName,
                  color,
                  icon,
                  updatedAt: new Date().toISOString()
                }
              : category
          )
        );
      } else {
        const createdCategory = await createLocalCategory(user.id, { name: trimmedName, color, icon });
        setCategories((current) => [...current, createdCategory]);
      }

      resetForm();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Не удалось сохранить категорию.";
      setError(message);
      Alert.alert("Ошибка", message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(category: LocalCategory) {
    if (!user || deletingId) {
      return;
    }

    setDeletingId(category.id);
    setError(null);

    try {
      await deleteLocalCategory(user.id, category.id);
      await clearLocalPaymentCategory(user.id, category.id);
      setCategories((current) => current.filter((item) => item.id !== category.id));

      if (editingId === category.id) {
        resetForm();
      }
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Не удалось удалить категорию.";
      setError(message);
      Alert.alert("Ошибка", message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <ScreenContainer keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons color={theme.colors.primary} name="chevron-back" size={20} />
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
        <Text style={styles.title}>Категории</Text>
        <Text style={styles.subtitle}>Локальные категории помогают быстрее различать платежи.</Text>
      </View>

      <Card style={styles.formCard}>
        <AppTextInput
          label={editingId ? "Название категории" : "Новая категория"}
          onChangeText={setName}
          placeholder="Например, Дом"
          value={name}
        />
        <Text style={styles.pickerLabel}>Иконка</Text>
        <ScrollView contentContainerStyle={styles.iconRow} horizontal showsHorizontalScrollIndicator={false}>
          {categoryIcons.map((itemIcon) => (
            <Pressable
              key={itemIcon}
              onPress={() => setIcon(itemIcon)}
              style={[styles.iconButton, icon === itemIcon && styles.iconButtonActive]}
            >
              <Ionicons color={icon === itemIcon ? theme.colors.text : theme.colors.textMuted} name={itemIcon} size={21} />
            </Pressable>
          ))}
        </ScrollView>
        <Text style={styles.pickerLabel}>Цвет</Text>
        <ScrollView contentContainerStyle={styles.colorRow} horizontal showsHorizontalScrollIndicator={false}>
          {categoryColors.map((itemColor) => (
            <Pressable
              key={itemColor}
              onPress={() => setColor(itemColor)}
              style={[
                styles.colorButton,
                { backgroundColor: itemColor },
                color === itemColor && styles.colorButtonActive
              ]}
            />
          ))}
        </ScrollView>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.formActions}>
          <AppButton
            loading={saving}
            onPress={handleSave}
            title={editingId ? "Сохранить" : "Добавить категорию"}
          />
          {editingId ? <AppButton onPress={resetForm} title="Отменить" variant="secondary" /> : null}
        </View>
      </Card>

      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>Список</Text>
        {loading ? <Text style={styles.loadingText}>Обновляю...</Text> : null}
      </View>

      {categories.length === 0 && !loading ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Категорий пока нет</Text>
          <Text style={styles.emptyText}>Добавьте первую категорию или перезапустите экран для дефолтного списка.</Text>
        </Card>
      ) : null}

      <View style={styles.list}>
        {categories.map((category) => (
          <Card key={category.id} style={styles.categoryCard}>
            <View style={styles.categoryInfo}>
              <View style={[styles.categoryIcon, { borderColor: category.color }]}>
                <Ionicons color={category.color} name={category.icon as keyof typeof Ionicons.glyphMap} size={19} />
              </View>
              <Text style={styles.categoryName}>{category.name}</Text>
            </View>
            <View style={styles.categoryActions}>
              <Pressable onPress={() => handleEdit(category)} style={styles.smallButton}>
                <Text style={styles.smallButtonText}>Редактировать</Text>
              </Pressable>
              <Pressable
                disabled={deletingId === category.id}
                onPress={() => handleDelete(category)}
                style={[styles.smallButton, styles.deleteButton, deletingId === category.id && styles.disabledButton]}
              >
                <Text style={[styles.smallButtonText, styles.deleteButtonText]}>
                  {deletingId === category.id ? "Удаляю..." : "Удалить"}
                </Text>
              </Pressable>
            </View>
          </Card>
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: theme.spacing.xs
  },
  backButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.xs
  },
  backText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: "700"
  },
  title: {
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: "700"
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 15,
    lineHeight: 22
  },
  formCard: {
    gap: theme.spacing.md
  },
  colorRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingHorizontal: 2,
    paddingVertical: 2
  },
  iconRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingHorizontal: 2,
    paddingVertical: 2
  },
  pickerLabel: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: "600"
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  iconButtonActive: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary
  },
  colorButton: {
    borderColor: "transparent",
    borderRadius: 16,
    borderWidth: 2,
    height: 32,
    width: 32
  },
  colorButtonActive: {
    borderColor: theme.colors.text
  },
  error: {
    color: theme.colors.danger,
    fontSize: 14,
    lineHeight: 20
  },
  formActions: {
    gap: theme.spacing.sm
  },
  listHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "700"
  },
  loadingText: {
    color: theme.colors.textMuted,
    fontSize: 13
  },
  emptyCard: {
    gap: theme.spacing.xs
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  list: {
    gap: theme.spacing.sm
  },
  categoryCard: {
    gap: theme.spacing.md
  },
  categoryInfo: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm
  },
  categoryIcon: {
    alignItems: "center",
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  categoryName: {
    color: theme.colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: "700"
  },
  categoryActions: {
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
  },
  disabledButton: {
    opacity: 0.55
  }
});
