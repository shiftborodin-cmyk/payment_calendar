export type AppLanguage = "ru" | "en";

let currentLanguage: AppLanguage = "ru";

export function setCurrentLanguage(language: AppLanguage) {
  currentLanguage = language;
}

export function getCurrentLanguage() {
  return currentLanguage;
}

export function getCurrentLocale() {
  return currentLanguage === "en" ? "en-US" : "ru-RU";
}

export function translate(ru: string, en: string) {
  return currentLanguage === "en" ? en : ru;
}
