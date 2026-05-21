import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../credenciales";

export async function verificarRefrescoMercado(refrescarMercado) {
  const refAdmin = doc(db, "admin", "mercado");
  const snap = await getDoc(refAdmin);

  const ahora = new Date();
  const medianocheHoy = new Date();
  medianocheHoy.setHours(0, 0, 0, 0); // 00:00 hoy

  if (!snap.exists()) {
    // primera vez
    await setDoc(refAdmin, { 
      ultimaActualizacion: medianocheHoy, 
      ultimaActualizacionHora: ahora 
    });
    await refrescarMercado();
    return true; // ✅ AÑADIDO: Retorna true porque se ha refrescado
  }

  const data = snap.data();
  const ultimaDia = data.ultimaActualizacion?.toDate?.() || null;

  if (!ultimaDia || ultimaDia < medianocheHoy) {
    // si no se ha refrescado hoy
    await refrescarMercado();
    await setDoc(refAdmin, { 
      ultimaActualizacion: medianocheHoy, 
      ultimaActualizacionHora: ahora 
    });
    return true; // ✅ AÑADIDO: Retorna true porque se ha refrescado
  }

  return false; // ✅ AÑADIDO: Retorna false si no hubo necesidad de refrescar
}