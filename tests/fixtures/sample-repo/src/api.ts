import { query } from "./db";

export async function loadUsers() {
  // TODO: add pagination when the API grows.
  return query("select * from users");
}
