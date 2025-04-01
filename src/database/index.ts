import { SqliteDatabaseAdapter } from "@elizaos/adapter-sqlite";
import { MongoDBDatabaseAdapter } from "@elizaos/adapter-mongodb";
import Database from "better-sqlite3";
import path from "path";
import { MongoClient } from "mongodb";

export function initializeDatabase(dataDir: string) {
  if (process.env.MONGO_URL) {
    const db = new MongoDBDatabaseAdapter(new MongoClient(process.env.MONGO_URL), "espressox");
    return db;
  } else {
    const filePath =
      process.env.SQLITE_FILE ?? path.resolve(dataDir, "db.sqlite");
    // ":memory:";
    const db = new SqliteDatabaseAdapter(new Database(filePath));
    return db;
  }
}
