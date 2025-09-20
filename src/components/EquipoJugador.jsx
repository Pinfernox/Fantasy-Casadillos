import React, { useState, useEffect, useRef } from "react";
import { Link, useParams } from 'react-router-dom';
import appFirebase from "../credenciales";
import { FORMACIONES } from './formations';
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
  where
} from 'firebase/firestore';
import ImagenProfile from '/SinPerfil.jpg'
import Fondo from '../assets/fondo.png'
import "./Home.css";
import "./EquipoJugador.css"
import ModalPerfil from "./ModalPerfil"
import ModalPerfilJugadorUsuario from "./ModalJugadorUsuario";

const db = getFirestore(appFirebase);
const auth = getAuth(appFirebase);

const MAPA_FORMACIONES = {
  "1-1-1-1": ["DEL", "MED", "DEF", "POR"],
  "2-2": ["MED", "MED", "DEF", "DEF"],
  "1-2-1 A": ["DEL", "DEF", "DEF", "POR"],
  "1-2-1 B": ["DEL", "MED", "MED", "DEF"],
  "2-1-1": ["DEL", "MED", "DEF", "DEF"],
  "1-1-2": ["MED", "MED", "DEF", "POR"],
};

function getBordeEstilo(jugador, index, formacion) {
  let color = "white"; // por defecto
  let status = null;

  if (!jugador) return { style: { borderColor: color }, status };

  const esperado = MAPA_FORMACIONES[formacion]?.[index];

  if (!esperado) return { style: { borderColor: color }, status };

  const pos = jugador.posicion; // debe ser "POR", "DEF", "MED" o "DEL"

  // Reglas de colores
  if (pos === "POR") {
    color = esperado === "POR" ? "green" : "red";
  } else if (pos === "DEF") {
    if (esperado === "DEF") color = "green";
    else if (esperado === "MED") color = "orange";
    else color = "red"; // si está en DEL o POR
  } else if (pos === "MED") {
    if (esperado === "MED") color = "green";
    else if (esperado === "DEF" || esperado === "DEL") color = "orange";
    else color = "red"; // si está en POR
  } else if (pos === "DEL") {
    if (esperado === "DEL") color = "green";
    else if (esperado === "MED") color = "orange";
    else color = "red"; // si está en DEF o POR
  }

  status = color; // guardamos el estado

  return {
    style: {
      borderColor: color,
      borderWidth: "3px",
      borderStyle: "solid",
    },
    status,
  };
}

