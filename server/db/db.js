import pg from "pg";
const { Pool } = pg;
import dotenv from "dotenv"; 
dotenv.config();

// Configuración de la conexión a las bases de datos 

export const appDb = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export const gobDb = new Pool({
  connectionString: process.env.DATABASE_GOB_URL,
  ssl: { rejectUnauthorized: false }
});