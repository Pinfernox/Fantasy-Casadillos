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
    return;
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
  }
}
