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
  query, 
  where,
  setDoc,
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
  const [jugadoresMercado, setJugadoresMercado] = useState([]);
  const [jugadoresUsuario, setJugadoresUsuario] = useState([]);    // Estado inicial: la formación actual del usuario
  const [guardando, setGuardando] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [openModalJugadorMercado, setOpenModalJugadorMercado] = useState(false)
  const [openModalAdmin, setOpenModalAdmin] = useState(false)
  const [jugadorSeleccionado, setJugadorSeleccionado] = useState(null)
  const [menuActivo, setMenuActivo] = useState(false);
  const refMenu = useRef(null);
  // NUEVO: añadir estado para controlar la pestaña activa
  const [tabActiva, setTabActiva] = useState("mercado");
  const logout = () => signOut(auth);

  // Cerramos el menú si clicas fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (refMenu.current && !refMenu.current.contains(event.target)) {
        setMenuActivo(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const cargarMercado = async () => {
      const ref = doc(db, "mercado", "actual");
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data();
        // Aseguramos que todos tienen vendedor
        const jugadoresSistema = (data.jugadores || []).map(j => ({
          ...j,
          vendedor: j.vendedor || "Fantasy Casadillos",
        }));
        setJugadoresMercado(jugadoresSistema);
      } else {
        setJugadoresMercado([]); 
      }

    };

    cargarMercado();
  }, []);

  useEffect(() => {
  const cargarMercado = async () => {
    const ref = doc(db, "mercado", "actual");
    const snap = await getDoc(ref);

    let jugadoresSistema = [];
    if (snap.exists()) {
      const data = snap.data();
      jugadoresSistema = data.jugadores || [];
    }

    // --- Cargar jugadores puestos por usuarios ---
    const refUsuarios = collection(db, "mercado/actual/usuarios");
    const snapUsuarios = await getDocs(refUsuarios);
    const jugadoresUsuarios = snapUsuarios.docs.map(d => ({
      idVenta: d.id,
      ...d.data(),
      vendedor: d.data().vendedorNick || "Usuario",
    }));

    // Unimos ambos
    setJugadoresMercado([...jugadoresSistema, ...jugadoresUsuarios]);
  };

  cargarMercado();
  }, []);

  const refrescarMercado = async () => {
    setLoadingMercado(true); // 👈 empieza la carga
    try {
      const refMercado = doc(db, "mercado", "actual");
      const snapMercado = await getDoc(refMercado);

      if (snapMercado.exists()) {
        const data = snapMercado.data();

        // ⚠️ SOLO devolvemos stock de jugadores del sistema
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

      setJugadoresMercado([...seleccionados, ...jugadoresUsuarios]);
    } catch (error) {
      console.error("Error al refrescar mercado:", error);
    } finally {
      setLoadingMercado(false); // 👈 termina la carga
    }
  };

  // cargar titulares usuario
  useEffect(() => {
    const fetchJugadoresUsuario = async () => {
      if (!titulares || titulares.length === 0) return;

      const jugadoresRef = collection(db, "jugadores");
      const q = query(jugadoresRef, where("__name__", "in", titulares));
      const snap = await getDocs(q);

      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setJugadoresUsuario(data);
    };

    fetchJugadoresUsuario();
  }, [titulares]);

  // para que se reflejen los cambios sin actualizar
  useEffect(() => {
    const db = getFirestore(appFirebase);
    const mercadoRef = doc(db, "mercado", "actual");

    // Nos suscribimos a cambios en el documento
    const unsubscribe = onSnapshot(mercadoRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const jugadoresSistema = (data.jugadores || []).map(j => ({
          ...j,
          vendedor: j.vendedor || "Fantasy Casadillos",
        }));
        setJugadoresMercado(jugadoresSistema);
      } else {
        setJugadoresMercado([]);
      }
    });

    return () => unsubscribe(); // cleanup al desmontar
  }, []);

  // 🛒 Pujar jugador
  const pujarJugador = async (jugador) => {
    if (jugador.stock <= 0) {
      alert("Ya no queda stock de este jugador");
      return;
    }

    const refMercado = doc(db, "mercado", "actual");
    const snap = await getDoc(refMercado);
    if (!snap.exists()) return;

    const data = snap.data();

    // Reducir stock del jugador en el mercado
    const lista = data.jugadores.map((j) =>
      j.idJugador === jugador.idJugador
        ? { ...j, stock: j.stock - 1 }
        : j
    );
    await updateDoc(refMercado, { jugadores: lista });

    // Reducir stock en la colección global de jugadores
    await updateDoc(doc(db, "jugadores", jugador.idJugador), {
      stockTotal: increment(-1),
    });

    // Añadir jugador al usuario
    const refUsuario = doc(db, "usuarios", auth.currentUser.uid);
    await updateDoc(refUsuario, {
      "equipo.banquillo": [...(usuario.equipo?.banquillo || []), jugador.idJugador]
    });

    setJugadoresMercado(lista); // actualizar estado en React
    alert(`Has comprado a ${jugador.nombre}`);
  };

  const toggleMenu = () => {
    setMenu(!menu)
  }
  
  const traducirPosicion = (pos) => {
    switch (pos) {
      case "DEF":
        return "Defensa";
      case "MED":
        return "Mediocentro";
      case "DEL":
        return "Delantero";
      case "POR":
        return "Portero";
      default:
        return pos || "Sin posición";
    }
  };

  const formatearDinero = (valor) => {
    if (typeof valor !== "number" || isNaN(valor)) {
      return "—"; // o "0€" si prefieres
    }
    return valor.toLocaleString("es-ES") + "€";  
  };

  const abreviarNick = (nick) => {
    if (!nick) return "";

    const maxLength = 10
    const firstSpace = nick.indexOf(" ");

    let corte;

    if (firstSpace !== -1 && firstSpace <= maxLength) {
      corte = firstSpace; // cortar en el espacio si está antes de 9
      return nick.slice(0, corte) + "...";
      
    } else if (nick.length > maxLength) {
      corte = maxLength-3; // cortar en 9 si es más largo

      return nick.slice(0, corte) + "...";
    } else {
      return nick; // no hace falta cortar
    }

  };

  useEffect(() => {
    if (usuario && usuario?.onboarding === false) {
      setShowOnboarding(true);

      const timer = setTimeout(async () => {
        try {
          const userRef = doc(db, "usuarios", auth.currentUser.uid);
          await updateDoc(userRef, { onboarding: true });
          window.location.reload(); // refresca la página
        } catch (error) {
          console.error("Error actualizando onboarding:", error);
        }
      }, 500);

      return () => clearTimeout(timer);
    }

    console.log('Foto de perfil desde Firestore o Auth:', usuario?.fotoPerfil)
    // Partículas
    if (window.particlesJS) {
      window.particlesJS.load('particles-js', 'particles.json', () => {
        console.log('Particles.js config cargado')
      })
      
    }
    
    // Leer dinero de Firestore
    if (usuario) {
      const ref = doc(db, 'usuarios', usuario.uid)
      getDoc(ref).then((snap) => {
        if (snap.exists()) {
          setDinero(snap.data().dinero)
        }
      })
    }
  }, [usuario], [titulares], );

  return (
    <div>
      <header className="Cabecera">
        <div className="container-profile">

          <div className='img-profile-small' style={{ position: 'relative' }}>
            <img
              src={fotoURL}
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = ImagenProfile }}
              alt="Foto de perfil"
              onClick={() => setMenuActivo(!menuActivo)} // toggle con clic
              onMouseEnter={() => setMenuActivo(true)} // hover
            />

            {menuActivo && (
              <div
                className="perfil-bocadillo"
                ref={refMenu}
                onMouseLeave={() => setMenuActivo(false)} // solo se cierra al salir del menú
              >
              <div className="triangulo" />
                  <button className="btn-perfil" onClick={() => { setOpenModal(true); setMenuActivo(false); }}>👤 Perfil</button>
                  
                  <button className="btn-logout" onClick={logout}>➜] Cerrar sesión</button>

                  {usuario?.rol === 'admin' && <button className="btn-admin" onClick={() => { setOpenModalAdmin(true); setMenuActivo(false); }}>⚙️ Admin</button>}
              </div>
            )}
          </div>

          <div className="info-profile">
            <h2 className="nombre-usuario">
              {(usuario?.nick || usuario?.displayName)}
            </h2>
            {dinero !== null && (
              <p className="dinero-usuario">
                💰<strong>{formatearDinero(dinero)}</strong>
              </p>
            )}
          </div>
        </div>

        <button onClick={toggleMenu} className="Cabecera-button">
          <svg className='Cabecera-svg' xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path fillRule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5"/>
          </svg>
        </button>

        <nav className={`Cabecera-nav ${menu ? 'isActive' : ''}`}>
          <ul className="Cabecera-ul">
            <li className="Cabecera-li">
              <Link to="/home" className="Cabecera-a">EQUIPO</Link>
            </li>
            <li className="Cabecera-li">
              <Link to="/mercado" className="Cabecera-a">MERCADO</Link>
            </li>
            <li className="Cabecera-li">
              <Link to="/clasificacion" className="Cabecera-a">CLASIFICACIÓN</Link>
            </li>
            <li className="Cabecera-li">
              <Link to="/historial" className="Cabecera-a">HISTORIAL</Link>
            </li>
          </ul>
        </nav>
      </header>

      <div className="login-hero-Cabecera" style={{backgroundImage: `url(${Fondo})`,}}>
        <div id="particles-js" style={{ position: 'absolute', inset: 0 }}></div>
        {openModal && 
          (<ModalPerfil usuario={usuario} openModal= {openModal} setOpenModal={setOpenModal} />)
        }
        {openModalAdmin &&       
          (<ModalAdmin usuario={usuario} openModal= {openModalAdmin} setOpenModal={setOpenModalAdmin}/>)
        }
        {openModalJugadorMercado && jugadorSeleccionado &&           
          (<ModalJugadorMercado jugador={jugadorSeleccionado} openModal= {openModalJugadorMercado} setOpenModal={setOpenModalJugadorMercado} />)}
        <div className="tabs-wrapper">
                  {/* Pestañas de navegación */}
        <div className="tabs-container" style={{}}>
          <button
            className={`tab-btn ${tabActiva === "mercado" ? "active" : ""}`}
            onClick={() => setTabActiva("mercado")}
          >
            Mercado
          </button>
          <button
            className={`tab-btn ${tabActiva === "operaciones" ? "active" : ""}`}
            onClick={() => setTabActiva("operaciones")}
          >
            Mis operaciones
          </button>
        </div>
  
        {tabActiva === "mercado" && (<div className="mercado-jugadores">
          {/* {usuario?.rol === "admin" && (
            <button 
              onClick={refrescarMercado} 
              className="btn-actualizar-mercado"
              disabled={loadingMercado} // desactivar mientras carga
            >
            {loadingMercado ? <>⏳ Actualizando <span className="spinner"></span></> : "⟳ Actualizar mercado"}
            </button>
          )}*/}
          {jugadoresMercado.length === 0 ? (
            <div className="sin-mercado">
              <p>No hay mercado disponible</p>
            </div>
          ) : (
          <ul className="lista-jugadores">
            {jugadoresMercado.map((j) => (
              <li key={j.idJugador} className="jugador-card"   
                onClick={() => {
                  setJugadorSeleccionado(j);
                  setOpenModalJugadorMercado(true);
                }}>
                <div className="jugador-perfil">
                  {/* botón cerrar */}
                  <div className="modal-header">
                    <label className="modal-avatar">
                      <img src={j.foto || ImagenProfile} alt={j.nombre} 
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = ImagenProfile;
                            }}/>
                    </label>
                    <div className="modal-jugadorinfo">
                      <h2>{window.innerWidth < 450 ? (j.nombre) : j.nombre}</h2>
                      <div className='posicion-precio'>
                        <div className={`posicion-texto ${j.posicion}`}>
                          <small>{traducirPosicion(j.posicion)}</small>
                        </div>
                        {/* Contenedor de precio + diferencia */}
                        <div className='precio-container'>
                          <div className='precio'>
                            <small><span className='texto-blanco'>Valor:</span> {formatearDinero(j.precio)}</small>
                          </div>
                          
                          <div className="diferencia-precio">
                            {(() => {
                              const historial = j.historialPrecios || [];
                              if (historial.length === 0) return <small>(±0€)</small>;
                              const ultimoPrecio = historial[historial.length - 1].precio || 0;
                              const diferencia = j.precio - ultimoPrecio;
                              const signo = diferencia > 0 ? "+" : diferencia < 0 ? "-" : "±";
                              return (
                                <small className={diferencia > 0 ? "subida" : diferencia < 0 ? "bajada" : "igual"}>
                                  ({signo}{formatearDinero(Math.abs(diferencia))})
                                </small>
                              );
                            })()}
                          </div>

                        </div>
                        <small className="texto-vendedor">Vendedor:&nbsp;<span className="vendedor">{j.vendedor}</span></small>
                      </div>
                      {/* Nuevo bloque debajo */}
                      <div className="estadisticas-extra">
                        {/* Últimas 5 jornadas */}
                        <div className="ultimas-jornadas">
                          {j.puntosPorJornada && j.puntosPorJornada.length > 0
                            ? j.puntosPorJornada.slice(-5).map((p, i) => {
                                const puntos = p !== null && p !== undefined ? p : "-";
                                // Calculamos el índice real de la jornada
                                const total = j.puntosPorJornada.length;
                                const jornadaIndex = total - 5 + i + 1; // +1 porque queremos J1, J2...
                                
                                // Determinar clase de color
                                let claseColor = "";
                                if (typeof p === "number") {
                                  if (p >= 9) claseColor = "verde";
                                  else if (p < 7) claseColor = "rojo";
                                }

                                return (
                                  <div key={i} className="jornada-item">
                                    <small className="jornada-nombre">J{jornadaIndex}</small>
                                    <div className={`jornada-cuadro ${claseColor}`}>
                                      {puntos}
                                    </div>
                                  </div>
                                );
                              })
                            : [...Array(5)].map((_, i) => (
                                <div key={i} className="jornada-item">
                                  <small className="jornada-nombre">J{i + 1}</small>
                                  <div className="jornada-cuadro">-</div>
                                </div>
                              ))
                          }
                        </div>
                      </div>

                    </div>
                  </div>
                  <hr/>
                  <div className="modal-footer">
                    <button
                      className="btn-comprar"
                      disabled={j.stock <= 0}
                      onClick={(e) => {
                        e.stopPropagation(); // evita que se abra el modal
                        pujarJugador(j);
                      }}>                      
                      Pujar por el jugador                    
                    </button>
                  </div>
                </div>

              </li>
            ))}
          </ul>)}
        </div>)}

        {tabActiva === "operaciones" && (
        <div className="operaciones-container">
          <div className="operaciones-animacion">
            <h2>Mis operaciones pendientes</h2>
            {usuario?.operaciones && usuario.operaciones.length > 0 ? (
              <ul>
                {usuario.operaciones.map((op, i) => (
                  <li key={i}>
                    {op.tipo} - {op.jugador} - {formatearDinero(op.cantidad)}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No tienes operaciones pendientes</p>
            )}
            </div>
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
