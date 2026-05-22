import React, { useState, useRef, useEffect } from "react";
import { Link } from 'react-router-dom';
import appFirebase from "../credenciales";
import { arrayRemove, arrayUnion } from "firebase/firestore";
import { getAuth, signOut } from 'firebase/auth'
import Swal from "sweetalert2";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  collection,
  onSnapshot,
  getDocs,
  increment,
  addDoc,
  where,
  query,
  serverTimestamp,
  runTransaction,
  deleteDoc
} from 'firebase/firestore';
import ImagenProfile from '/SinPerfil.jpg'
import Fondo from '../assets/fondo.png'
import LogoLiga from '../assets/logo.png';
import "./Mercado.css";
import ModalPerfil from "./ModalPerfil"
import ModalAdmin from './ModalAdmin'
import ModalJugadorMercado from "./ModalJugadorMercado";
import TemporizadorRefresco from "./TemporizadorRefresco";

const db = getFirestore(appFirebase);
const auth = getAuth(appFirebase);

export default function Mercado({ usuario }) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [dinero, setDinero] = useState(null)
  const [menu, setMenu] = useState(false)
  const fotoURL = usuario?.fotoPerfil || ImagenProfile
  const [equipocreado, setEquipocreado] = useState(usuario?.equipocreado);
  const titulares = usuario?.equipo?.titulares || [];
  const [loadingMercado, setLoadingMercado] = useState(false);
  const banquillo = usuario?.equipo?.banquillo || [];
  // Estados principales
  const [sistemaEnr, setSistemaEnr] = useState([]); // mercado del sistema enriquecido
  const [usuariosEnr, setUsuariosEnr] = useState([]); // mercado Usuarios enriquecido
  const [jugadoresMercado, setJugadoresMercado] = useState([]); // lista combinada (render)
  const [jugadoresUsuario, setJugadoresUsuario] = useState([]); // solo mis operaciones (listados que yo puse)
  const [openModal, setOpenModal] = useState(false);
  const [openModalJugadorMercado, setOpenModalJugadorMercado] = useState(false)
  const [openModalAdmin, setOpenModalAdmin] = useState(false)
  const [jugadorSeleccionado, setJugadorSeleccionado] = useState(null)
  const [menuActivo, setMenuActivo] = useState(false);
  const [edicionActiva, setEdicionActiva] = useState(false);
  const [conteoOfertas, setConteoOfertas] = useState({});
  const [misOfertas, setMisOfertas] = useState([]);
  // Nuevos estados para el Modal de Ofertas
  const [mostrarModalOfertas, setMostrarModalOfertas] = useState(false);
  const [ofertasRecibidas, setOfertasRecibidas] = useState([]);
  const [jugadorOfertasSeleccionado, setJugadorOfertasSeleccionado] = useState(null);

  const refMenu = useRef(null);
  const [tabActiva, setTabActiva] = useState("mercado");
  const logout = () => signOut(auth);

  // --- helper ---
  const formatearDinero = (valor) => {
    if (typeof valor !== "number" || isNaN(valor)) return "—";
    return valor.toLocaleString("es-ES") + "€";
  };

  const traducirPosicion = (pos) => {
    switch (pos) {
      case "DEF": return "Defensa";
      case "MED": return "Mediocentro";
      case "DEL": return "Delantero";
      case "POR": return "Portero";
      default: return pos || "Sin posición";
    }
  };

  // -------------------------------
  // Suscripción: mercado del SISTEMA (mercado/actual)
  // Enriquecemos con la data real de la colección 'jugadores'
  // -------------------------------
  useEffect(() => {
    const refSistema = doc(db, "mercado", "actual");
    const unsub = onSnapshot(refSistema, async (snap) => {
      const jugadores = snap.exists() ? (snap.data().jugadores || []) : [];
      try {
        const enriched = await Promise.all(jugadores.map(async (p) => {
          // p.idJugador debe contener el doc id en 'jugadores'
          const jDocRef = doc(db, "jugadores", p.idJugador);
          const jSnap = await getDoc(jDocRef);
          const jData = jSnap.exists() ? jSnap.data() : {};
          return {
            source: 'system',
            idJugador: p.idJugador,
            nombre: jData.nombre || p.nombre || "Sin nombre",
            foto: jData.foto || p.foto || ImagenProfile,
            posicion: jData.posicion || p.posicion || "—",
            precio: typeof p.precio === 'number' ? p.precio : Number(p.precio) || jData.precio || 0,
            stock: p.stock ?? 1,
            historialPrecios: jData.historialPrecios || p.historialPrecios || [],
            puntosPorJornada: jData.puntosPorJornada || p.puntosPorJornada || [],
            vendedor: p.vendedor || "Fantasy Casadillos",
            goles: jData.goles,
            asistencias: jData.asistencias,
            partidos: jData.partidos,
            valoracion: jData.valoracion,
            nota: jData.nota,
            puntosTotales: jData.puntosTotales,
            // guardar original por si hace falta
            _raw: p,
          };
        }));
        setSistemaEnr(enriched.filter(Boolean));
      } catch (err) {
        console.error("Error enriqueciendo mercado sistema:", err);
        setSistemaEnr([]);
      }
    });

    return () => unsub();
  }, []); // se suscribe una vez

  // -------------------------------
  // Suscripción: mercado de USUARIOS (mercadoUsuarios/actual)
  // Estructura esperada: documento "actual" con array jugadores: [{ jugadorId, precioVenta, vendedorNick, vendedorUid, fecha }, ...]
  // -------------------------------
  useEffect(() => {
    const refUsuarios = doc(db, "mercadoUsuarios", "actual");
    const unsub = onSnapshot(refUsuarios, async (snap) => {
      const list = snap.exists() ? (snap.data().jugadores || []) : [];
      try {
        const enriched = await Promise.all(list.map(async (listing) => {
          if (!listing || !listing.jugadorId) return null;
          const jDocRef = doc(db, "jugadores", listing.jugadorId);
          const jSnap = await getDoc(jDocRef);
          const jData = jSnap.exists() ? jSnap.data() : null;

          // Si no existe el jugador en 'jugadores' devolvemos un fallback (o null para eliminarlo)
          if (!jData) {
            // Puedes optar por devolver null para filtrar listados huérfanos
            return {
              source: 'user',
              idJugador: listing.jugadorId,
              nombre: "Jugador no encontrado",
              foto: ImagenProfile,
              posicion: "—",
              precio: listing.precioVenta ?? 0,
              historialPrecios: [],
              puntosPorJornada: [],
              vendedor: listing.vendedorNick || "Usuario",
              vendedorUid: listing.vendedorUid,
              fecha: listing.fecha || null
            };
          }

          return {
            source: 'user',
            idJugador: listing.jugadorId,
            nombre: jData.nombre || "Sin nombre",
            foto: jData.foto || ImagenProfile,
            posicion: jData.posicion || "—",
            precio: jData.precio || 0,
            precioVenta: typeof listing.precioOferta === 'number' ? listing.precioOferta : Number(listing.precioOferta),
            historialPrecios: jData.historialPrecios || [],
            puntosPorJornada: jData.puntosPorJornada || [],
            vendedor: listing.vendedorNick || "Usuario",
            vendedorUid: listing.vendedorUid,
            goles: jData.goles,
            asistencias: jData.asistencias,
            partidos: jData.partidos,
            valoracion: jData.valoracion,
            nota: jData.nota,
            puntosTotales: jData.puntosTotales,
            fecha: listing.fecha || null
          };
        }));

        const filtered = enriched.filter(Boolean);
        setUsuariosEnr(filtered);
        // operaciones del usuario autenticado (listados que yo puse)
        if (usuario && usuario.uid) {
          setJugadoresUsuario(filtered.filter(l => l.vendedorUid === usuario.uid));
        } else {
          setJugadoresUsuario([]);
        }
      } catch (err) {
        console.error("Error enriqueciendo mercado usuarios:", err);
        setUsuariosEnr([]);
        setJugadoresUsuario([]);
      }
    });

    return () => unsub();
  }, [usuario]);

  useEffect(() => {
    if (!usuario?.uid) {
      setMisOfertas([]);
      return;
  }

  // Referencia a las ofertas hechas por este usuario
  const qMisOfertas = query(
    collection(db, "ofertas"),
    where("compradorUid", "==", usuario.uid)
  );

  const unsub = onSnapshot(qMisOfertas, async (snap) => {
    const ofertasData = [];
    for (const d of snap.docs) {
      const data = d.data();
      if (!data.jugadorId) continue;

      // Traemos la información del jugador
      const jSnap = await getDoc(doc(db, "jugadores", data.jugadorId));
      const jData = jSnap.exists() ? jSnap.data() : {};

      ofertasData.push({
        id: d.id,
        idJugador: data.jugadorId,
        nombre: jData.nombre || "Jugador no encontrado",
        foto: jData.foto || ImagenProfile,
        posicion: jData.posicion || "—",
        precio: jData.precio || 0,
        precioOferta: data.precioOferta ?? data.oferta ?? data.precio ?? data.monto ?? 0,
        vendedorUid: data.vendedorUid,
        vendedorNick: data.vendedorNick,
        fecha: data.fecha || null,
        puntosPorJornada: jData.puntosPorJornada || []
      });
    }
    setMisOfertas(ofertasData);
  });

  return () => unsub();
}, [usuario]);

  // Combinar sistema + usuarios en una sola lista que renderizamos
  useEffect(() => {
    // podrías aplicar un orden: primero sistema, luego usuarios (ahora así)
    setJugadoresMercado([...sistemaEnr, ...usuariosEnr]);
  }, [sistemaEnr, usuariosEnr]);
  
  useEffect(() => {
    const cargarEstadoEdicion = async () => {
      try {
        const ref = doc(db, "admin", "controles");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setEdicionActiva(data.edicionActiva === true);
        }
      } catch (error) {
        console.error("Error al obtener estado de edición:", error);
      }
    };

    cargarEstadoEdicion();
  }, []);
  

