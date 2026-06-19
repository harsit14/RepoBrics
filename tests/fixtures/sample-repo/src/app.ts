import { loadUsers } from "./api";
import { theme } from "./theme";

export async function startApp() {
  const users = await loadUsers();
  return {
    theme,
    users
  };
}
