import React, { useState, useRef, useEffect } from "react";
import { Link } from 'react-router-dom';
import appFirebase from "../credenciales";
import { arrayRemove, arrayUnion } from "firebase/firestore";
import { getAuth, signOut } from 'firebase/auth'
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  collection,
  onSnapshot,
  getDocs,
  increment,
  serverTimestamp
} from 'firebase/firestore';
import ImagenProfile from '/SinPerfil.jpg'
import Fondo from '../assets/fondo.png'
import "./Mercado.css";
import ModalPerfil from "./ModalPerfil"
import ModalAdmin from './ModalAdmin'
import ModalJugadorMercado from "./ModalJugadorMercado";

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
  // -------------------------------
  // Otras utilidades: compra (solo sistema)...
  // -------------------------------
  const pujarJugador = async (jugador) => {
    // solo permitir para source === 'system'
    if (jugador.source !== 'system') {
      alert("Las pujas directas solo están permitidas para jugadores del mercado del sistema. Para jugadores puestos por usuarios, abre el detalle.");
      return;
    }

    if (jugador.stock <= 0) {
      alert("Ya no queda stock de este jugador");
      return;
    }

    try {
      const refMercado = doc(db, "mercado", "actual");
      const snap = await getDoc(refMercado);
      if (!snap.exists()) return;
      const data = snap.data();
      const lista = (data.jugadores || []).map((j) =>
        j.idJugador === jugador.idJugador ? { ...j, stock: j.stock - 1 } : j
      );
      await updateDoc(refMercado, { jugadores: lista });

      // Reducir stock en la colección global de jugadores
      await updateDoc(doc(db, "jugadores", jugador.idJugador), {
        stockTotal: increment(-1),
      });

      // Añadir jugador al usuario comprador (ejemplo sencillo: al banquillo)
      const refUsuario = doc(db, "usuarios", auth.currentUser.uid);
      await updateDoc(refUsuario, {
        "equipo.banquillo": [...(usuario.equipo?.banquillo || []), jugador.idJugador]
      });

      // Actualizamos estado local (para respuesta rápida)
      setSistemaEnr(prev => prev.map(p => p.idJugador === jugador.idJugador ? { ...p, stock: (p.stock || 1) - 1 } : p));
      alert(`Has comprado a ${jugador.nombre}`);
    } catch (err) {
      console.error("Error comprando jugador:", err);
      alert("Error al comprar el jugador");
    }
  };

  const verOfertas = async () =>{

  }
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
    <div>
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

      <div className="login-hero-Cabecera" style={{ backgroundImage: `url(${Fondo})` }}>
        <div id="particles-js" style={{ position: 'absolute', inset: 0 }} />
        {openModal && (<ModalPerfil usuario={usuario} openModal={openModal} setOpenModal={setOpenModal} />)}
        {openModalAdmin && (<ModalAdmin usuario={usuario} openModal={openModalAdmin} setOpenModal={setOpenModalAdmin} />)}
        {openModalJugadorMercado && jugadorSeleccionado && (<ModalJugadorMercado jugador={jugadorSeleccionado} openModal={openModalJugadorMercado} setOpenModal={setOpenModalJugadorMercado}/>)}

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
                              disabled={
                                !edicionActiva || j.vendedorUid === auth.currentUser?.uid
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                if (j.source === 'system') pujarJugador(j);
                                else {
                                  setJugadorSeleccionado(j);
                                  setOpenModalJugadorMercado(true);
                                }
                              }}
                            >
                              {j.vendedorUid === auth.currentUser?.uid ? "Es tu venta" : "Hacer oferta"}
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
              {!jugadoresMercado.some(j => j.vendedorUid === auth.currentUser?.uid) ? (
                <div className="sin-mercado">
                  <p>No tienes operaciones activas.</p>
                </div>
              ) : (
                  <ul className="lista-jugadores">
                    {jugadoresUsuario.map((j, i) => {
                      const key = `${j.idJugador}-${i}-${j.vendedorUid || 'yo'}`;
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
                              <button
                                className="btn-comprar"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  verOfertar();
                                }}>
                                Ver ofertas
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