// Mirar número de ofertas
  useEffect(() => {
    const q = query(collection(db, "ofertas"));
    const unsub = onSnapshot(q, (snapshot) => {
      const counts = {};
      snapshot.forEach(doc => {
        const data = doc.data();
        // Clave unificada y simplificada
        const key = `${data.jugadorId}-${data.vendedorUid || 'system'}`;
        counts[key] = (counts[key] || 0) + 1;
      });
      setConteoOfertas(counts);
    });
    return () => unsub();
  }, []);
  // -------------------------------
  // Otras utilidades: compra (solo sistema)...
  // -------------------------------
  const pujarJugador = async (jugador, precioOferta) => {
    const user = auth.currentUser;
    if (!user) {
      Swal.fire("⚠️ Atención", "Debes iniciar sesión para hacer una oferta.", "warning");
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await transaction.get(userRef);

        if (!userSnap.exists()) throw new Error("Usuario no encontrado.");

        const userData = userSnap.data();
        const dineroActual = userData.dinero ?? 0;

        if (dineroActual < precioOferta) {
          throw new Error("Saldo insuficiente para hacer esta oferta.");
        }

        // restar dinero temporalmente
        const nuevoSaldo = dineroActual - precioOferta;
        transaction.update(userRef, { dinero: nuevoSaldo });

        // crear la oferta
        const ofertasRef = collection(db, "ofertas");
        transaction.set(doc(ofertasRef), {
          jugadorId: jugador.idJugador,
          source: jugador.source || "system",
          vendedorUid: jugador.vendedorUid || null,
          compradorUid: user.uid,
          precioOferta,
          fecha: serverTimestamp(),
          estado: "pendiente", // puedes usar esto para saber si ya fue adjudicada o no
        });
      });

      await Swal.fire("✅ Oferta realizada", `Has hecho una oferta por ${jugador.nombre}`, "success");
    } catch (err) {
      console.error("Error creando oferta:", err);
      Swal.fire("❌ Error", err.message || "Ocurrió un problema al hacer la oferta", "error");
    }
  };

  // Retirar venta (borra el jugador del mercadoUsuarios)
  const retirarVenta = async (jugador) => {
      try {
        const ref = doc(db, "mercadoUsuarios", "actual");
        await updateDoc(ref, {
          jugadores: arrayRemove({
            jugadorId: jugador.idJugador,
            precioVenta: jugador.precioVenta,
            vendedorNick: jugador.vendedor,
            vendedorUid: jugador.vendedorUid,
            fecha: jugador.fecha,
          }),
        });
        Swal.fire("✅ Venta retirada", `${jugador.nombre} se ha retirado del mercado.`, "success");
      } catch (err) {
        console.error(err);
        Swal.fire("❌ Error", "No se pudo retirar la venta", "error");
      }
    };

