# Payment Calendar project rules

## Product and communication

- This is an MVP for a non-developer owner. Explain material technical decisions in plain Russian.
- Prefer stable, familiar mobile interactions over custom gesture implementations.
- Keep changes scoped. Preserve working behavior outside the requested feature.

## Data and services

- Payments and categories are local-first and stored in AsyncStorage.
- Do not restore Supabase reads or writes for payments or categories unless the user explicitly requests synchronization work.
- Supabase is currently used only for authentication. Never use a service-role key in the app.
- Preserve backward compatibility with older AsyncStorage records whose newer optional fields are absent.

## Expo and dependencies

- The app is tested with Expo Go on Android, including a Samsung Galaxy S24.
- Do not import `expo-notifications` into the Expo Go runtime. Notification work requires a separate development-build task.
- Do not change Expo, React, React Native, Expo Router, package versions, `package.json`, or the lockfile unless explicitly authorized.
- Do not install a new dependency when a stable React Native primitive already covers the interaction.

## Calendar and dates

- Never parse a payment date with `new Date("YYYY-MM-DD")` and never use `toISOString()` to derive its local calendar day.
- Use the helpers in `src/features/payments/paymentDates.ts`.
- Preserve the desired day when paging months: 31 July -> 31 August -> 30 September -> 31 October.
- Month and week calendars must support both tapping a date and native horizontal paging.
- On Android, prevent the outer vertical scroll view from stealing a gesture that begins inside the horizontal calendar viewport.

## Verification and Git

- Run `npx tsc --noEmit` after code changes.
- Run `git diff --check` before handoff.
- Do not commit, merge, reset, or discard user changes unless explicitly requested.
- Do not modify `.env`, SQL, authentication, notifications, or dependencies as an incidental part of another task.
- At handoff, list changed files, checks run, and the exact behavior the user should verify in Expo Go.
