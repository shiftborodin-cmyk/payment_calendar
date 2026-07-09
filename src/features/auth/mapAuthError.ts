const errorMessages: Record<string, string> = {
  "Invalid login credentials": "Неверный email или пароль.",
  "User already registered": "Пользователь с таким email уже зарегистрирован.",
  "Password should be at least 6 characters": "Пароль должен содержать минимум 6 символов.",
  "Unable to validate email address: invalid format": "Некорректный формат email.",
  "Email not confirmed": "Подтвердите email — проверьте почту и перейдите по ссылке из письма."
};

export function mapAuthError(message: string): string {
  return errorMessages[message] ?? "Не удалось выполнить действие. Попробуйте ещё раз.";
}