// Ver ofertas (Abre el Modal interactivo y carga fotos)
  const verOfertar = async (jugador) => {
    const q = query(
      collection(db, "ofertas"), 
      where("jugadorId", "==", jugador.idJugador),
      where("vendedorUid", "==", usuario.uid)
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      Swal.fire("ℹ️ Sin ofertas", "Todavía no hay ofertas para este jugador.", "info");
      return;
    }

    // Mapear y enriquecer las ofertas con la foto y nick real
    const ofertas = await Promise.all(snapshot.docs.map(async (d) => {
      const data = d.data();
      const monto = Number(data.oferta ?? data.precioOferta ?? data.precio ?? 0) || 0;
      
      let compradorNick = data.comprador || "Usuario";
      let compradorFoto = ImagenProfile; // Tu imagen por defecto

      if (data.compradorUid === "system") {
        compradorNick = "Fantasy Casadillos";
        compradorFoto = LogoLiga; // El logo de la liga
      } else {
        try {
          // Buscar los datos frescos del usuario en Firestore
          const userSnap = await getDoc(doc(db, "usuarios", data.compradorUid));
          if (userSnap.exists()) {
            const userData = userSnap.data();
            compradorNick = userData.nick || userData.displayName || compradorNick;
            compradorFoto = userData.fotoPerfil || ImagenProfile;
          }
        } catch (error) {
          console.error("Error al obtener perfil del comprador:", error);
        }
      }

      return { id: d.id, ...data, monto, compradorNick, compradorFoto };
    }));

    setJugadorOfertasSeleccionado(jugador);
    setOfertasRecibidas(ofertas.sort((a, b) => b.monto - a.monto));
    setMostrarModalOfertas(true);
  };

