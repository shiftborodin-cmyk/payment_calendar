import AsyncStorage from "@react-native-async-storage/async-storage";

export type LocalCategory = {
  id: string;
  userId: string;
  name: string;
  color: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
};

export type LocalCategoryInput = {
  name: string;
  color: string;
  icon: string;
};

type LocalCategoryRow = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon?: string;
  created_at: string;
  updated_at: string;
};

const defaultCategories: Array<Pick<LocalCategoryRow, "name" | "color" | "icon">> = [
  { name: "Дом", color: "#36D17D", icon: "home-outline" },
  { name: "Работа", color: "#4FB3FF", icon: "briefcase-outline" },
  { name: "Кредиты", color: "#F2C94C", icon: "card-outline" },
  { name: "Подписки", color: "#7BDCB5", icon: "repeat-outline" },
  { name: "Налоги", color: "#66D9EF", icon: "document-text-outline" },
  { name: "Прочее", color: "#9BAAA2", icon: "ellipsis-horizontal-outline" }
];

const localOperationTimeoutMs = 5000;
const verboseLocalDiagnostics = false;
let localRequestCounter = 0;

function getOperationName(label: string) {
  if (label.startsWith("Загрузка")) {
    return "fetch";
  }

  if (label.startsWith("Создание")) {
    return "create";
  }

  if (label.startsWith("Обновление")) {
    return "update";
  }

  if (label.startsWith("Удаление")) {
    return "delete";
  }

  return "operation";
}

function getSuccessMeta(result: unknown) {
  return Array.isArray(result) ? { count: result.length } : null;
}

async function withLocalCategoryDiagnostics<T>(label: string, operation: () => Promise<T>) {
  const requestId = localRequestCounter + 1;
  localRequestCounter = requestId;

  const operationName = getOperationName(label);
  const timeoutMessage = `${label}: локальное хранилище не ответило за 5 секунд`;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  if (verboseLocalDiagnostics) {
    console.log(`[localCategories] ${operationName} start #${requestId}`);
  }

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      console.error(`[localCategories] timeout #${requestId}`, timeoutMessage);
      reject(new Error(timeoutMessage));
    }, localOperationTimeoutMs);
  });

  try {
    const result = await Promise.race([operation(), timeout]);
    const successMeta = getSuccessMeta(result);

    if (verboseLocalDiagnostics) {
      if (successMeta) {
        console.log(`[localCategories] ${operationName} success #${requestId}`, successMeta);
      } else {
        console.log(`[localCategories] ${operationName} success #${requestId}`);
      }
    }

    return result;
  } catch (error) {
    console.error(`[localCategories] failed #${requestId}`, error);
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function getStorageKey(userId: string) {
  return `payment_categories:${userId}`;
}

function createLocalId() {
  return `category_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getLegacyCategoryIcon(name: string) {
  const normalizedName = name.trim().toLocaleLowerCase("ru-RU");
  return defaultCategories.find((category) => category.name.toLocaleLowerCase("ru-RU") === normalizedName)?.icon
    ?? "wallet-outline";
}

function mapLocalCategory(row: LocalCategoryRow): LocalCategory {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color,
    icon: row.icon ?? getLegacyCategoryIcon(row.name),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function sortCategoryRows(rows: LocalCategoryRow[]) {
  return [...rows].sort((left, right) => left.created_at.localeCompare(right.created_at));
}

async function readRows(userId: string) {
  const rawValue = await AsyncStorage.getItem(getStorageKey(userId));

  if (!rawValue) {
    const now = new Date().toISOString();
    const initialRows = defaultCategories.map((category, index) => ({
      id: `default_${index + 1}_${category.name.toLocaleLowerCase("ru-RU")}`,
      user_id: userId,
      name: category.name,
      color: category.color,
      icon: category.icon,
      created_at: now,
      updated_at: now
    }));

    await writeRows(userId, initialRows);
    return initialRows;
  }

  try {
    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue) ? (parsedValue as LocalCategoryRow[]) : [];
  } catch {
    return [];
  }
}

async function writeRows(userId: string, rows: LocalCategoryRow[]) {
  await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(sortCategoryRows(rows)));
}

export async function getLocalCategories(userId: string) {
  return withLocalCategoryDiagnostics("Загрузка локальных категорий", async () => {
    const rows = await readRows(userId);
    return sortCategoryRows(rows).map(mapLocalCategory);
  });
}

export async function createLocalCategory(userId: string, input: LocalCategoryInput) {
  return withLocalCategoryDiagnostics("Создание локальной категории", async () => {
    const rows = await readRows(userId);
    const now = new Date().toISOString();
    const category: LocalCategoryRow = {
      id: createLocalId(),
      user_id: userId,
      name: input.name,
      color: input.color,
      icon: input.icon,
      created_at: now,
      updated_at: now
    };

    await writeRows(userId, [...rows, category]);

    return mapLocalCategory(category);
  });
}

export async function updateLocalCategory(userId: string, categoryId: string, input: LocalCategoryInput) {
  return withLocalCategoryDiagnostics("Обновление локальной категории", async () => {
    const rows = await readRows(userId);
    const now = new Date().toISOString();
    const nextRows = rows.map((category) =>
      category.id === categoryId
        ? {
            ...category,
            name: input.name,
            color: input.color,
            icon: input.icon,
            updated_at: now
          }
        : category
    );

    await writeRows(userId, nextRows);
  });
}

export async function deleteLocalCategory(userId: string, categoryId: string) {
  return withLocalCategoryDiagnostics("Удаление локальной категории", async () => {
    const rows = await readRows(userId);
    await writeRows(userId, rows.filter((category) => category.id !== categoryId));
  });
}
