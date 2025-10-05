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
  serverTimestamp
} from 'firebase/firestore';
import ImagenProfile from '/SinPerfil.jpg'
import Fondo from '../assets/fondo.png'
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
            precioVenta: typeof listing.precioVenta === 'number' ? listing.precioVenta : Number(listing.precioVenta),
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
        precioOferta: data.precio || 0,
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
  
  // Mirar mis ofertas
  useEffect(() => {
    if (!usuario?.uid) return;

    const qMisOfertas = query(
      collection(db, "ofertas"),
      where("compradorUid", "==", usuario.uid)
    );

    const unsub = onSnapshot(qMisOfertas, (snapshot) => {
      const ofertas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log("📦 Ofertas detectadas para el usuario:", ofertas);
      setMisOfertas(ofertas);
    });

    return () => unsub();
  }, [usuario]);

  // Mirar número de ofertas
  useEffect(() => {
    const q = query(collection(db, "ofertas"));
    const unsub = onSnapshot(q, (snapshot) => {
      const counts = {};
      snapshot.forEach(doc => {
        const data = doc.data();
        const key = `${data.jugadorId}-${data.source}-${data.vendedorUid || 'system'}`;
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
      // crear oferta
      await addDoc(collection(db, "ofertas"), {
        jugadorId: jugador.idJugador,
        source: jugador.source || "system",
        vendedorUid: jugador.vendedorUid || null, // null si es del sistema
        compradorUid: user.uid,
        precioOferta: precioOferta,
        fecha: serverTimestamp(),
      });

      Swal.fire("✅ Oferta realizada", `Has hecho una oferta por ${jugador.nombre}`, "success");
    } catch (err) {
      console.error("Error creando oferta:", err);
      Swal.fire("❌ Error", "Ocurrió un problema al hacer la oferta", "error");
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

  // Ver ofertas (abre un modal o alerta con las ofertas activas)
  const verOfertar = async (jugador) => {
    const q = query(collection(db, "ofertas"), where("jugadorId", "==", jugador.idJugador));
    const snapshot = await getDocs(q);
    const ofertas = snapshot.docs.map((d) => d.data());

    if (ofertas.length === 0) {
      Swal.fire("ℹ️ Sin ofertas", "Todavía no hay ofertas para este jugador.", "info");
      return;
    }

    let html = ofertas
      .map(
        (o) =>
          `<p><b>${o.precioOferta.toLocaleString("es-ES")}€</b> - Comprador: ${o.compradorUid}</p>`
      )
      .join("");

    Swal.fire({
      title: `Ofertas para ${jugador.nombre}`,
      html,
      confirmButtonText: "Cerrar",
    });
  };

  // Hacer oferta nueva
  const hacerOferta = async (jugador) => {
    const { value: precio } = await Swal.fire({
      title: `Oferta por ${jugador.nombre}`,
      input: "number",
      inputLabel: "Introduce tu oferta (€)",
      inputPlaceholder: "Ej: 5.000.000",
      showCancelButton: true,
      confirmButtonText: "Enviar oferta",
    });

    if (!precio) return;

    await pujarJugador(jugador, Number(precio));
  };

  // Retirar oferta
  const retirarOferta = async (oferta) => {
    try {
      await deleteDoc(doc(db, "ofertas", oferta.id));
      Swal.fire("✅ Oferta retirada", "Tu oferta ha sido retirada", "success");
    } catch (err) {
      console.error(err);
      Swal.fire("❌ Error", "No se pudo retirar la oferta", "error");
    }
  };

  // Aumentar oferta
  const aumentarOferta = async (oferta) => {
    const { value: nuevoPrecio } = await Swal.fire({
      title: "Aumentar oferta",
      input: "number",
      inputLabel: "Nuevo precio (€)",
      inputPlaceholder: "Ej: 6.000.000",
      showCancelButton: true,
      confirmButtonText: "Actualizar",
    });

    if (!nuevoPrecio) return;

    try {
      const ref = doc(db, "ofertas", oferta.id);
      await updateDoc(ref, { precioOferta: Number(nuevoPrecio) });
      Swal.fire("✅ Oferta actualizada", "Tu oferta fue aumentada", "success");
    } catch (err) {
      console.error(err);
      Swal.fire("❌ Error", "No se pudo actualizar la oferta", "error");
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
          window.location.reload();
        } catch (err) { console.error(err); }
      }, 500);
      return () => clearTimeout(timer);
    }

    (async () => {
      try {
        const ref = doc(db, "usuarios", usuario.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) setDinero(snap.data().dinero);
      } catch (err) { }
    })();

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
                            <button
                              className="btn-comprar"
                              disabled={!edicionActiva || j.vendedorUid === auth.currentUser?.uid}
                              onClick={async (e) => { // << aquí añadimos async
                                e.stopPropagation();

                                const { value: precio } = await Swal.fire({
                                  title: "Introduce el precio de venta",
                                  input: "number",
                                  inputLabel: "Precio en €",
                                  inputPlaceholder: "Ej: 5.000.000",
                                  confirmButtonText: "Hacer oferta",
                                  cancelButtonText: "Cancelar",
                                  showCancelButton: true,
                                  scrollbarPadding: false, // <--- evita la franja blanca por scrollbar
                                  background: "#1e1e1e",
                                  color: "#fff",
                                  inputValidator: (value) => {
                                    if (!value || value <= 0) {
                                      return "Debes introducir un precio válido";
                                    }
                                    if (value < j.precio) {
                                      return "Debes introducir un precio que sea mínimo superior al valor de mercado";
                                    }
                                  },
                                });

                                if (precio) {
                                  console.log("Venta en mercado por", precio);
                                  pujarJugador(j, parseInt(precio, 10));
                                }
                              }}
                            >
                              {j.vendedorUid === auth.currentUser?.uid
                                ? "Es tu venta"
                                : `Hacer oferta - (${conteoOfertas[`${j.idJugador}-${j.source}-${j.vendedorUid || 'system'}`] || 0})`}
                            </button>
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
                                  >
                                    Ver ofertas - ({conteoOfertas[`${j.idJugador}-${j.vendedorUid}`] || 0})
                                  </button>
                                  <button
                                    className="btn-cancelar"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      retirarVenta(j);
                                    }}
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
                                  >
                                    Aumentar oferta
                                  </button>
                                  <button
                                    className="btn-cancelar"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      retirarOferta(miOferta);
                                    }}
                                  >
                                    Retirar oferta
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    className="btn-comprar"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      hacerOferta(j);
                                    }}
                                  >
                                    Hacer oferta
                                  </button>
                                  <button
                                    className="btn-comprar"
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
    </div>
  );
}
