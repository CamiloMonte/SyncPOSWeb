# Zustand integration (SENA guide "Zustand en React con Vite", activity 3.4)

## Objective
Move the state that is really global in the SyncPOS web panel to Zustand stores, remove the prop drilling, and keep every existing feature working.

## Why
- `App.jsx` holds the session user and passes it down through props to Header, Sidebar and the route guards (prop drilling).
- The session lives in hand-written localStorage helpers in `services/api.js` plus a custom `syncpos:logout` window event.
- The class guide (activity 3.4) requires: Zustand installed with `src/store/`, at least two stores (one `useAuthStore` with user, token, login, logout, isAuthenticated), one async action against the backend with loading and error, a justified `persist`, selectors everywhere, route guards reading `useAuthStore`, branch `feature/zustand` + PR, README section "Manejo de estado".

## Scope (authorized by the user on 2026-10-26: "si, arranca con la 3.4 en SyncPOS")
- Stores: `useAuthStore` (persist user + token), `useCartStore` (cashier POS cart, persist — justification: a page reload in the middle of a sale must not lose the cart), `useInventoryStore` (products + categories + filters, async CRUD with loading/error).
- Keep `fetch` (no axios). Keep react-router-dom routes and role guards.
- Docs: README "Manejo de estado"; `docs/analisis-estado.md` with the component tree and the shared-data table (guide 3.2 B) as a draft for the group to review.
- Out of scope: the individual parts of the guide (reflection, diagnostic, Tienda SENA practice).

## Constraints
- Comments in Spanish WITHOUT accents, `// HOOK:` prefix when explaining hooks (class convention); UI text with accents.
- Immutability in every action (spread, map, filter; never push).
- Never select the whole store (`useXStore()` without a selector is forbidden); `useShallow` when reading several values at once.
- persist never stores passwords; only `user` and `token` for auth, only cart items + payment method for the cart.

## Tasks
- [x] Z1 Install zustand, create `src/store/useAuthStore.js` (persist), make `api.js` read the token with `useAuthStore.getState()` and call `logout()` on 401 (delegated writer)
- [x] Z2 Remove prop drilling: App, Login, Header, Sidebar, ProtectedRoute, RoleRoute, Users read the session from `useAuthStore` with selectors; remove the `syncpos:logout` event and the old session helpers (delegated writer)
- [x] Z3 `useCartStore` with persist for CashierPos (add/increment/decrement/remove/clear, stock cap, payment method, `registerSale` async with loading/error) (delegated writer)
- [x] Z4 `useInventoryStore` for Inventory (products, categories, filters, page, fetch/save/toggle with loading/error) (delegated writer)
- [x] Z5 README "Manejo de estado" + `docs/analisis-estado.md` (delegated writer)
- [ ] Z6 Parent verification: build, lint, browser E2E (login/logout, reload keeps session, role guards, 401 logout, inventory CRUD, POS cart survives reload, sale registers), Local Storage keys inspected

## Checks
- TDD: off. Runner: `npm run build` + `npm run lint`; browser E2E by the parent.
- One Conventional Commit per task on `feature/zustand`, authored by the repo-local identity. No push / PR until the user asks.

## Progress
- 2026-10-26: Branch `feature/zustand` created from main, plan written.
- 2026-10-26: Z1-Z5 implemented by delegated writer. Commits: Z1 71033b8, Z2 f326561, Z3 1d7f910, Z4 49109b4, Z5 docs. build + lint pass; grep checks clean (no whole-store subscriptions, no old session helpers, no push in store). Note: Z1 commit alone does not build (Login still used removed helpers until Z2). Open point: logout does not clear the persisted cart (listed as a group question in docs). Z6 (browser E2E) pending, owned by parent.
