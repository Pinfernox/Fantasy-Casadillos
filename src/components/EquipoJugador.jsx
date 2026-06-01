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
import ModalPerfilJugadorUsuario from "./ModalJugadorUsuario";
import Cabecera from "./Cabecera";

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

  const posReal = jugador.posicion; 

  // Asignamos el mismo valor numérico que usamos en la puntuación
  const orden = { "POR": 0, "DEF": 1, "MED": 2, "DEL": 3 };

  // Calculamos la distancia matemática en el campo
  if (orden[posReal] !== undefined && orden[esperado] !== undefined) {
    const distancia = Math.abs(orden[posReal] - orden[esperado]);
    
    if (distancia === 0) {
      color = "green"; // Posición perfecta (100% pts)
    } else if (distancia === 1) {
      color = "orange"; // Un paso de diferencia: POR en DEF, o MED en DEL (75% pts)
    } else {
      color = "red"; // Dos o tres pasos de diferencia: POR en MED, DEF en DEL... (25% pts)
    }
  } else {
    color = "red"; // Por si falla algo
  }

  status = color; // guardamos el estado para el badge (✓, !, ✕)

  return {
    style: {
      borderColor: color,
      borderWidth: "3px",
      borderStyle: "solid",
    },
    status,
  };
}

function calcularPuntosReales(jugador, index, formacion, idCapitan) {
  if (!jugador || !jugador.puntosPorJornada || jugador.puntosPorJornada.length === 0) return "-";
  
  const ultimosPuntosBase = jugador.puntosPorJornada[jugador.puntosPorJornada.length - 1];
  if (typeof ultimosPuntosBase !== 'number') return "-";

  const esperado = MAPA_FORMACIONES[formacion]?.[index];
  if (!esperado) return ultimosPuntosBase;

  const orden = { "POR": 0, "DEF": 1, "MED": 2, "DEL": 3 };
  const posReal = jugador.posicion;
  let puntosFinales = ultimosPuntosBase;

  // 1. Penalización
  if (orden[posReal] !== undefined && orden[esperado] !== undefined) {
    const distancia = Math.abs(orden[posReal] - orden[esperado]);
    if (distancia === 1) puntosFinales *= 0.75;
    else if (distancia >= 2) puntosFinales *= 0.25;
  }

  // 2. Capitán (x2)
  if (jugador.id === idCapitan) {
    puntosFinales *= 2;
  }

  // Redondear para no mostrar decimales feos si hay sanciones
  return Math.round(puntosFinales);
}

export default function EquipoJugador({ usuario }) {
  const { jugadorId } = useParams()
  const [loadingJugador, setLoadingJugador] = useState(true)
  const [jugadorData, setJugadorData] = useState(null)
  const [showOnboarding, setShowOnboarding] = useState(false);
  const fotoURL = usuario?.fotoPerfil || ImagenProfile
  const titulares = jugadorData?.equipo?.titulares || [];
  const banquillo = jugadorData?.equipo?.banquillo || [];
  const [jugadores, setJugadores] = useState([]);
  const capitan = jugadorData?.equipo?.capitan || "";
  
  // MAGIA: Leer la formación directamente en tiempo real (sin useState)
  const formacionSeleccionada = jugadorData?.equipo?.formacion || "2-1-1";

// 1. Cargar jugador clicado en la clasificación (AHORA EN TIEMPO REAL)

// 1. Cargar jugador clicado en la clasificación (AHORA EN TIEMPO REAL)
  useEffect(() => {
    if (!jugadorId) return;
    setLoadingJugador(true);

    // 🎙️ Abrimos el "micrófono" para escuchar los cambios del rival en directo
    const unsubscribe = onSnapshot(
      doc(db, 'usuarios', jugadorId),
      (snap) => {
        if (snap.exists()) {
          setJugadorData({ id: snap.id, ...snap.data() });
        } else {
          setJugadorData(null);
        }
        setLoadingJugador(false);
      },
      (err) => {
        console.error("Error escuchando al usuario rival:", err);
        setLoadingJugador(false);
      }
    );

    // 🧹 Importante: Apagar el micrófono cuando salimos de esta pantalla
    return () => unsubscribe();
  }, [jugadorId]);

  const [openModalJugadorUsuario, setOpenModalJugadorUsuario] = useState(false)
  const [jugadorSeleccionado, setJugadorSeleccionado] = useState(null)
  

  useEffect(() => {
    if (window.particlesJS && document.getElementById("particles-js")) {
      window.particlesJS.load("particles-js", "particles.json", () => {
        console.log("Particles.js config cargado");
      });
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
          ...(jugadorData.equipo.titulares || []).map(s => s?.jugadorId).filter(Boolean),
          ...(jugadorData.equipo.banquillo || []).map(s => s?.jugadorId).filter(Boolean),
        ];


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
      <Cabecera usuario={usuario} />

      <div className="login-hero-Cabecera" style={{backgroundImage: `url(${Fondo})`,}}>
        <div id="particles-js" style={{ position: 'absolute', inset: 0 }}></div>
        {openModalJugadorUsuario && jugadorSeleccionado &&           
        (<ModalPerfilJugadorUsuario jugador={jugadorSeleccionado} 
          clausulaPersonal={
            jugadorData?.equipo?.titulares?.find(j => j.jugadorId === jugadorSeleccionado.id)?.clausulaPersonal ??
            jugadorData?.equipo?.banquillo?.find(j => j.jugadorId === jugadorSeleccionado.id)?.clausulaPersonal
          } 
          openModal= {openModalJugadorUsuario} setOpenModal={setOpenModalJugadorUsuario} idUsuario={jugadorData?.id}/>)}
        <div className="container-campo" style={{ textAlign: 'center', position: 'relative', zIndex: 1 , marginTop: '0rem'}}>
          <div className="datos-equipo">
            <p><strong>Formación:</strong> <small>{formacionSeleccionada}</small> </p>
            <p><strong>Dinero:</strong> <small><span className="verde">{formatearDinero(jugadorData?.dinero || 0)}</span></small></p>
          </div>
          <div className="ultimas-jornadas-equipo-jugador">
                          {jugadorData?.puntuaciones && jugadorData?.puntuaciones.length > 0
                            ? jugadorData?.puntuaciones.slice(-5).map((p, i, arr) => {
                                const puntos = p != null ? p : "-";
                                // Índice de jornada: corregido para mostrar desde J1 correctamente
                                const jornadaIndex = jugadorData.puntuaciones.length <= 5 
                                    ? i + 1 
                                    : jugadorData.puntuaciones.length - 5 + i + 1;

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
              const slot = titulares[index]; // { jugadorId, clausulaPersonal }
              const jugador = jugadores.find(j => j.id === slot?.jugadorId);

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

                    {/* Badge de últimos puntos reales */}
                    {(() => {
                      const puntosReales = calcularPuntosReales(jugador, index, formacionSeleccionada, capitan);
                      if (puntosReales === null || puntosReales === undefined) return null;

                      let claseColor = puntosReales === "-" ? "gray" : puntosReales < 7 ? "red" : puntosReales < 9 ? "orange" : "green";
                      return <div className={`puntos-badge ${claseColor}`}>{puntosReales}</div>;
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
              {banquillo.map((slot, idx) => {
                const jugador = jugadores.find(j => j.id === slot?.jugadorId);
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