export default function EquipoJugador({ usuario }) {
  const { jugadorId } = useParams()
  const [loadingJugador, setLoadingJugador] = useState(true)
  const [jugadorData, setJugadorData] = useState(null)
  const [menu, setMenu] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [dinero, setDinero] = useState(null)
  const fotoURL = usuario?.fotoPerfil || ImagenProfile
  const titulares = jugadorData?.equipo?.titulares || [];
  const banquillo = jugadorData?.equipo?.banquillo || [];
  const [jugadores, setJugadores] = useState([]);
  const capitan = jugadorData?.equipo?.capitan || "";
    // Estado inicial: la formación actual del usuario
  const [formacionActual, setFormacionActual] = useState(jugadorData?.equipo?.formacion || "2-1-1");
  const [formacionSeleccionada, setFormacionSeleccionada] = useState(formacionActual);

  useEffect(() => {
    if (jugadorData?.equipo?.formacion) {
      setFormacionActual(jugadorData.equipo.formacion);
      setFormacionSeleccionada(jugadorData.equipo.formacion);
    }
  }, [jugadorData]);

  const [openModal, setOpenModal] = useState(false)
  const [openModalJugadorUsuario, setOpenModalJugadorUsuario] = useState(false)
  const [jugadorSeleccionado, setJugadorSeleccionado] = useState(null)
  const [menuActivo, setMenuActivo] = useState(false);
  const refMenu = useRef(null);
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
    if (window.particlesJS && document.getElementById("particles-js")) {
      window.particlesJS.load("particles-js", "particles.json", () => {
        console.log("Particles.js config cargado");
      });
    }

    if (usuario) {
          const ref = doc(db, 'usuarios', usuario.uid)
          getDoc(ref).then((snap) => {
            if (snap.exists()) {
              setDinero(snap.data().dinero)
            }
          })
    }
  }, [usuario]);

  // 1. Cargar jugador clicado en la clasificación
  useEffect(() => {
    const fetchJugador = async () => {
      if (!jugadorId) return;
      setLoadingJugador(true);
      try {
        const snap = await getDoc(doc(db, 'usuarios', jugadorId));
        if (snap.exists()) {
          setJugadorData({ id: snap.id, ...snap.data() });
        } else {
          setJugadorData(null);
        }
      } catch (err) {
        console.error("Error fetching jugador:", err);
      } finally {
        setLoadingJugador(false);
      }
    };

    fetchJugador();
  }, [jugadorId]);

  // 2. Cuando ya tenemos los titulares/banquillo, cargar los jugadores reales
  useEffect(() => {
    const fetchJugadores = async () => {
      if (!jugadorData?.equipo) return;

      try {
        const ids = [
          ...(jugadorData.equipo.titulares || []),
          ...(jugadorData.equipo.banquillo || [])
        ].filter(id => typeof id === 'string' && id); // elimina null, undefined y no strings

        if (ids.length === 0) {
          setJugadores([]);
          return;
        }

        const jugadoresRef = collection(db, "jugadores");
        const q = query(jugadoresRef, where("__name__", "in", ids));
        const snap = await getDocs(q);
        const jugadoresData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        setJugadores(jugadoresData);
      } catch (err) {
        console.error("Error cargando jugadores:", err);
      }
    };

    fetchJugadores();
  }, [jugadorData]);


  const toggleMenu = () => {
    setMenu(!menu)
  }

  // Función para abreviar el dinero
  const abreviarDinero = (valor) => {
    if (valor >= 1_000_000) {
      return (valor / 1_000_000).toFixed(2) + 'M'
    } else if (valor >= 1_000) {
      return (valor / 1_000).toFixed(2) + 'K'
    } else {
      return valor.toFixed(2)
    }
  }

  const formatearDinero = (valor) => {
    return valor.toLocaleString('es-ES') + '€';
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
              </div>
            )}
          </div>

          <div className="info-profile">
            <h2 className="nombre-usuario">
              {(usuario?.nick || usuario?.displayName)}
            </h2>
            {dinero !== null && (
              <p className="dinero-usuario">
                💰<strong>{abreviarDinero(dinero)}</strong>
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

          </ul>
        </nav>

      </header>

      <div className="login-hero-Cabecera" style={{backgroundImage: `url(${Fondo})`,}}>
        <div id="particles-js" style={{ position: 'absolute', inset: 0 }}></div>
        {openModal && 
          (<ModalPerfil usuario={usuario} openModal= {openModal} setOpenModal={setOpenModal} />)
        }
        {openModalJugadorUsuario && jugadorSeleccionado &&           
        (<ModalPerfilJugadorUsuario jugador={jugadorSeleccionado} openModal= {openModalJugadorUsuario} setOpenModal={setOpenModalJugadorUsuario} />)}
        <div className="container-campo" style={{ textAlign: 'center', position: 'relative', zIndex: 1 , marginTop: '0rem'}}>
          <div className="datos-equipo">
            <p><strong>Formación:</strong> <small>{formacionSeleccionada}</small> </p>
            <p><strong>Dinero:</strong> <small><span className="verde">{formatearDinero(jugadorData?.dinero || 0)}</span></small></p>
          </div>
          <div className="ultimas-jornadas-equipo-jugador">
                {jugadorData?.puntuaciones && jugadorData?.puntuaciones.length > 0
                  ? jugadorData?.puntuaciones.slice(-5).map((p, i, arr) => {
                      const puntos = p != null ? p : "-";
                      // Índice de jornada: siempre empezamos desde 1
                      const jornadaIndex = arr.length < 5 ? i + 1 : jugadorData?.puntuaciones.length - 5 + i + 1;

                      // Determinar clase de color
                      let claseColor = "";
                      if (typeof p === "number") {
                        if (p >= 36) claseColor = "verde";
                        else if (p < 28) claseColor = "rojo";
                        else claseColor = "naranja";
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
          <div className="campo">
            {/* Jugadores según formación */}
            {FORMACIONES[formacionSeleccionada]?.map((pos, index) => {
              const jugadorIdActual = titulares[index];
              const jugador = jugadores.find(j => j.id === jugadorIdActual);

              return (
                <div
                  key={jugador?.id || index}
                  className="jugador"
                  style={{
                    position: "absolute",
                    top: pos.top,
                    left: pos.left,
                    transform: "translate(-50%, -50%)",
                  }}>
                  <div className="jugador-wrapper">
                    <img
                      src={jugador?.foto || ImagenProfile}
                      alt={jugador?.nombre || "Vacío"}
                      className="jugador-img"
                      style={getBordeEstilo(jugador, index, formacionSeleccionada).style}
                      onClick={() => {
                        setOpenModalJugadorUsuario(true); 
                        setJugadorSeleccionado(jugador);
                    }}
                    />
                    {/* Badge en función del estado */}
                    {(() => {
                        const { status } = getBordeEstilo(jugador, index, formacionSeleccionada);
                        console.log(status)
                        if (!status) return null;

                        if (status === "green")
                          return <div className="status-badge green">✓</div>;
                        if (status === "orange")
                          return <div className="status-badge orange">!</div>;
                        if (status === "red")
                          return <div className="status-badge red">✕</div>;

                        return null;
                    })()}
                    
                    {capitan === jugador?.id && (
                      <div className="capitan-badge">C</div>
                    )}

                    {/* Badge de últimos puntos (arriba derecha) */}
                    {(() => {
                      if (jugador?.puntosPorJornada.length === 0){
                        return(
                          <div className={`puntos-badge ${'gray'}`}>
                            -
                          </div>
                        )
                      }
                      const ultimosPuntos = jugador?.puntosPorJornada?.length
                        ? jugador?.puntosPorJornada[jugador?.puntosPorJornada.length - 1]
                        : null;

                      if (ultimosPuntos === null || ultimosPuntos === undefined) return null;
                      let claseColor = ultimosPuntos === "-" ? "gray" : ultimosPuntos < 7 ? "red" : ultimosPuntos < 9 ? "orange" : "green";
                      return (
                        <div className={`puntos-badge ${claseColor}`}>
                          {ultimosPuntos}
                        </div>
                      );
                    })()}
                  </div>
                  <p className="jugador-nombre">{jugador?.nombre || "Vacío"}</p>
                </div>
              );
            })}
          </div> 
          {/* --- BANQUILLO --- */}
          <div className="banquillo-section">
            <h3 className="banquillo-title">⚽ Banquillo</h3>
            <div className="banquillo-container">
              {banquillo.map((jugadorId, idx) => {
                const jugador = jugadores.find(j => j.id === jugadorId);

                return (
                  <div className="banquillo-slot">
                    {jugador ? (
                      <>
                        <div className="jugador-wrapper">
                          <img
                            src={jugador?.foto || ImagenProfile}
                            alt={jugador?.nombre || "Vacío"}
                            className="jugador-img"
                            onClick={() => {
                              setOpenModalJugadorUsuario(true);
                              setJugadorSeleccionado(jugador);
                            }}
                          />
                          {/* Badge de últimos puntos (arriba derecha) */}
                          {(() => {
                            if (jugador?.puntosPorJornada?.length === 0) {
                              return (
                                <div className={`puntos-badge gray`}>
                                  -
                                </div>
                              );
                            }
                            const ultimosPuntos = jugador?.puntosPorJornada?.length
                              ? jugador?.puntosPorJornada[jugador?.puntosPorJornada.length - 1]
                              : null;
                            if (ultimosPuntos === null || ultimosPuntos === undefined) return null;
                            let claseColor = ultimosPuntos === "-" ? "gray" : ultimosPuntos < 7 ? "red" : ultimosPuntos < 9 ? "orange" : "green";

                            return (
                              <div className={`puntos-badge ${claseColor}`}>
                                {ultimosPuntos}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Nombre del jugador fuera del wrapper */}
                        <p className="jugador-nombre-banquillo">{jugador?.nombre}</p>
                      </>
                    ) : (
                      <Link className="banquillo-add">+</Link>
                    )}
                  </div>

                );
              })}
            </div>
          </div>
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
