import { createStore, type Store, type StoredUser } from "@/lib/store";
export function mk(): { store: Store; u: (name: string) => StoredUser } {
  const store = createStore();
  return { store, u: (name) => store.state.users.find((x) => x.email === `${name}@demo.example`)! };
}