// Aceptar Oferta
  const aceptarOferta = async (oferta) => {
    try {
      const { isConfirmed } = await Swal.fire({
        title: "¿Aceptar oferta?",
        text: `Vas a vender a ${jugadorOfertasSeleccionado?.nombre} por ${formatearDinero(oferta.monto)}`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Sí, vender",
        cancelButtonText: "Cancelar"
      });

      if (!isConfirmed) return;

      // 1. Obtener TODAS las ofertas por este jugador ANTES de la transacción
      const qTodas = query(collection(db, "ofertas"), where("jugadorId", "==", oferta.jugadorId));
      const snapTodas = await getDocs(qTodas);
      const todasLasOfertas = snapTodas.docs.map(d => ({ id: d.id, ...d.data() }));

      await runTransaction(db, async (tx) => {
        // A. Pagar al Vendedor (Tú) y quitar jugador de tu equipo
        const vendedorRef = doc(db, "usuarios", usuario.uid);
        const vendedorSnap = await tx.get(vendedorRef);
        let equipo = vendedorSnap.data().equipo || { titulares: [], banquillo: [] };
        let nuevoDinero = (vendedorSnap.data().dinero || 0) + oferta.monto;
        
        const removeJugador = (arr) => arr.map(slot => slot?.jugadorId === oferta.jugadorId ? null : slot);
        equipo.titulares = removeJugador(equipo.titulares);
        equipo.banquillo = removeJugador(equipo.banquillo);

        tx.update(vendedorRef, { dinero: nuevoDinero, equipo: equipo });

        // B. Modificar el jugador y procesar al Comprador (Ganador)
        const jugadorRef = doc(db, "jugadores", oferta.jugadorId);
        if (oferta.compradorUid === "system") {
          tx.update(jugadorRef, {
            stockLibre: increment(1),
            dueños: arrayRemove(usuario.uid)
          });
        } else {
          // Lógica si compra otro usuario real
          const compradorRef = doc(db, "usuarios", oferta.compradorUid);
          const compradorSnap = await tx.get(compradorRef);
          let eqComprador = compradorSnap.data()?.equipo || { titulares: [], banquillo: [] };
          let huecoEncontrado = false;
          
          for (let i = 0; i < eqComprador.titulares.length; i++) {
            if (!eqComprador.titulares[i]) { eqComprador.titulares[i] = { jugadorId: oferta.jugadorId }; huecoEncontrado = true; break; }
          }
          if (!huecoEncontrado) {
            for (let i = 0; i < eqComprador.banquillo.length; i++) {
              if (!eqComprador.banquillo[i]) { eqComprador.banquillo[i] = { jugadorId: oferta.jugadorId }; huecoEncontrado = true; break; }
            }
          }
          if (!huecoEncontrado) throw new Error("El comprador ya no tiene hueco.");
          
          tx.update(compradorRef, { equipo: eqComprador });
          tx.update(jugadorRef, { dueños: arrayRemove(usuario.uid) });
        }

        // C. Reembolsar a los PERDEDORES y borrar todas las pujas
        for (const ofe of todasLasOfertas) {
          const ofeRef = doc(db, "ofertas", ofe.id);
          
          // Si es un perdedor real, le devolvemos su dinero
          if (ofe.id !== oferta.id && ofe.compradorUid !== "system") {
            const perdedorRef = doc(db, "usuarios", ofe.compradorUid);
            const perdedorSnap = await tx.get(perdedorRef);
            if (perdedorSnap.exists()) {
              const dineroActualPerdedor = perdedorSnap.data().dinero || 0;
              const montoDevolver = Number(ofe.oferta ?? ofe.precioOferta ?? ofe.precio ?? 0);
              tx.update(perdedorRef, { dinero: dineroActualPerdedor + montoDevolver });
            }
          }
          
          // Borrar la oferta evaluada (ganadora o perdedora)
          tx.delete(ofeRef);
        }

        // D. Sacar al jugador de la vitrina de ventas activas
        const mercadoUsuariosRef = doc(db, "mercadoUsuarios", "actual");
        const muSnap = await tx.get(mercadoUsuariosRef);
        if (muSnap.exists()) {
           const ventas = muSnap.data().jugadores || [];
           tx.update(mercadoUsuariosRef, { jugadores: ventas.filter(v => v.jugadorId !== oferta.jugadorId) });
        }
      });

      Swal.fire("✅ Vendido", "Has aceptado la oferta correctamente", "success");
      setMostrarModalOfertas(false);
    } catch (error) {
      console.error(error);
      Swal.fire("❌ Error", error.message, "error");
    }
  };

  // Rechazar Oferta
  const rechazarOferta = async (oferta) => {
    try {
      const { isConfirmed } = await Swal.fire({
        title: "¿Rechazar oferta?",
        text: "Esta acción no se puede deshacer.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, rechazar"
      });

      if (!isConfirmed) return;

      if (oferta.compradorUid !== "system") {
         await updateDoc(doc(db, "usuarios", oferta.compradorUid), {
             dinero: increment(oferta.monto)
         });
      }
      
      await deleteDoc(doc(db, "ofertas", oferta.id));
      
      // Actualizar la lista visual sin recargar
      const nuevasOfertas = ofertasRecibidas.filter(o => o.id !== oferta.id);
      setOfertasRecibidas(nuevasOfertas);
      
      if (nuevasOfertas.length === 0) setMostrarModalOfertas(false);
      
      Swal.fire("✅ Rechazada", "La oferta ha sido eliminada", "success");
    } catch (error) {
      console.error(error);
      Swal.fire("❌ Error", "No se pudo rechazar la oferta", "error");
    }
  };

// Hacer oferta nueva
  const hacerOferta = async (jugador) => {
    const { value: precioParsed } = await Swal.fire({
      title: `Oferta por ${jugador.nombre}`,
      input: "text",
      inputLabel: "Introduce tu oferta (€)",
      inputPlaceholder: "Ej: 5.000.000",
      showCancelButton: true,
      confirmButtonText: "Enviar oferta",
      cancelButtonText: "Cancelar",
      background: "#1e1e1e",
      color: "#fff",
      didOpen: () => {
        const input = Swal.getInput();
        input.addEventListener('input', (e) => {
          let val = e.target.value.replace(/\D/g, '');
          e.target.value = val ? Number(val).toLocaleString('es-ES') : '';
        });
      },
      preConfirm: (value) => {
        const parsed = parseInt(value.replace(/\./g, ''), 10);
        if (!parsed || parsed <= 0) {
          Swal.showValidationMessage("Debes introducir un precio válido");
          return false;
        }
        if (parsed < jugador.precio) {
          Swal.showValidationMessage("Debes introducir un precio superior o igual al valor de mercado");
          return false;
        }
        return parsed;
      }
    });

    if (!precioParsed) return;

    await pujarJugador(jugador, precioParsed);
  };

// Retirar / Cancelar oferta
  const retirarOferta = async (oferta) => {
    try {
      const { isConfirmed } = await Swal.fire({
        title: "¿Cancelar oferta?",
        text: "Se te devolverá el dinero retenido a tu saldo.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, cancelar",
        cancelButtonText: "Mantener",
        background: "#1e1e1e",
        color: "#fff"
      });

      if (!isConfirmed) return;

      // Identificar cuánto dinero hay que devolver (ignorando el valor de mercado)
      const montoADevolver = Number(oferta.precioOferta ?? oferta.oferta ?? oferta.monto ?? 0) || 0;

      await runTransaction(db, async (tx) => {
        // 1. Devolver el dinero al usuario
        const userRef = doc(db, "usuarios", usuario.uid);
        const userSnap = await tx.get(userRef);
        
        if (userSnap.exists()) {
          const dineroActual = userSnap.data().dinero ?? 0;
          tx.update(userRef, { dinero: dineroActual + montoADevolver });
        }

        // 2. Borrar la oferta
        const ofertaRef = doc(db, "ofertas", oferta.id);
        tx.delete(ofertaRef);
      });

      Swal.fire("✅ Oferta cancelada", "Se te ha devuelto el dinero a tu saldo.", "success");
    } catch (err) {
      console.error(err);
      Swal.fire("❌ Error", "No se pudo cancelar la oferta", "error");
    }
  };

