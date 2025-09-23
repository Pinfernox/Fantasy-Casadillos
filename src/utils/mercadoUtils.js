import { 
  getFirestore, 
  doc, 
  getDoc, 
  getDocs, 
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

export const refrescarMercado = async () => {
  try {
    const refMercado = doc(db, "mercado", "actual");
    const snapMercado = await getDoc(refMercado);

    if (snapMercado.exists()) {
      const data = snapMercado.data();

      // Devolver stock de jugadores del sistema
      for (const j of data.jugadores) {
        if (j.stock > 0) {
          const jugadorRef = doc(db, "jugadores", j.idJugador);
          await updateDoc(jugadorRef, {
            stockLibre: increment(j.stock),
            dueños: arrayRemove("mercado"),
          });
        }
      }
    }

    // Nuevo mercado del sistema
    const snapJugadores = await getDocs(collection(db, "jugadores"));
    const todos = snapJugadores.docs.map(d => ({ idJugador: d.id, ...d.data() }));

    const seleccionados = todos
      .filter(j => j.stockLibre > 0)
      .sort(() => 0.5 - Math.random())
      .slice(0, 15);

    for (const j of seleccionados) {
      const jugadorRef = doc(db, "jugadores", j.idJugador);
      await updateDoc(jugadorRef, {
        stockLibre: increment(-1),
        dueños: arrayUnion("mercado"),
      });
    }

    await updateDoc(refMercado, {
      jugadores: seleccionados.map(j => ({
        idJugador: j.idJugador,
        nombre: j.nombre,
        precio: j.precio,
        precioClausula: j.precioClausula,
        goles: j.goles,
        asistencias: j.asistencias,
        valoracion: j.valoracion,
        nota: j.nota,
        puntos: j.puntosTotales,
        partidos: j.partidos,
        foto: j.foto,
        posicion: j.posicion,
        vendedor: "Fantasy Casadillos",
        stock: 1,
        historialPrecios: j.historialPrecios || [],
        puntosPorJornada: j.puntosPorJornada || [],
      })),
      ultimaActualizacion: serverTimestamp(),
    });

    // jugadores de usuarios
    const refUsuarios = collection(db, "mercado/actual/usuarios");
    const snapUsuarios = await getDocs(refUsuarios);
    const jugadoresUsuarios = snapUsuarios.docs.map(d => ({
      idVenta: d.id,
      ...d.data(),
      vendedor: d.data().vendedorNick || "Usuario",
    }));

    return [...seleccionados, ...jugadoresUsuarios]; // devolvemos lista
  } catch (error) {
    console.error("Error al refrescar mercado:", error);
    throw error;
  }
};

export const resetearMercado = async () => {
  try {
    const refMercado = doc(db, "mercado", "actual");
    const snapMercado = await getDoc(refMercado);

    if (!snapMercado.exists()) return;

    const data = snapMercado.data();

    // --- devolver stock de jugadores del sistema ---
    for (const j of data.jugadores || []) {
      if (j.vendedor === "Fantasy Casadillos") {
        const jugadorRef = doc(db, "jugadores", j.idJugador);
        await updateDoc(jugadorRef, {
          stockLibre: increment(j.stock || 1),
          dueños: arrayRemove("mercado"),
        });
      }
    }

    // --- eliminar las ventas de usuarios ---
    const refUsuarios = collection(db, "mercado/actual/usuarios");
    const snapUsuarios = await getDocs(refUsuarios);
    for (const d of snapUsuarios.docs) {
      await deleteDoc(d.ref);
    }

    // --- dejar mercado vacío ---
    await updateDoc(refMercado, {
      jugadores: [],
      ultimaActualizacion: null,
    });

    return true;
  } catch (error) {
    console.error("Error al resetear mercado:", error);
    throw error;
  }
};
