import { 
  getFirestore, 
  doc, 
  getDoc, 
  getDocs,
  addDoc,
  runTransaction,
  writeBatch,
  setDoc,
  query,
  where,
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

// 🧩 FASE 0: adjudicar ofertas más altas antes de devolver el mercado
export const adjudicarOfertasPendientes = async () => {
  try {
    const refMercado = doc(db, "mercado", "actual");
    const snapMercado = await getDoc(refMercado);
    if (!snapMercado.exists()) return;

    let jugadoresMercado = snapMercado.data().jugadores || [];
    if (jugadoresMercado.length === 0) return;

    let adjudicadas = 0;

    for (const { idJugador, nombre } of [...jugadoresMercado]) {
      const ofertasSnap = await getDocs(
        query(collection(db, "ofertas"), where("jugadorId", "==", idJugador))
      );
      if (ofertasSnap.empty) continue;

      const ofertasList = ofertasSnap.docs.map(d => {
        const data = d.data();
        const monto = Number(data.oferta ?? data.precioOferta ?? data.precio ?? 0) || 0;
        return { id: d.id, ref: d.ref, data, monto };
      }).sort((a, b) => b.monto - a.monto);

      if (ofertasList.length === 0) continue;

      const ofertaGanadora = ofertasList[0]; // mayor oferta

      // recorremos todas las ofertas
      for (const ofertaDoc of ofertasList) {
        await runTransaction(db, async (tx) => {
          const jugadorRef = doc(db, "jugadores", idJugador);
          const jugadorSnap = await tx.get(jugadorRef);
          if (!jugadorSnap.exists()) throw new Error("JUGADOR_NO_EXISTE");
          const jugadorData = jugadorSnap.data() || {};

          const compradorUid = ofertaDoc.data.compradorUid;
          if (!compradorUid) throw new Error("OFERTA_SIN_COMPRADOR");

          const compradorRef = doc(db, "usuarios", compradorUid);
          const compradorSnap = await tx.get(compradorRef);
          if (!compradorSnap.exists()) throw new Error("COMPRADOR_NO_EXISTE");
          const compradorData = compradorSnap.data() || {};
          const dineroActual = Number(compradorData.dinero ?? 0);

          // si NO es el ganador, devolvemos el dinero ofertado
          if (compradorUid !== ofertaGanadora.compradorUid) {
            tx.update(compradorRef, { dinero: dineroActual + ofertaDoc.monto });
          } else {
            // ganador: se queda el dinero restado, además añadimos jugador al equipo
            const equipo = compradorData.equipo || {};
            const titulares = Array.isArray(equipo.titulares) ? [...equipo.titulares] : [];
            const banquillo = Array.isArray(equipo.banquillo) ? [...equipo.banquillo] : [];

            const isEmptySlot = (slot) => {
              if (slot == null) return true;
              if (typeof slot !== "object") return false;
              const id = slot.jugadorId;
              return (
                id == null ||
                id === "" ||
                id === undefined ||
                id === "null" ||
                id === "undefined"
              );
            };

            let colocado = false;
            let tipo = null;
            let idx = -1;

            for (let i = 0; i < titulares.length; i++) {
              if (isEmptySlot(titulares[i])) { tipo = "titulares"; idx = i; colocado = true; break; }
            }
            if (!colocado) {
              for (let i = 0; i < banquillo.length; i++) {
                if (isEmptySlot(banquillo[i])) { tipo = "banquillo"; idx = i; colocado = true; break; }
              }
            }
            if (!colocado) throw new Error("NO_SLOT");

            const nuevoSlot = { jugadorId: idJugador, clausulaPersonal: jugadorData.precioClausula };
            if (tipo === "titulares") titulares[idx] = nuevoSlot;
            else banquillo[idx] = nuevoSlot;

            tx.update(compradorRef, {
              "equipo.titulares": titulares,
              "equipo.banquillo": banquillo,
            });

            // actualizar jugador: dueños
            const owners = Array.isArray(jugadorData.dueños) ? [...jugadorData.dueños] : [];
            const nuevosOwners = owners.filter(o => o !== "mercado");
            if (!nuevosOwners.includes(compradorUid)) nuevosOwners.push(compradorUid);
            tx.update(jugadorRef, { dueños: nuevosOwners });

            // historial
            const historialRef = doc(collection(db, "historial"));
            const compradorNombre = ofertaDoc.data.comprador ?? compradorData.nick ?? compradorData.displayName ?? compradorUid;
            tx.set(historialRef, {
              jugadorId: idJugador,
              jugadorNombre: nombre ?? jugadorData.nombre ?? "",
              comprador: compradorNombre,
              compradorUid,
              vendedorUid: ofertaDoc.data.vendedorUid ?? 'system',
              vendedorNick: ofertaDoc.data.vendedorNick ?? 'Fantasy Casadillos',
              precio: ofertaDoc.monto,
              fecha: serverTimestamp(),
              tipo: "venta_mercado"
            });
          }

          // borrar oferta
          tx.delete(doc(db, "ofertas", ofertaDoc.id));
        });
      }

      // quitar jugador del mercado
      jugadoresMercado = jugadoresMercado.filter(j => j.idJugador !== idJugador);
      try { await updateDoc(refMercado, { jugadores: jugadoresMercado }); } catch {}
      adjudicadas++;
    }

    console.log(`🎯 Ofertas adjudicadas con éxito: ${adjudicadas}`);
    return { adjudicadas };
  } catch (error) {
    console.error("❌ Error adjudicando ofertas pendientes:", error);
    throw error;
  }
};


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

    // Paso 0: Adjudicar ofertas más altas
    await adjudicarOfertasPendientes();

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

export const corregirJugadoresFueraDelMercado = async () => {
  try {
    console.log("🧰 Iniciando corrección de jugadores con 'mercado' inconsistente...");

    const refMercado = doc(db, "mercado", "actual");
    const snapMercado = await getDoc(refMercado);

    if (!snapMercado.exists()) {
      console.warn("⚠️ No existe el documento 'mercado/actual'. Se cancela la corrección.");
      return { revisados: 0, corregidos: 0 };
    }

    const dataMercado = snapMercado.data();
    const jugadoresEnMercado = (dataMercado.jugadores || []).map(j => j.idJugador);
    const setIdsMercado = new Set(jugadoresEnMercado);

    const snapJugadores = await getDocs(collection(db, "jugadores"));
    let revisados = 0;
    let corregidos = 0;

    const batch = writeBatch(db);

    for (const docSnap of snapJugadores.docs) {
      const jugador = docSnap.data();
      revisados++;

      const tieneMercado = (jugador.dueños || []).includes("mercado");
      const stock = jugador.stockLibre ?? 0;

      if (tieneMercado && !setIdsMercado.has(docSnap.id)) {
        console.log(`⚙️ Corrigiendo ${jugador.nombre || docSnap.id}: tenía 'mercado' pero no está en el mercado actual.`);

        batch.update(docSnap.ref, {
          dueños: arrayRemove("mercado"),
          stockLibre: increment(1),
        });

        corregidos++;
      }
    }

    if (corregidos > 0) {
      await batch.commit();
    }

    console.log(`✅ Corrección completada. Revisados: ${revisados}, Corregidos: ${corregidos}`);
    return { revisados, corregidos };

  } catch (error) {
    console.error("❌ Error en corregirJugadoresFueraDelMercado:", error);
    throw error;
  }
};

