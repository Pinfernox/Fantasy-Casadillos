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

      // Ordenar de mayor a menor puja
      const ofertasList = ofertasSnap.docs.map(d => {
        const data = d.data();
        const monto = Number(data.oferta ?? data.precioOferta ?? data.precio ?? 0) || 0;
        return { id: d.id, ref: d.ref, data, monto };
      }).sort((a, b) => b.monto - a.monto);

      await runTransaction(db, async (tx) => {
        // 1. LECTURAS
        const jugadorRef = doc(db, "jugadores", idJugador);
        const jugadorSnap = await tx.get(jugadorRef);
        const jugadorData = jugadorSnap.exists() ? jugadorSnap.data() : {};

        // Extraer UIDs omitiendo al "system" para no buscarlo en Firebase
        const uniqueCompradorUids = [...new Set(ofertasList.map(o => o.data.compradorUid))].filter(uid => uid !== "system");
        const compradoresSnaps = await Promise.all(
          uniqueCompradorUids.map(uid => tx.get(doc(db, "usuarios", uid)))
        );
        
        const compradoresData = {};
        compradoresSnaps.forEach(snap => {
          if (snap.exists()) compradoresData[snap.id] = snap.data();
        });

        // 2. BUSCAR GANADOR VÁLIDO
        let ganadorId = null;
        let slotGanador = null;

        for (const oferta of ofertasList) {
          const uid = oferta.data.compradorUid;

          // 🤖 Si el bot es el mejor postor, gana automáticamente
          if (uid === "system") {
            ganadorId = "system";
            break;
          }

          const dataComprador = compradoresData[uid];
          if (!dataComprador) continue;

          const titulares = Array.isArray(dataComprador.equipo?.titulares) ? [...dataComprador.equipo.titulares] : [];
          const banquillo = Array.isArray(dataComprador.equipo?.banquillo) ? [...dataComprador.equipo.banquillo] : [];

          const tieneJugador = [...titulares, ...banquillo].some(slot => slot && slot.jugadorId === idJugador);
          if (tieneJugador) continue;

          const isEmptySlot = (slot) => !slot || !slot.jugadorId || slot.jugadorId === "null" || slot.jugadorId === "undefined";
          
          let tipo = null;
          let idx = titulares.findIndex(isEmptySlot);
          
          if (idx !== -1) {
            tipo = "titulares";
          } else {
            idx = banquillo.findIndex(isEmptySlot);
            if (idx !== -1) tipo = "banquillo";
          }

          if (tipo !== null) {
            ganadorId = uid;
            slotGanador = { tipo, idx, titulares, banquillo };
            break; 
          }
        }

        // 3. ESCRITURAS AL FINAL
        let ganadorProcesado = false;

        for (const oferta of ofertasList) {
          const uid = oferta.data.compradorUid;
          const dataComprador = compradoresData[uid];

          if (uid === ganadorId && !ganadorProcesado) {
            ganadorProcesado = true;

            // 🤖 Lógica si gana el Bot
            if (uid === "system") {
              tx.update(jugadorRef, {
                stockLibre: increment(1),
                dueños: arrayRemove(oferta.data.vendedorUid) 
              });
            } 
            // 👤 Lógica si gana un Usuario
            else {
              const { tipo, idx, titulares, banquillo } = slotGanador;
              const nuevoSlot = { jugadorId: idJugador, clausulaPersonal: jugadorData.precioClausula };
              
              if (tipo === "titulares") titulares[idx] = nuevoSlot;
              else banquillo[idx] = nuevoSlot;

              tx.update(doc(db, "usuarios", uid), {
                "equipo.titulares": titulares,
                "equipo.banquillo": banquillo,
              });

              const owners = Array.isArray(jugadorData.dueños) ? [...jugadorData.dueños] : [];
              const nuevosOwners = owners.filter(o => o !== "mercado");
              if (!nuevosOwners.includes(uid)) nuevosOwners.push(uid);
              tx.update(jugadorRef, { dueños: nuevosOwners });
            }

            // 💰 PAGAR AL VENDEDOR (Fundamental para la economía)
            const vendedorUid = oferta.data.vendedorUid;
            if (vendedorUid && vendedorUid !== "system") {
              tx.update(doc(db, "usuarios", vendedorUid), {
                dinero: increment(oferta.monto)
              });
            }

            // Registrar en el historial
            const historialRef = doc(collection(db, "historial"));
            tx.set(historialRef, {
              jugadorId: idJugador,
              jugadorNombre: nombre ?? jugadorData.nombre ?? "",
              comprador: oferta.data.comprador ?? dataComprador?.nick ?? dataComprador?.displayName ?? uid,
              compradorUid: uid,
              vendedorUid: oferta.data.vendedorUid ?? 'system',
              vendedorNick: oferta.data.vendedorNick ?? 'Fantasy Casadillos',
              precio: oferta.monto,
              fecha: serverTimestamp(),
              tipo: "venta_mercado"
            });
            
          } else {
            // 🛡️ PARCHE: Devolver dinero solo si es un usuario real
            if (dataComprador) {
              dataComprador.dinero = (Number(dataComprador.dinero) || 0) + oferta.monto;
              tx.update(doc(db, "usuarios", uid), { 
                dinero: dataComprador.dinero 
              });
            }
          }

          // Borrar la oferta procesada
          tx.delete(doc(db, "ofertas", oferta.id));
        }
      });

      // Quitar al jugador del mercado
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
    await updateDoc(doc(db, "mercadoUsuarios", "actual"), {
      jugadores: [] // o el nombre que tenga tu array ("ventas", etc.)
    });
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
  try {
    console.log("🤖 Iniciando bot de ofertas automáticas...");
    
    const refUsuarios = doc(db, "mercadoUsuarios", "actual");
    const snapUsuarios = await getDoc(refUsuarios);

    if (!snapUsuarios.exists()) {
      console.warn("⚠️ No se encontró el documento 'mercadoUsuarios/actual'.");
      return;
    }

    const dataUsuarios = snapUsuarios.data();
    const jugadoresEnVenta = dataUsuarios.jugadores || dataUsuarios.ventas || []; 

    if (jugadoresEnVenta.length === 0) {
      console.log("ℹ️ No hay jugadores de usuarios en venta hoy.");
      return;
    }

    let ofertasCreadas = 0;

    for (const j of jugadoresEnVenta) {
      const idDelJugador = j.jugadorId || j.idJugador || j.id; 
      const uidVendedor = j.vendedorUid || j.uid || j.usuarioId;

      if (!idDelJugador) {
        console.warn("⚠️ Error: Faltan datos en uno de los jugadores en venta.", j);
        continue;
      }

      // 🛡️ NUEVA VALIDACIÓN ANTI-SPAM: Comprobar si el bot ya ha pujado
      const qOfertaExistente = query(
        collection(db, "ofertas"),
        where("jugadorId", "==", idDelJugador),
        where("compradorUid", "==", "system")
      );
      
      const snapOfertaExistente = await getDocs(qOfertaExistente);
      
      if (!snapOfertaExistente.empty) {
        console.log(`⏸️ El bot ya tiene una oferta activa por el jugador ${idDelJugador}. Saltando...`);
        continue; // Pasamos al siguiente jugador sin hacer nada
      }

      const jugadorRef = doc(db, "jugadores", String(idDelJugador));
      const jugadorSnap = await getDoc(jugadorRef);
      const jugadorData = jugadorSnap.exists() ? jugadorSnap.data() : {};

      const precioBase = Number(jugadorData.precio || j.precioVenta || j.precio || 0);

      // Calcular oferta aleatoria (+/- 10%)
      const variacion = Math.random() < 0.5 ? -1 : 1;
      const porcentaje = 0.1 * (precioBase || 1000000); 
      const cantidad = Math.floor(precioBase + variacion * (Math.random() * porcentaje));

      await addDoc(collection(db, "ofertas"), {
        jugadorId: idDelJugador,
        vendedorUid: uidVendedor || "vendedor_desconocido", 
        vendedorNick: j.vendedorNick || j.nick || "Usuario",
        precioVenta: j.precioVenta || precioBase,
        oferta: cantidad,
        precio: cantidad,
        precioOferta: cantidad,
        monto: cantidad,
        comprador: "Fantasy Casadillos",
        compradorUid: "system",
        fecha: new Date(),
      });
      
      ofertasCreadas++;
    }
    
    console.log(`✅ Bot terminó: Se han creado ${ofertasCreadas} ofertas automáticas nuevas.`);
  } catch (error) {
    console.error("❌ Error generando ofertas automáticas:", error);
  }
};

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

