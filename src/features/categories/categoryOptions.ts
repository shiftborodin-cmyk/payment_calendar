export const categoryColors = [
  "#36D17D",
  "#4FB3FF",
  "#F2C94C",
  "#7BDCB5",
  "#66D9EF",
  "#9BAAA2",
  "#FF8A65",
  "#B48CFF"
] as const;

export const categoryIcons = [
  "home-outline",
  "briefcase-outline",
  "card-outline",
  "repeat-outline",
  "document-text-outline",
  "car-outline",
  "cart-outline",
  "ellipsis-horizontal-outline",
  "restaurant-outline",
  "cafe-outline",
  "medkit-outline",
  "fitness-outline",
  "school-outline",
  "airplane-outline",
  "bus-outline",
  "train-outline",
  "phone-portrait-outline",
  "wifi-outline",
  "flash-outline",
  "water-outline",
  "gift-outline",
  "paw-outline",
  "game-controller-outline",
  "musical-notes-outline",
  "wallet-outline",
  "cash-outline",
  "book-outline",
  "camera-outline"
] as const;

export type CategoryIcon = (typeof categoryIcons)[number];
