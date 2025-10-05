import { 
  getFirestore, 
  doc, 
  getDoc, 
  getDocs,
  addDoc,
  runTransaction,
  writeBatch,
  setDoc,
  updateDoc,
  deleteDoc,  
  collection, 
  increment, 
  arrayUnion, 
  arrayRemove, 
  serverTimestamp 
} from "firebase/firestore";
import appFirebase from "../credenciales";

const db = getFirestore(appFirebase);

export const devolverJugadoresPrevioAlMercado = async () => {
  try {
    const refMercado = doc(db, "mercado", "actual");
    const snapMercado = await getDoc(refMercado);
    const jugadoresPrevios = snapMercado.exists() ? (snapMercado.data().jugadores || []) : [];

    // Deduplicar ids y filtrar falsos
    const ids = Array.from(new Set(jugadoresPrevios.map(j => j && j.idJugador).filter(Boolean)));

    if (ids.length === 0) {
      console.log("ℹ️ No había jugadores previos en mercado/actual.jugadores");
      return { procesados: 0, reparados: 0, noExistentes: 0, sinMercado: 0 };
    }

    let reparados = 0;
    let noExistentes = 0;
    let sinMercado = 0;
    let procesados = 0;

    console.log(`↩️ Devolviendo ${ids.length} jugadores al stock (si procede)...`);

    for (const idJugador of ids) {
      const jugadorRef = doc(db, "jugadores", idJugador);

      // Transacción por jugador: garantiza lectura consistente y actualización atómica
      await runTransaction(db, async (tx) => {
        const jSnap = await tx.get(jugadorRef);
        procesados++;

        if (!jSnap.exists()) {
          console.warn(`⚠️ Jugador ${idJugador} no existe (se omite).`);
          noExistentes++;
          return;
        }

        const data = jSnap.data() || {};
        const owners = Array.isArray(data.dueños) ? data.dueños : [];

        if (!owners.includes("mercado")) {
          // Si no tenía 'mercado' -> no modificamos stock ni dueños
          console.log(`ℹ️ ${idJugador} no tenía 'mercado' en dueños — sin cambios.`);
          sinMercado++;
          return;
        }

        // Tiene 'mercado' como dueño → incrementamos stock y eliminamos 'mercado' de dueños
        // Usamos increment + arrayRemove para operación clara y atómica
        tx.update(jugadorRef, {
          stockLibre: increment(1),
          dueños: arrayRemove("mercado"),
        });

        reparados++;
        console.log(`✅ ${idJugador}: stockLibre +1 y 'mercado' eliminado de dueños.`);
      }); // end runTransaction
    } // end for

    console.log("✅ Procesado completo de devolverJugadoresPrevioAlMercado");
    return { procesados, reparados, noExistentes, sinMercado };

  } catch (error) {
    console.error("❌ Error en devolverJugadoresPrevioAlMercado:", error);
    // Re-lanzamos para que el flujo superior DETENGA el refresco (como pediste)
    throw error;
  }
};

// 🧩 FASE 2: crear nuevo mercado
const generarNuevoMercado = async () => {
  const refMercado = doc(db, "mercado", "actual");
  const snapJugadores = await getDocs(collection(db, "jugadores"));
  const todos = snapJugadores.docs.map(d => ({ idJugador: d.id, ...d.data() }));

  // Filtrar disponibles
  const disponibles = todos.filter(j =>
    (j.stockLibre ?? 0) > 0 && !(j.dueños || []).includes("mercado")
  );

  // Barajar (Fisher–Yates)
  for (let i = disponibles.length - 1; i > 0; i--) {
    const r = Math.floor(Math.random() * (i + 1));
    [disponibles[i], disponibles[r]] = [disponibles[r], disponibles[i]];
  }

  const seleccionados = disponibles.slice(0, 15);

  console.log(`🆕 Seleccionados ${seleccionados.length} jugadores para el nuevo mercado.`);

  // Batch para actualizaciones
  const batch = writeBatch(db);

  for (const j of seleccionados) {
    const jugadorRef = doc(db, "jugadores", j.idJugador);
    batch.update(jugadorRef, {
      stockLibre: increment(-1),
      dueños: arrayUnion("mercado"),
    });
  }

  batch.set(refMercado, {
    jugadores: seleccionados.map(j => ({
      idJugador: j.idJugador,
      nombre: j.nombre || "",
    })),
    ultimaActualizacion: serverTimestamp(),
  });

  await batch.commit();
  console.log("✅ Mercado actualizado correctamente.");
};