// Aumentar / Modificar oferta
  const aumentarOferta = async (oferta) => {
    // 1. Separamos claramente el valor de mercado de lo que el usuario ha pujado
    const precioMercado = Number(oferta.precio) || 0; 
    
    // Quitamos 'oferta.precio' de esta lectura para que no coja el valor de mercado por error
    const montoAnterior = Number(oferta.precioOferta ?? oferta.oferta ?? oferta.monto ?? 0) || 0;

    const { value: nuevoMonto } = await Swal.fire({
      title: "Modificar oferta",
      input: "text", 
      inputLabel: "Nuevo precio (€)",
      inputPlaceholder: "Ej: 6.000.000",
      inputValue: montoAnterior.toLocaleString("es-ES"), 
      showCancelButton: true,
      confirmButtonText: "Actualizar",
      background: "#1e1e1e",
      color: "#fff",
      didOpen: () => {
        const input = Swal.getInput();
        input.addEventListener('input', (e) => {
          let val = e.target.value.replace(/\D/g, ''); 
          e.target.value = val ? Number(val).toLocaleString('es-ES') : '';
        });
      },
      preConfirm: (value) => {
        const parsed = parseInt(value.replace(/\./g, ''), 10);
        if (!parsed || parsed <= 0) {
          Swal.showValidationMessage("Introduce un precio válido");
          return false;
        }
        
        // 🛡️ NUEVA VALIDACIÓN: No permitir ofertas por debajo del valor de mercado
        if (parsed < precioMercado) {
          Swal.showValidationMessage("Debes introducir un precio superior o igual al valor de mercado");
          return false;
        }
        
        return parsed;
      }
    });

    if (!nuevoMonto) return;
    if (nuevoMonto === montoAnterior) return;

    try {
      await runTransaction(db, async (tx) => {
        const userRef = doc(db, "usuarios", usuario.uid);
        const userSnap = await tx.get(userRef);
        
        if (!userSnap.exists()) throw new Error("Usuario no encontrado.");

        const userData = userSnap.data();
        const dineroActual = userData.dinero ?? 0;
        const diferencia = nuevoMonto - montoAnterior;

        // Comprobar si tiene dinero suficiente para cubrir el aumento
        if (diferencia > 0 && dineroActual < diferencia) {
          throw new Error("Saldo insuficiente para aumentar la oferta.");
        }

        // Actualizar el dinero del usuario
        tx.update(userRef, { dinero: dineroActual - diferencia });

        // Actualizar el documento de la oferta
        const ofertaRef = doc(db, "ofertas", oferta.id);
        tx.update(ofertaRef, { 
          precioOferta: nuevoMonto,
          oferta: nuevoMonto,
          precio: nuevoMonto,
          monto: nuevoMonto
        });
      });

      await Swal.fire("✅ Oferta actualizada", "Tu oferta fue modificada correctamente", "success");
    } catch (err) {
      console.error(err);
      Swal.fire("❌ Error", err.message || "No se pudo actualizar la oferta", "error");
    }
  };

  // -------------------------------
  // UI / Render
  // -------------------------------
  // cerrar menú al click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (refMenu.current && !refMenu.current.contains(event.target)) {
        setMenuActivo(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Onboarding y leer dinero
  useEffect(() => {
    if (!usuario) return;
    if (window.particlesJS) {
      window.particlesJS.load("particles-js", "particles.json", () => {
        console.log("Particles.js config cargado");
      });
    }
    if (usuario?.onboarding === false) {
      setShowOnboarding(true);
      const timer = setTimeout(async () => {
        try {
          const userRef = doc(db, "usuarios", usuario.uid);
          await updateDoc(userRef, { onboarding: true });
          setShowOnboarding(false);
        } catch (err) { console.error(err); }
      }, 500);
      return () => clearTimeout(timer);
    }

    const refUsuario = doc(db, "usuarios", usuario.uid);
    const unsubDinero = onSnapshot(refUsuario, (snap) => {
      if (snap.exists()) {
        setDinero(snap.data().dinero);
      }
    });

    // Añadimos el unsub para que no se quede colgado en memoria
    return () => unsubDinero();

  }, [usuario]);

  return (
    <div style={{backgroundColor: 'black'}}>
      <header className="Cabecera">
        <div className="container-profile">
          <div className='img-profile-small' style={{ position: 'relative' }}>
            <img
              src={fotoURL}
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = ImagenProfile }}
              alt="Foto de perfil"
              onClick={() => setMenuActivo(!menuActivo)}
              onMouseEnter={() => setMenuActivo(true)}
            />
            {menuActivo && (
              <div className="perfil-bocadillo" ref={refMenu} onMouseLeave={() => setMenuActivo(false)}>
                <div className="triangulo" />
                <button className="btn-perfil" onClick={() => { setOpenModal(true); setMenuActivo(false); }}>👤 Perfil</button>
                <button className="btn-logout" onClick={logout}>➜] Cerrar sesión</button>
                {usuario?.rol === 'admin' && <button className="btn-admin" onClick={() => { setOpenModalAdmin(true); setMenuActivo(false); }}>⚙️ Admin</button>}
              </div>
            )}
          </div>

          <div className="info-profile">
            <h2 className="nombre-usuario">{(usuario?.nick || usuario?.displayName)}</h2>
            {dinero !== null && (<p className="dinero-usuario">💰<strong>{formatearDinero(dinero)}</strong></p>)}
          </div>
        </div>

        <nav className={`Cabecera-nav ${menu ? 'isActive' : ''}`}>
          <ul className="Cabecera-ul">
            <li className="Cabecera-li"><Link to="/home" className="Cabecera-a">EQUIPO</Link></li>
            <li className="Cabecera-li"><Link to="/mercado" className="Cabecera-a">MERCADO</Link></li>
            <li className="Cabecera-li"><Link to="/clasificacion" className="Cabecera-a">CLASIFICACIÓN</Link></li>
            <li className="Cabecera-li"><Link to="/historial" className="Cabecera-a">HISTORIAL</Link></li>
          </ul>
        </nav>
      </header>

      <div className="login-hero-Cabecera-mercado" style={{ backgroundImage: `url(${Fondo})` }}>
        <div id="particles-js" style={{ position: 'absolute', inset: 0 }} />
        {openModal && (<ModalPerfil usuario={usuario} openModal={openModal} setOpenModal={setOpenModal} />)}
        {openModalAdmin && (<ModalAdmin usuario={usuario} openModal={openModalAdmin} setOpenModal={setOpenModalAdmin} />)}
        {openModalJugadorMercado && jugadorSeleccionado && (<ModalJugadorMercado jugador={jugadorSeleccionado} openModal={openModalJugadorMercado} setOpenModal={setOpenModalJugadorMercado}/>)}
        <div className="temporizador">
          <TemporizadorRefresco />
        </div>
        <div className="tabs-wrapper">
          <div className="tabs-container">
            <button className={`tab-btn ${tabActiva === "mercado" ? "active" : ""}`} onClick={() => setTabActiva("mercado")}>Mercado</button>
            <button className={`tab-btn ${tabActiva === "operaciones" ? "active" : ""}`} onClick={() => setTabActiva("operaciones")}>Mis operaciones</button>
          </div>

          {tabActiva === "mercado" && (
            <div className="mercado-jugadores">
              {jugadoresMercado.length === 0 ? (
                <div className="sin-mercado"><p>No hay mercado disponible</p></div>
              ) : (
                <ul className="lista-jugadores">
                  {jugadoresMercado.map((j) => {
                    const key = `${j.idJugador}-${j.source}-${j.vendedorUid || 'system'}`;
                    return (
                      <li key={key} className="jugador-card"
                        onClick={() => { setJugadorSeleccionado(j); setOpenModalJugadorMercado(true); }}>
                        <div className="jugador-perfil">
                          <div className="modal-header">
                            <label className="modal-avatar">
                              <img src={j.foto || ImagenProfile} alt={j.nombre} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = ImagenProfile }} />
                            </label>
                            <div className="modal-jugadorinfo">
                              <h2>{j.nombre}</h2>

                              <div className='posicion-precio'>
                                <div className={`posicion-texto ${j.posicion || ''}`}>
                                  <small>{traducirPosicion(j.posicion)}</small>
                                </div>

                                <div className='precio-container'>
                                  <div className='precio'>
                                    <small><span className='texto-blanco'>Valor:</span> {Number(j.precio) ? formatearDinero(Number(j.precio)) : "—"}</small>
                                  </div>
                                  <div className="diferencia-precio">
                                    {(() => {
                                      const historial = j.historialPrecios || [];
                                      if (historial.length === 0) return <small>(±0€)</small>;
                                      const ultimoPrecio = historial[historial.length - 1]?.precio || 0;
                                      const diferencia = (j.precio || 0) - ultimoPrecio;
                                      const signo = diferencia > 0 ? "+" : diferencia < 0 ? "-" : "±";
                                      return <small className={diferencia > 0 ? "subida" : diferencia < 0 ? "bajada" : "igual"}>({signo}{formatearDinero(Math.abs(diferencia))})</small>;
                                    })()}
                                  </div>
                                </div>

                                <small className="texto-vendedor">Vendedor:&nbsp;<span className="vendedor">{j.vendedor}</span></small>
                                <small className="texto-vendedor">Media de puntos:&nbsp;<span className="media">{
                                  j.puntosPorJornada && j.puntosPorJornada.length > 0
                                    ? (j.puntosPorJornada.filter(p => typeof p === "number").reduce((acc, val, _, arr) => acc + val / arr.length, 0)).toFixed(2)
                                    : "-"
                                }</span></small>
                              </div>
                              {/* últimas jornadas */}
                              <div className="estadisticas-extra">
                                <div className="ultimas-jornadas">
                                  {(j.puntosPorJornada || []).slice(-5).map((p, i) => {
                                    const puntos = p != null ? p : "-";
                                    const total = j.puntosPorJornada ? j.puntosPorJornada.length : 0;
                                    const jornadaIndex = Math.max(1, total - 5 + i + 1);
                                    let claseColor = "";
                                    if (typeof p === "number") {
                                      if (p >= 9) claseColor = "verde";
                                      else if (p < 7) claseColor = "rojo";
                                    }
                                    return (
                                      <div key={i} className="jornada-item">
                                        <small className="jornada-nombre">J{jornadaIndex}</small>
                                        <div className={`jornada-cuadro ${claseColor}`}>{puntos}</div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                            </div>
                          </div>
                          <hr />
                          <div className="modal-footer">
                            {(() => {
                              // 1. Buscar si ya existe una oferta tuya por este jugador y vendedor
                              const ofertaExistente = misOfertas.find(o => 
                                (o.idJugador === j.idJugador || o.jugadorId === j.idJugador) && 
                                (o.vendedorUid === j.vendedorUid || (!o.vendedorUid && !j.vendedorUid))
                              );

                              // 2. Si es tu propio jugador en venta
                              if (j.vendedorUid === auth.currentUser?.uid) {
                                return (
                                  <button className="btn-comprar" disabled={true}>
                                    Es tu venta
                                  </button>
                                );
                              }

                              // 3. Si ya tienes una oferta, mostrar botones de modificar y cancelar
                              if (ofertaExistente) {
                                return (
                                  <>
                                    <button
                                      className="btn-comprar"
                                      disabled={!edicionActiva || !equipocreado}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        aumentarOferta(ofertaExistente);
                                      }}
                                    >
                                      Modificar
                                    </button>
                                    <button
                                      className="btn-cancelar"
                                      disabled={!edicionActiva || !equipocreado}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        retirarOferta(ofertaExistente);
                                      }}
                                    >
                                      Cancelar Oferta
                                    </button>
                                  </>
                                );
                              }

// 4. Si no tienes oferta, mostrar botón para hacer una nueva
  return (
    <button
      className="btn-comprar"
      disabled={!edicionActiva || !equipocreado}
      onClick={(e) => {
        e.stopPropagation();
        hacerOferta(j); // Llamamos a la función limpia que ya tiene el formateo
      }}
    >
      {`Hacer oferta - (${conteoOfertas[`${j.idJugador}-${j.vendedorUid || 'system'}`] || 0})`}
    </button>
  );
                            })()}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {tabActiva === "operaciones" && (
            <div className="mercado-jugadores">
            <h3 className="titulo-seccion">Mis ventas activas</h3>
            {jugadoresUsuario.length === 0 && misOfertas.length === 0 ? (
              <div className="sin-mercado">
                <p>No tienes operaciones activas.</p>
              </div>
              ) : (
                
                  <ul className="lista-jugadores">
                  {jugadoresUsuario.map((j, i) => {
                    const key = `${j.idJugador}-${i}-${j.vendedorUid || 'yo'}`;
                    const esMiVenta = j.vendedorUid === auth.currentUser?.uid; // soy el vendedor
                    const miOferta = null; // aquí deberías buscar si ya hice una oferta sobre este jugador

                    return (
                      <li key={key} className="jugador-card"
                        onClick={() => { setJugadorSeleccionado(j); setOpenModalJugadorMercado(true); }}>
                          <div className="jugador-perfil">
                            <div className="modal-header">
                              <label className="modal-avatar">
                                <img
                                  src={j.foto || ImagenProfile}
                                  alt={j.nombre}
                                  onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = ImagenProfile }}
                                />
                              </label>
                              <div className="modal-jugadorinfo">
                                <h2>{j.nombre}</h2>

                                <div className='posicion-precio'>
                                  <div className={`posicion-texto ${j.posicion || ''}`}>
                                    <small>{traducirPosicion(j.posicion)}</small>
                                  </div>

                                  <div className='precio-container'>
                                    <div className='precio'>
                                      <small><span className='texto-blanco'>Valor:</span> {Number(j.precio) ? formatearDinero(Number(j.precio)) : "—"}</small>
                                    </div>
                                    <div className="diferencia-precio">
                                      {(() => {
                                        const historial = j.historialPrecios || [];
                                        if (historial.length === 0) return <small>(±0€)</small>;
                                        const ultimoPrecio = historial[historial.length - 1]?.precio || 0;
                                        const diferencia = (j.precio || 0) - ultimoPrecio;
                                        const signo = diferencia > 0 ? "+" : diferencia < 0 ? "-" : "±";
                                        return (
                                          <small className={diferencia > 0 ? "subida" : diferencia < 0 ? "bajada" : "igual"}>
                                            ({signo}{formatearDinero(Math.abs(diferencia))})
                                          </small>
                                        );
                                      })()}
                                    </div>
                                  </div>

                                  <div className="precio-container">
                                    <small className="precio"><span className='texto-blanco'>Precio Venta:</span> {Number(j.precioVenta) ? formatearDinero(Number(j.precioVenta)) : "—"} </small>
                                  </div>      
                                  <small className="texto-vendedor">
                                    Media de puntos:&nbsp;<span className="media">{
                                      j.puntosPorJornada && j.puntosPorJornada.length > 0
                                        ? (j.puntosPorJornada.filter(p => typeof p === "number")
                                            .reduce((acc, val, _, arr) => acc + val / arr.length, 0)).toFixed(2)
                                        : "-"
                                    }</span>
                                  </small>
                                </div>

                                {/* últimas jornadas */}
                                <div className="estadisticas-extra">
                                  <div className="ultimas-jornadas">
                                    {(j.puntosPorJornada || []).slice(-5).map((p, idx) => {
                                      const puntos = p != null ? p : "-";
                                      const total = j.puntosPorJornada ? j.puntosPorJornada.length : 0;
                                      const jornadaIndex = Math.max(1, total - 5 + idx + 1);
                                      let claseColor = "";
                                      if (typeof p === "number") {
                                        if (p >= 9) claseColor = "verde";
                                        else if (p < 7) claseColor = "rojo";
                                      }
                                      return (
                                        <div key={idx} className="jornada-item">
                                          <small className="jornada-nombre">J{jornadaIndex}</small>
                                          <div className={`jornada-cuadro ${claseColor}`}>{puntos}</div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                              </div>
                            </div>
                            <hr />
                            <div className="modal-footer">
                              {esMiVenta ? (
                                <>
                                  <button
                                    className="btn-comprar"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      verOfertar(j);
                                    }}
                                    disabled={!equipocreado}
                                  >
                                    Ver ofertas - ({conteoOfertas[`${j.idJugador}-${j.vendedorUid || 'system'}`] || 0})
                                  </button>
                                  <button
                                    className="btn-cancelar"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      retirarVenta(j);
                                    }}
                                    disabled={!equipocreado}

                                  >
                                    Retirar venta
                                  </button>
                                </>
                              ) : miOferta ? (
                                <>
                                  <button
                                    className="btn-comprar"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      aumentarOferta(miOferta);
                                    }}
                                    disabled={!equipocreado}

                                  >
                                    Aumentar oferta
                                  </button>
                                  <button
                                    className="btn-cancelar"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      retirarOferta(miOferta);
                                    }}
                                    disabled={!equipocreado}

                                  >
                                    Retirar oferta
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    className="btn-comprar"
                                    disabled={!equipocreado}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      hacerOferta(j);
                                    }}

                                  >
                                    Hacer oferta
                                  </button>
                                  <button
                                    className="btn-comprar"
                                    disabled={!equipocreado}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      verOfertar(j);
                                    }}
                                  >
                                    Ver ofertas - ({conteoOfertas[`${j.idJugador}-${j.vendedorUid}`] || 0})
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
              )}
              {/* Mis ofertas */}
              {misOfertas.length > 0 && (
                <>
                  <h3 className="titulo-seccion">Mis ofertas activas</h3>
                  <ul className="lista-jugadores">
                    {misOfertas.map((o, i) => (
                      <li key={o.id} className="jugador-card">
                        <div className="jugador-perfil">
                          <div className="modal-header">
                            <label className="modal-avatar">
                              <img src={o.foto || ImagenProfile} alt={o.nombre} />
                            </label>
                              <div className="modal-jugadorinfo">
                                <h2>{o.nombre}</h2>

                                <div className='posicion-precio'>
                                  <div className={`posicion-texto ${o.posicion || ''}`}>
                                    <small>{traducirPosicion(o.posicion)}</small>
                                  </div>

                                  <div className='precio-container'>
                                    <div className='precio'>
                                      <small><span className='texto-blanco'>Valor:</span> {Number(o.precio) ? formatearDinero(Number(o.precio)) : "—"}</small>
                                    </div>
                                    <div className="diferencia-precio">
                                      {(() => {
                                        const historial = o.historialPrecios || [];
                                        if (historial.length === 0) return <small>(±0€)</small>;
                                        const ultimoPrecio = historial[historial.length - 1]?.precio || 0;
                                        const diferencia = (o.precio || 0) - ultimoPrecio;
                                        const signo = diferencia > 0 ? "+" : diferencia < 0 ? "-" : "±";
                                        return (
                                          <small className={diferencia > 0 ? "subida" : diferencia < 0 ? "bajada" : "igual"}>
                                            ({signo}{formatearDinero(Math.abs(diferencia))})
                                          </small>
                                        );
                                      })()}
                                    </div>
                                  </div>

                                  <div className="precio-container">
                                    <small className="precio"><span className='texto-blanco'>Precio Venta:</span> {Number(o.precioVenta) ? formatearDinero(Number(j.precioVenta)) : "—"} </small>
                                  </div>      
                                  <small className="texto-vendedor">
                                    Media de puntos:&nbsp;<span className="media">{
                                      o.puntosPorJornada && o.puntosPorJornada.length > 0
                                        ? (o.puntosPorJornada.filter(p => typeof p === "number")
                                            .reduce((acc, val, _, arr) => acc + val / arr.length, 0)).toFixed(2)
                                        : "-"
                                    }</span>
                                  </small>
                                </div>

                                {/* últimas jornadas */}
                                <div className="estadisticas-extra">
                                  <div className="ultimas-jornadas">
                                    {(o.puntosPorJornada || []).slice(-5).map((p, idx) => {
                                      const puntos = p != null ? p : "-";
                                      const total = o.puntosPorJornada ? o.puntosPorJornada.length : 0;
                                      const jornadaIndex = Math.max(1, total - 5 + idx + 1);
                                      let claseColor = "";
                                      if (typeof p === "number") {
                                        if (p >= 9) claseColor = "verde";
                                        else if (p < 7) claseColor = "rojo";
                                      }
                                      return (
                                        <div key={idx} className="jornada-item">
                                          <small className="jornada-nombre">J{jornadaIndex}</small>
                                          <div className={`jornada-cuadro ${claseColor}`}>{puntos}</div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                              </div>
                          </div>
                          <hr />
                          <div className="modal-footer">
                            <button
                              className="btn-cancelar"
                              disabled={!equipocreado}
                              onClick={(e) => {
                                e.stopPropagation();
                                retirarOferta(o);
                              }}
                            >
                              Retirar oferta
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

        </div>
      </div>

      {showOnboarding && (
        <div className="onboarding-overlay">
          <div className="loader">Cargando...</div>
        </div>
      )}

      {/* --- MODAL DE OFERTAS INTERACTIVO --- */}
      {mostrarModalOfertas && (
        <div className="modal-ofertas-overlay" onClick={() => setMostrarModalOfertas(false)}>
          <div className="modal-ofertas-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-ofertas-header">
              <h3>Ofertas por {jugadorOfertasSeleccionado?.nombre}</h3>
              <button className="btn-close-modal" onClick={() => setMostrarModalOfertas(false)}>X</button>
            </div>
            
            {ofertasRecibidas.length === 0 ? (
              <p style={{textAlign: "center", padding: "20px"}}>No quedan ofertas pendientes.</p>
            ) : (
              <ul className="lista-ofertas-recibidas">
                              {ofertasRecibidas.map((oferta) => (
                                <li key={oferta.id} className="fila-oferta-item">
                                  <div className="info-oferta-monto">
                                    
                                    {/* --- NUEVO CONTENEDOR DE FOTO Y NOMBRE --- */}
                                    <div className="oferta-comprador-container">
                                      <img src={oferta.compradorFoto} alt="Avatar" className="oferta-avatar" />
                                      <span className="oferta-comprador">De: <strong>{oferta.compradorNick}</strong></span>
                                    </div>
                                    
                                    <span className="oferta-dinero">{formatearDinero(oferta.monto)}</span>
                                  </div>
                                  <div className="acciones-oferta-btn">
                                    <button onClick={() => aceptarOferta(oferta)} className="btn-aceptar-oferta">✅ Aceptar</button>
                                    <button onClick={() => rechazarOferta(oferta)} className="btn-rechazar-oferta">❌ Rechazar</button>
                                  </div>
                                </li>
                              ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


