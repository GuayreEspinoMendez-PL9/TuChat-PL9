// tuchat/src/services/syncService.ts
import axios from 'axios';
import { saveMessageLocal } from '../db/database';

const API_URL = "http://localhost:4000";

export const syncMessages = async (userId: string, token: string) => {
  try {
    // 1. T3: Descargar pendientes de Redis
    const response = await axios.get(`${API_URL}/mensajes/pendientes/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.data.ok && response.data.mensajes.length > 0) {
      // 2. T5/T7: Guardar en SQLite (saveMessageLocal ya evita duplicados)
      response.data.mensajes.forEach((msg: any) => {
        if (typeof saveMessageLocal === 'function') saveMessageLocal(msg);
      });

      // 3. T3: Confirmar al servidor (ACK) para que limpie Redis
      await axios.post(`${API_URL}/mensajes/ack`, { userId }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log(`✅ Sincronizados ${response.data.mensajes.length} mensajes.`);
      return true;
    }
    return false;
  } catch (error) {
    console.error("❌ Error en syncMessages:", error);
    return false;
  }
};