// 🚀 FUNCIÓN PRINCIPAL: refrescarMercado
export const refrescarMercado = async () => {
  try {
    console.log("🔁 Iniciando proceso completo de refresco de mercado...");

    // Paso 1: limpiar mercado anterior
    await devolverJugadoresPrevioAlMercado();

    // Paso 2: generar nuevo mercado
    await generarNuevoMercado();

    console.log("🎉 Refresco de mercado completado con éxito.");
    return true;
  } catch (error) {
    console.error("❌ Error durante el refresco de mercado:", error);
    throw error;
  }
};


export const resetearMercado = async () => {
  try {
    const refMercado = doc(db, "mercado", "actual");
    const snapMercado = await getDoc(refMercado);

    // Si el documento no existe, lo creamos vacío y terminamos
    if (!snapMercado.exists()) {
      console.warn("El documento mercado/actual no existía, se ha creado vacío.");
      await setDoc(refMercado, {
        jugadores: [],
        ultimaActualizacion: null,
      });
      return true;
    }

    const data = snapMercado.data();

    // --- Devolver stock de jugadores del sistema ---
    for (const j of data.jugadores || []) {
      if (j.vendedor === "Fantasy Casadillos") {
        const jugadorRef = doc(db, "jugadores", j.idJugador);
        await updateDoc(jugadorRef, {
          stockLibre: increment(j.stock || 1),
          dueños: arrayRemove("mercado"),
        });
      }
    }

    // --- Eliminar las ventas de usuarios ---
    const refUsuarios = collection(db, "mercado/actual/usuarios");
    const snapUsuarios = await getDocs(refUsuarios);
    for (const d of snapUsuarios.docs) {
      await deleteDoc(d.ref);
    }

    // --- Dejar mercado vacío ---
    await updateDoc(refMercado, {
      jugadores: [],
      ultimaActualizacion: null,
    });

    console.log("✅ Mercado reseteado correctamente");
    return true;
  } catch (error) {
    console.error("Error al resetear mercado:", error);
    throw error;
  }
};

export const ofertasAutomaticas = async () => {
  const mercadoRef = doc(db, "mercadoUsuarios", "actual");
  const snap = await getDoc(mercadoRef);

  if (!snap.exists()) return;

  const { jugadores = [] } = snap.data();

  for (const j of jugadores) {

    const jugadorRef = doc(db, "jugadores", j.jugadorId);
    const jugadorSnap = await getDoc(jugadorRef);

    if (!jugadorSnap.exists()) continue; // saltar si no existe

    const jugadorData = jugadorSnap.data();
    const precioBase = jugadorData.precio; // usamos "precio" de la colección jugadores

    // Calculamos oferta aleatoria +/- 10% del precio
    const variacion = Math.random() < 0.5 ? -1 : 1;
    const porcentaje = 0.1 * precioBase;
    const cantidad = Math.floor(precioBase + variacion * (Math.random() * porcentaje));

    await addDoc(collection(db, "ofertas"), {
      jugadorId: j.jugadorId,
      vendedorUid: j.vendedorUid,
      vendedorNick: j.vendedorNick,
      precioVenta: j.precioVenta,
      oferta: cantidad,
      comprador: "Fantasy Casadillos", // 👈 nombre de la liga
      compradorUid: "system",       // 👈 uid especial del sistema
      fecha: new Date(),
    });
  }
}
